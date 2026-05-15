import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import { Redis } from 'ioredis';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { AuthTokenPayload, AuthResponse } from '@exchange/shared';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, PASSWORD_POLICY_REGEX } from './dto/change-password.dto';
import { TotpEnrollDto, TotpVerifyDto } from './dto/totp.dto';

const SALT_ROUNDS = 12;

type TokenPurpose = 'pre_auth' | 'enroll';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditService.log({ userId: user.id, action: 'LOGIN', ipAddress: ip, userAgent });

    // Step 1: force password change first
    if (user.forcePasswordChange) {
      const preAuthToken = this.issueShortLived(user.id, 'pre_auth');
      return { requiresPasswordChange: true as const, preAuthToken };
    }

    // Step 2: TOTP not enrolled → must enrol
    if (!user.totpEnabled) {
      const enrollToken = this.issueShortLived(user.id, 'enroll');
      return { requiresEnrollment: true as const, enrollToken };
    }

    // Step 3: TOTP enrolled → must verify code
    const preAuthToken = this.issueShortLived(user.id, 'pre_auth');
    return { requiresTotp: true as const, preAuthToken };
  }

  async changePassword(dto: ChangePasswordDto, ip?: string) {
    const userId = await this.validateShortLived(dto.preAuthToken, 'pre_auth');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!PASSWORD_POLICY_REGEX.test(dto.newPassword)) {
      throw new BadRequestException(
        'Password must be ≥12 chars with uppercase, lowercase, digit and special character',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, forcePasswordChange: false },
    });

    await this.auditService.log({ userId, action: 'CHANGE_PASSWORD', ipAddress: ip });

    if (!updated.totpEnabled) {
      const enrollToken = this.issueShortLived(userId, 'enroll');
      return { requiresEnrollment: true as const, enrollToken };
    }

    const preAuthToken = this.issueShortLived(userId, 'pre_auth');
    return { requiresTotp: true as const, preAuthToken };
  }

  async totpSetup(enrollToken: string): Promise<{ qrDataUrl: string; secret: string }> {
    const userId = await this.validateShortLived(enrollToken, 'enroll');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    let secret = user.totpSecret;
    if (!secret) {
      secret = authenticator.generateSecret();
      await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    }

    // Re-issue a fresh enroll token (since validateShortLived consumed the original)
    const freshEnrollToken = this.issueShortLived(userId, 'enroll');

    const otpAuthUrl = authenticator.keyuri(user.username, 'Exchange Manager', secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
    return { qrDataUrl, secret, enrollToken: freshEnrollToken } as {
      qrDataUrl: string;
      secret: string;
      enrollToken: string;
    };
  }

  async totpEnroll(dto: TotpEnrollDto): Promise<AuthResponse> {
    const userId = await this.validateShortLived(dto.enrollToken, 'enroll');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.totpSecret) {
      throw new BadRequestException('TOTP setup not initiated — call /auth/totp/setup first');
    }

    const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret });
    if (!valid) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.auditService.log({ userId, action: 'TOTP_ENROLLED' });

    return this.issueFullToken(user);
  }

  async totpVerify(dto: TotpVerifyDto): Promise<AuthResponse> {
    const userId = await this.validateShortLived(dto.preAuthToken, 'pre_auth');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.totpSecret || !user.totpEnabled) {
      throw new BadRequestException('TOTP not enrolled for this user');
    }

    const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret });
    if (!valid) throw new UnauthorizedException('Invalid TOTP code');

    await this.auditService.log({ userId, action: 'TOTP_VERIFIED' });
    return this.issueFullToken(user);
  }

  async logout(token: string, userId: string): Promise<void> {
    const decoded = this.jwtService.decode(token) as { exp?: number };
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
    if (ttl > 0) {
      await this.redis.setex(`bl:${token}`, ttl, '1');
    }
    await this.auditService.log({ userId, action: 'LOGOUT' });
  }

  async forgotPassword(email: string): Promise<void> {
    const { randomUUID } = require('crypto') as typeof import('crypto');
    // Find user silently — never reveal whether the email exists
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    const token = randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(email, resetUrl, user.fullName);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!PASSWORD_POLICY_REGEX.test(newPassword)) {
      throw new BadRequestException(
        'Password must be ≥12 chars with uppercase, lowercase, digit and special character',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user || !user.passwordResetExpiry) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        forcePasswordChange: false,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private issueShortLived(userId: string, purpose: TokenPurpose): string {
    // Include a unique jti so tokens issued within the same clock-second
    // have different payloads and are never blacklisted as a side-effect
    // of a prior token with identical iat/exp.
    const { randomUUID } = require('crypto') as typeof import('crypto');
    return this.jwtService.sign(
      { sub: userId, purpose, jti: randomUUID() },
      { expiresIn: '5m' },
    );
  }

  private async validateShortLived(token: string, expectedPurpose: TokenPurpose): Promise<string> {
    let payload: { sub: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token) as { sub: string; purpose?: string };
    } catch {
      throw new UnauthorizedException('Token invalid or expired');
    }

    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const isBlacklisted = await this.redis.get(`bl:${token}`);
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');

    // One-time use: blacklist immediately
    const decoded = this.jwtService.decode(token) as { exp?: number };
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 300;
    if (ttl > 0) await this.redis.setex(`bl:${token}`, ttl, '1');

    return payload.sub;
  }

  private issueFullToken(user: {
    id: string; username: string; role: string; fullName: string;
    isActive: boolean; permissions: unknown; totpEnabled: boolean; forcePasswordChange: boolean;
  }): AuthResponse {
    const payload: AuthTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as AuthTokenPayload['role'],
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as AuthTokenPayload['role'],
        isActive: user.isActive,
        permissions: Array.isArray(user.permissions) ? (user.permissions as string[]) : [],
        totpEnabled: user.totpEnabled,
        forcePasswordChange: user.forcePasswordChange,
      },
    };
  }
}

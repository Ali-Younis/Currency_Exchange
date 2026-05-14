import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Redis } from 'ioredis';
import { AuthTokenPayload } from '@exchange/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'changeme',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AuthTokenPayload): Promise<AuthTokenPayload> {
    // Check Redis blacklist — token revoked on logout
    const authHeader = (req.headers as Record<string, string>)['authorization'] ?? '';
    const token = authHeader.replace('Bearer ', '');
    const isBlacklisted = await this.redis.get(`bl:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return payload;
  }
}

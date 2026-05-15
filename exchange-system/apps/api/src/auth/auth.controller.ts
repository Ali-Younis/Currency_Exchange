import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TotpEnrollDto, TotpVerifyDto } from './dto/totp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthTokenPayload } from '@exchange/shared';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.authService.changePassword(dto, req.ip);
  }

  /** Returns QR data URL + fresh enroll token for the TOTP setup page */
  @Get('totp/setup')
  totpSetup(@Query('enrollToken') enrollToken: string) {
    return this.authService.totpSetup(enrollToken);
  }

  @Post('totp/enroll')
  @HttpCode(HttpStatus.OK)
  totpEnroll(@Body() dto: TotpEnrollDto) {
    return this.authService.totpEnroll(dto);
  }

  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  totpVerify(@Body() dto: TotpVerifyDto) {
    return this.authService.totpVerify(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() req: Request, @CurrentUser() user: AuthTokenPayload) {
    const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    return this.authService.logout(token, user.sub);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always return the same message to avoid email enumeration
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset successfully. You can now log in.' };
  }
}

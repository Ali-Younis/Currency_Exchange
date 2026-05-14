import { IsString, IsOptional, MinLength, MaxLength, IsBoolean, IsIn, IsArray, Allow } from 'class-validator';
import { Role } from '@exchange/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'TELLER'])
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  forcePasswordChange?: boolean;

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  totpEnabled?: boolean;

  /** Allow null for TOTP secret reset */
  @IsOptional()
  @Allow()
  totpSecret?: string | null;
}

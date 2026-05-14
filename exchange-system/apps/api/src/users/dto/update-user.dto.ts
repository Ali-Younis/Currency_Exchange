import { IsString, IsOptional, MinLength, MaxLength, IsBoolean, IsIn } from 'class-validator';
import { Role } from '@exchange/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'TELLER'])
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

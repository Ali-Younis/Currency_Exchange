import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 12 characters and include uppercase, lowercase, a digit, and a special character (@$!%*?&)';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  preAuthToken!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}

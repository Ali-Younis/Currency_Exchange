import { IsString, IsNotEmpty, MinLength, MaxLength, IsIn } from 'class-validator';
import { Role } from '@exchange/shared';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @IsIn(['ADMIN', 'TELLER'])
  role!: Role;
}

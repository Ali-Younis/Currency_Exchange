import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { IsValidPhone } from '../../common/validators/phone.validator';

export class CreateCustomerDto {
  @IsValidPhone()
  phone!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

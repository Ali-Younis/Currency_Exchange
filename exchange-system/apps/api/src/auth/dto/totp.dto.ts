import { IsString, IsNotEmpty, Length } from 'class-validator';

export class TotpVerifyDto {
  @IsString()
  @IsNotEmpty()
  preAuthToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class TotpEnrollDto {
  @IsString()
  @IsNotEmpty()
  enrollToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength, Length } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  symbol!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

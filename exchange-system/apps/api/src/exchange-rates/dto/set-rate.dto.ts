import { IsUUID, IsNotEmpty, IsDateString, IsNumberString } from 'class-validator';

export class SetExchangeRateDto {
  @IsUUID()
  currencyId!: string;

  @IsNumberString()
  @IsNotEmpty()
  buyRate!: string;

  @IsNumberString()
  @IsNotEmpty()
  sellRate!: string;
}

export class SetBulkRatesDto {
  @IsDateString()
  effectiveDate!: string;

  rates!: SetExchangeRateDto[];
}

import { IsUUID, IsDateString, IsNumberString, IsNotEmpty } from 'class-validator';

export class SetOpeningBalanceDto {
  @IsUUID()
  currencyId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amount!: string;

  @IsDateString()
  sessionDate!: string;
}

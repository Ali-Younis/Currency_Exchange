import {
  IsIn, IsUUID, IsDateString, IsNumberString, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { TransactionType } from '@exchange/shared';

export class CreateTransactionDto {
  @IsIn(['BUY', 'SELL'])
  type!: TransactionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @IsUUID()
  currencyInId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;

  @IsUUID()
  currencyOutId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountOut!: string;

  @IsNumberString()
  @IsNotEmpty()
  rateApplied!: string;

  @IsDateString()
  sessionDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

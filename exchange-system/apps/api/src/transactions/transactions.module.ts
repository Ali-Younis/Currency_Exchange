import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { EmailModule } from '../email/email.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [EmailModule, AppSettingsModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}

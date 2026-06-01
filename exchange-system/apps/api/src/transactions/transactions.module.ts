import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { EmailModule } from '../email/email.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [EmailModule, AppSettingsModule, CustomersModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}

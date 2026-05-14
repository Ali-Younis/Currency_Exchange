import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [forwardRef(() => AppSettingsModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

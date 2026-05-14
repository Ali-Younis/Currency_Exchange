import { Module, forwardRef } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { AppSettingsController } from './app-settings.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => EmailModule)],
  providers: [AppSettingsService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}

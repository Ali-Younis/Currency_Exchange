import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { SetExchangeRateDto } from './dto/set-rate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthTokenPayload } from '@exchange/shared';

@Controller('exchange-rates')
@UseGuards(JwtAuthGuard)
export class ExchangeRatesController {
  constructor(private readonly svc: ExchangeRatesService) {}

  @Get()
  getLatest(@Query('date') date?: string) {
    return this.svc.getLatestRates(date);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setRate(
    @Body() dto: SetExchangeRateDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.setRate(dto, user.sub);
  }
}

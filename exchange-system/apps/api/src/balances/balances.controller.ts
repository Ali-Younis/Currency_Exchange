import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { SetOpeningBalanceDto } from './dto/set-balance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthTokenPayload } from '@exchange/shared';

@Controller('balances')
@UseGuards(JwtAuthGuard)
export class BalancesController {
  constructor(private readonly svc: BalancesService) {}

  @Get()
  getByDate(@Query('date') date: string) {
    const sessionDate = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getByDate(sessionDate);
  }

  @Get('current')
  getCurrentBalances(@Query('date') date?: string) {
    return this.svc.getCurrentBalances(date);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsert(
    @Body() dto: SetOpeningBalanceDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.upsert(dto, user.sub);
  }
}

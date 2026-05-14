import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthTokenPayload } from '@exchange/shared';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  @Get()
  findAll(
    @Query('date') date?: string,
    @Query('type') type?: string,
    @Query('tellerId') tellerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.findAll({
      sessionDate: date,
      type,
      tellerId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.create(dto, user.sub);
  }

  @Patch(':id/void')
  voidTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidTransactionDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.voidTransaction(id, dto, user.sub, user.role);
  }
}

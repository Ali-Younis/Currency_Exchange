import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(activeOnly = false) {
    return this.prisma.currency.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.currency.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Currency ${id} not found`);
    return c;
  }

  async create(dto: CreateCurrencyDto) {
    const existing = await this.prisma.currency.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Currency code ${dto.code} already exists`);
    return this.prisma.currency.create({
      data: { ...dto, code: dto.code.toUpperCase() },
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.currency.update({ where: { id }, data: { isActive } });
  }

  async update(id: string, data: { sortOrder?: number }) {
    await this.findOne(id);
    return this.prisma.currency.update({ where: { id }, data });
  }
}

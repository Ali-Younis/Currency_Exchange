import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data: params });
  }

  async queryByEntity(entity: string, action?: string, limit = 30) {
    return this.prisma.auditLog.findMany({
      where: { entity, ...(action ? { action } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { username: true, fullName: true } } },
    });
  }
}

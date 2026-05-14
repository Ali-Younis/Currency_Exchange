import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { AuthTokenPayload } from '@exchange/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: AuthTokenPayload }>();

    // ADMINs bypass permissions
    if (user.role === 'ADMIN') return true;

    // Load actual permissions from DB (source of truth)
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { permissions: true } });
    const userPerms = Array.isArray(dbUser?.permissions) ? (dbUser.permissions as string[]) : [];

    const hasAll = required.every((p) => userPerms.includes(p));
    if (!hasAll) throw new ForbiddenException('You do not have permission to access this resource');
    return true;
  }
}

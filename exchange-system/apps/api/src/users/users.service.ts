import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true, username: true, fullName: true, role: true, isActive: true,
        permissions: true, totpEnabled: true, forcePasswordChange: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, fullName: true, role: true, isActive: true,
        permissions: true, totpEnabled: true, forcePasswordChange: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        forcePasswordChange: true,  // new users must change password on first login
      },
      select: {
        id: true, username: true, fullName: true, role: true, isActive: true,
        permissions: true, totpEnabled: true, forcePasswordChange: true, createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      delete data.password;
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, username: true, fullName: true, role: true, isActive: true,
        permissions: true, totpEnabled: true, forcePasswordChange: true, updatedAt: true,
      },
    });
  }
}

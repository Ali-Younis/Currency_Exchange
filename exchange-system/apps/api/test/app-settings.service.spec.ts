import { Test, TestingModule } from '@nestjs/testing';
import { AppSettingsService } from '../../src/app-settings/app-settings.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AppSettingsService', () => {
  let service: AppSettingsService;
  let prisma: { appSetting: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      appSetting: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AppSettingsService>(AppSettingsService);
  });

  it('get() returns null when key not found', async () => {
    prisma.appSetting.findUnique.mockResolvedValue(null);
    const result = await service.get('missing_key');
    expect(result).toBeNull();
  });

  it('get() returns value when key exists', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ key: 'smtp_host', value: 'smtp.example.com' });
    const result = await service.get('smtp_host');
    expect(result).toBe('smtp.example.com');
  });

  it('getAll() returns all settings as object', async () => {
    prisma.appSetting.findMany.mockResolvedValue([
      { key: 'smtp_host', value: 'smtp.example.com' },
      { key: 'smtp_port', value: '587' },
    ]);
    const result = await service.getAll();
    expect(result).toEqual({ smtp_host: 'smtp.example.com', smtp_port: '587' });
  });

  it('set() upserts the key-value pair', async () => {
    prisma.appSetting.upsert.mockResolvedValue({ key: 'test', value: 'val' });
    await service.set('test', 'val');
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'test' } }),
    );
  });

  it('delete() removes the setting', async () => {
    prisma.appSetting.deleteMany.mockResolvedValue({ count: 1 });
    await service.delete('test');
    expect(prisma.appSetting.deleteMany).toHaveBeenCalledWith({ where: { key: 'test' } });
  });
});

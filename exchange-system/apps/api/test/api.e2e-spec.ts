import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * End-to-end API tests.
 *
 * These tests require a real PostgreSQL + Redis instance configured via environment variables.
 * They are intended to run inside Docker Compose (or CI with services).
 *
 * To run locally: docker compose up -d postgres redis && npm run test:e2e
 */
describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'badpassword' })
        .expect(401);
    });

    it('returns 400 for missing fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/v1/currencies', () => {
    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/currencies')
        .expect(401);
    });
  });

  describe('GET /api/v1/balances', () => {
    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/balances?date=2025-01-01')
        .expect(401);
    });
  });

  describe('GET /api/v1/balances/current', () => {
    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/balances/current')
        .expect(401);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions')
        .expect(401);
    });
  });
});

describe('App health check (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1 returns 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200);
  });
});

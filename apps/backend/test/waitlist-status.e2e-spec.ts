import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { WaitlistModule } from '../src/waitlist/waitlist.module.js';
import { generateStatusToken } from '../src/waitlist/status-token.js';

describe('Public waitlist status API', () => {
  const endpoint = '/api/public/waitlist/status';
  const query = vi.fn();
  let app: INestApplication<App>;

  beforeEach(async () => {
    query.mockReset().mockResolvedValue([{ status: 'WAITING', group: 'GROUP_4', position: 3 }]);
    const module = await Test.createTestingModule({ imports: [WaitlistModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: query })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterEach(async () => app.close());

  it('returns only current status, group and position without caching', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ token: generateStatusToken() })
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect('Referrer-Policy', 'no-referrer')
      .expect({ status: 'WAITING', group: 'GROUP_4', position: 3 });
  });

  it.each([
    {},
    { token: 'invalid' },
    { token: null },
    { token: 42 },
    { token: [] },
    { token: generateStatusToken(), id: 'private' },
    { token: 'x'.repeat(1000) },
  ])('rejects malformed bodies without querying or reflecting secrets (%#)', async (body) => {
    await request(app.getHttpServer())
      .post(endpoint)
      .send(body)
      .expect(404)
      .expect('Cache-Control', 'no-store')
      .expect('Referrer-Policy', 'no-referrer')
      .expect({ statusCode: 404, message: 'Waitlist status not found' });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the same safe error for unknown tokens', async () => {
    query.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ token: generateStatusToken() })
      .expect(404)
      .expect('Cache-Control', 'no-store')
      .expect({ statusCode: 404, message: 'Waitlist status not found' });
  });

  it('does not log or return database errors or the token', async () => {
    const token = generateStatusToken();
    query.mockRejectedValueOnce(new Error(`Sensitive error including ${token}`));
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await request(app.getHttpServer())
        .post(endpoint)
        .send({ token })
        .expect(500)
        .expect('Cache-Control', 'no-store')
        .expect('Referrer-Policy', 'no-referrer')
        .expect({ statusCode: 500, message: 'Internal server error' });
      expect(log).toHaveBeenCalledExactlyOnceWith('Public waitlist status lookup failed');
    } finally {
      log.mockRestore();
    }
  });

  it('rate-limits by connection IP before database access, ignoring spoofed forwarding headers', async () => {
    const token = generateStatusToken();
    for (let index = 0; index < 30; index++) {
      await request(app.getHttpServer())
        .post(endpoint)
        .set('X-Forwarded-For', `192.0.2.${index + 1}`)
        .send({ token })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ token })
      .expect(429)
      .expect('Cache-Control', 'no-store')
      .expect('Referrer-Policy', 'no-referrer')
      .expect({ statusCode: 429, message: 'Too many requests' });
    expect(query).toHaveBeenCalledTimes(30);
  });

  it('does not expose issuance, URL-based token lookup, or a public list', async () => {
    await request(app.getHttpServer()).get(endpoint).expect(404);
    await request(app.getHttpServer()).get(`${endpoint}/${generateStatusToken()}`).expect(404);
    await request(app.getHttpServer()).post(`${endpoint}/issue`).send({ id: 'entry' }).expect(404);
  });
});

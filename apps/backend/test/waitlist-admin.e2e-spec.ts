import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { WaitlistModule } from '../src/waitlist/waitlist.module.js';
import { WaitlistService } from '../src/waitlist/waitlist.service.js';
import { StatusLinkService } from '../src/waitlist/status-link.service.js';

describe('Development waitlist access', () => {
  let app: INestApplication<App>;
  const list = vi.fn();
  const assign = vi.fn();
  const details = vi.fn();
  const updateNotes = vi.fn();
  const move = vi.fn();
  const sendStatusLink = vi.fn();
  const id = '83a6870d-6173-4b5f-bdce-d2a4b0334f93';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [WaitlistModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(WaitlistService)
      .useValue({ list, assign, details, updateNotes, move })
      .overrideProvider(StatusLinkService)
      .useValue({ send: sendStatusLink })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => {
    list.mockReset().mockResolvedValue([]);
    assign.mockReset().mockResolvedValue({ status: 'assigned' });
    details
      .mockReset()
      .mockResolvedValue({ internalNotes: null, history: [], groupHistoryIncomplete: false });
    updateNotes.mockReset().mockResolvedValue({ status: 'saved' });
    move.mockReset().mockResolvedValue({ status: 'moved' });
    sendStatusLink.mockReset().mockResolvedValue({ status: 'sent' });
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENABLE_DEV_WAITLIST_ADMIN', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => app.close());

  it.each([
    ['production', 'true'],
    ['test', 'true'],
    ['', 'true'],
    ['development', 'false'],
    ['development', ''],
    ['development', 'TRUE'],
  ])('blocks reads and writes for NODE_ENV=%s and flag=%s', async (environment, flag) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('ENABLE_DEV_WAITLIST_ADMIN', flag);
    await request(app.getHttpServer()).get('/api/internal/waitlist').expect(404);
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/group`)
      .send({ group: 'GROUP_4' })
      .expect(404);
    expect(list).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get(`/api/internal/waitlist/${id}/details`).expect(404);
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/notes`)
      .send({ internalNotes: 'Private' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/position`)
      .send({ group: 'GROUP_4', previousPosition: 1, position: 2, reason: 'Example' })
      .expect(404);
    expect(details).not.toHaveBeenCalled();
    expect(updateNotes).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post(`/api/internal/waitlist/${id}/status-link`)
      .send({})
      .expect(404);
    expect(sendStatusLink).not.toHaveBeenCalled();
  });

  it('allows explicitly enabled development reads without caching', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/waitlist')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect([]);
  });

  it('validates and delegates manual status-link delivery', async () => {
    await request(app.getHttpServer())
      .post(`/api/internal/waitlist/${id}/status-link`)
      .send({})
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ status: 'sent' });
    expect(sendStatusLink).toHaveBeenCalledExactlyOnceWith(id);
    await request(app.getHttpServer())
      .post('/api/internal/waitlist/invalid/status-link')
      .send({})
      .expect(400);
    expect(sendStatusLink).toHaveBeenCalledTimes(1);
  });

  it('validates and delegates group assignment', async () => {
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/group`)
      .send({ group: 'GROUP_4' })
      .expect(200)
      .expect({ status: 'assigned' });
    expect(assign).toHaveBeenCalledExactlyOnceWith(id, 'GROUP_4');
  });

  it.each([{}, { group: 'GROUP_5' }, { group: null }, { group: 'GROUP_4', status: 'ACCEPTED' }])(
    'rejects invalid assignment (%#)',
    async (body) => {
      await request(app.getHttpServer())
        .patch(`/api/internal/waitlist/${id}/group`)
        .send(body)
        .expect(400);
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid ID', async () => {
    await request(app.getHttpServer())
      .patch('/api/internal/waitlist/invalid/group')
      .send({ group: 'GROUP_4' })
      .expect(400);
    expect(assign).not.toHaveBeenCalled();
  });

  it('loads internal details without caching', async () => {
    await request(app.getHttpServer())
      .get(`/api/internal/waitlist/${id}/details`)
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ internalNotes: null, history: [], groupHistoryIncomplete: false });
  });

  it('trims notes and permits clearing them', async () => {
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/notes`)
      .send({ internalNotes: ' Example ' })
      .expect(200);
    expect(updateNotes).toHaveBeenCalledWith(id, 'Example');
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/notes`)
      .send({ internalNotes: ' ' })
      .expect(200);
    expect(updateNotes).toHaveBeenCalledWith(id, '');
  });

  it.each([
    {},
    { internalNotes: null },
    { internalNotes: 'x'.repeat(5001) },
    { internalNotes: 'Example', status: 'WAITING' },
  ])('rejects invalid notes (%#)', async (body) => {
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/notes`)
      .send(body)
      .expect(400);
    expect(updateNotes).not.toHaveBeenCalled();
  });

  it('requires independent reason and expected queue state when moving', async () => {
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/position`)
      .send({ group: 'GROUP_4', previousPosition: 1, position: 2, reason: ' Example ' })
      .expect(200);
    expect(move).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        group: 'GROUP_4',
        previousPosition: 1,
        position: 2,
        reason: 'Example',
      }),
    );
  });

  it.each([
    {},
    { reason: '' },
    { reason: '   ' },
    { reason: null },
    { reason: 'x'.repeat(2001) },
    { position: 0 },
    { position: 1.5 },
    { position: '2' },
    { previousPosition: 0 },
    { group: 'GROUP_5' },
    { internalNotes: 'Not a reason' },
  ])('rejects invalid moves (%#)', async (override) => {
    const body = {
      group: 'GROUP_4',
      previousPosition: 1,
      position: 2,
      reason: 'Example',
      ...override,
    };
    if (Object.keys(override).length === 0) delete (body as Partial<typeof body>).reason;
    await request(app.getHttpServer())
      .patch(`/api/internal/waitlist/${id}/position`)
      .send(body)
      .expect(400);
    expect(move).not.toHaveBeenCalled();
  });
});

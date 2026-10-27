import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { WaitlistModule } from '../src/waitlist/waitlist.module.js';
import { MailService } from '../src/mail/mail.service.js';

describe('Public waitlist registration', () => {
  let app: INestApplication<App>;
  const create = vi.fn();
  const send = vi.fn();
  const registration = {
    firstName: ' Test ',
    lastName: ' Swimmer ',
    birthDate: '2016-02-29',
    email: ' test@example.com ',
    badges: ['DSA_BRONZE'],
    swimmingStyles: ['BREASTSTROKE', 'BACKSTROKE'],
  };
  const endpoint = '/api/public/waitlist/registrations';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [WaitlistModule] })
      .overrideProvider(PrismaService)
      .useValue({ waitlistEntry: { create } })
      .overrideProvider(MailService)
      .useValue({ send })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: 'internal-id' });
    send.mockReset().mockResolvedValue('sent');
  });
  afterAll(async () => app.close());

  it('stores only public fields and returns a receipt after persistence', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .send(registration)
      .expect(201)
      .expect({ status: 'received' });
    expect(create).toHaveBeenCalledExactlyOnceWith({
      data: {
        firstName: 'Test',
        lastName: 'Swimmer',
        birthDate: new Date('2016-02-29T00:00:00.000Z'),
        email: 'test@example.com',
        badges: ['DSA_BRONZE'],
        swimmingStyles: ['BREASTSTROKE', 'BACKSTROKE'],
        message: null,
      },
      select: { id: true },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'SGB Portal – Eingangsbestätigung zur Warteliste',
      }),
    );
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });

  it('trims an optional message', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ ...registration, message: ' Hello ' })
      .expect(201);
    expect(create.mock.calls[0]?.[0].data.message).toBe('Hello');
  });

  it.each([
    {},
    { ...registration, firstName: '   ' },
    { ...registration, lastName: 'x'.repeat(101) },
    { ...registration, email: 'invalid' },
    { ...registration, birthDate: '2017-02-29' },
    { ...registration, birthDate: '9999-01-01' },
    { ...registration, birthDate: '2016-02-29T00:00:00Z' },
    { ...registration, birthDate: '0000-01-01' },
    { ...registration, badges: [] },
    { ...registration, badges: ['NONE'] },
    { ...registration, badges: ['SEAHORSE', 'SEAHORSE'] },
    { ...registration, swimmingStyles: [] },
    { ...registration, swimmingStyles: ['UNKNOWN'] },
    { ...registration, swimmingStyles: [null] },
    { ...registration, message: null },
    { ...registration, message: 'x'.repeat(2001) },
    { ...registration, status: 'WAITING' },
    { ...registration, group: 'GROUP_4' },
    { ...registration, internalNotes: 'Private' },
  ])('rejects invalid or privileged input (%#)', async (body) => {
    await request(app.getHttpServer()).post(endpoint).send(body).expect(400);
    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not expose a public list', async () => {
    await request(app.getHttpServer()).get(endpoint).expect(404);
  });

  it('does not acknowledge or expose details when persistence fails', async () => {
    create.mockRejectedValueOnce(new Error('Sensitive database details'));
    const response = await request(app.getHttpServer())
      .post(endpoint)
      .send(registration)
      .expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps a saved registration successful when email delivery fails', async () => {
    send.mockRejectedValueOnce(new Error('SMTP credentials and private recipient'));
    await request(app.getHttpServer())
      .post(endpoint)
      .send(registration)
      .expect(201)
      .expect({ status: 'received' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

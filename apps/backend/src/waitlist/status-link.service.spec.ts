import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { WaitlistStatusService } from './waitlist-status.service.js';
import { StatusLinkService } from './status-link.service.js';
import { statusLinkDeliveryDetails, statusLinkAttemptTimeout } from './status-link-delivery.js';
import type { WaitlistEntry } from '../generated/prisma/client.js';
import { hashStatusToken } from './status-token.js';

describe('Status-link delivery', () => {
  let entry: WaitlistEntry;
  let service: StatusLinkService;
  const send = vi.fn();
  const updateMany = vi.fn();
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PUBLIC_FRONTEND_URL', 'http://localhost:4200');
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    entry = {
      id: 'entry',
      status: 'WAITING',
      group: 'GROUP_4',
      email: 'test@example.invalid',
      statusTokenHash: null,
      statusLinkDelivery: 'PENDING',
      statusLinkAttemptId: null,
      statusLinkAttemptAt: null,
      statusLinkSentAt: null,
    } as WaitlistEntry;
    send.mockReset().mockResolvedValue('sent');
    updateMany
      .mockReset()
      .mockImplementation(({ where, data }: { where: Record<string, unknown>; data: object }) => {
        if (
          where.id !== entry.id ||
          (where.statusLinkAttemptId && where.statusLinkAttemptId !== entry.statusLinkAttemptId) ||
          (where.statusLinkDelivery && where.statusLinkDelivery !== entry.statusLinkDelivery) ||
          ('statusTokenHash' in where && where.statusTokenHash !== entry.statusTokenHash)
        )
          return { count: 0 };
        Object.assign(entry, data);
        return { count: 1 };
      });
    const database = {
      $queryRaw: vi.fn(),
      waitlistEntry: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) =>
          where.id === entry.id ? { ...entry } : null,
        ),
        update: vi.fn(({ data }: { data: object }) => Object.assign(entry, data)),
        updateMany,
      },
    };
    let gate = Promise.resolve();
    const prisma = {
      ...database,
      $transaction: async (operation: (tx: typeof database) => Promise<unknown>) => {
        const previous = gate;
        let release!: () => void;
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation(database);
        } finally {
          release();
        }
      },
    } as unknown as PrismaService;
    service = new StatusLinkService(
      prisma,
      { send } as unknown as MailService,
      new WaitlistStatusService(prisma),
    );
  });
  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  function mailedToken(): string {
    return /\/warteliste\/status#([A-Za-z0-9_-]{43})/.exec(
      String(send.mock.calls.at(-1)?.[0].text),
    )![1];
  }

  it('claims before SMTP, stores only a hash and confirms server acceptance', async () => {
    send.mockImplementationOnce(() => {
      expect(entry.statusLinkDelivery).toBe('SENDING');
      expect(entry.statusTokenHash).toBe(hashStatusToken(mailedToken()));
      return 'sent';
    });
    await expect(service.send('entry')).resolves.toEqual({ status: 'sent' });
    expect(entry.statusLinkDelivery).toBe('SENT');
    expect(entry.statusLinkSentAt).toBeInstanceOf(Date);
    expect(JSON.stringify(entry)).not.toContain(mailedToken());
    await expect(service.send('entry')).rejects.toThrow('not available');
    await service.sendAutomatic('entry');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('permits only one automatic attempt during concurrent requests', async () => {
    await Promise.all([service.sendAutomatic('entry'), service.sendAutomatic('entry')]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('records failure, does not automatically retry, and replaces the token on manual retry', async () => {
    send.mockRejectedValueOnce(new Error('SMTP password and bearer secret'));
    await service.sendAutomatic('entry');
    const oldHash = entry.statusTokenHash;
    expect(entry.statusLinkDelivery).toBe('FAILED');
    await service.sendAutomatic('entry');
    expect(send).toHaveBeenCalledTimes(1);
    await expect(service.send('entry')).resolves.toEqual({ status: 'sent' });
    expect(entry.statusTokenHash).not.toBe(oldHash);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SMTP password');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(mailedToken());
  });

  it('does not claim disabled mail as delivered', async () => {
    send.mockResolvedValueOnce('disabled');
    await expect(service.send('entry')).resolves.toEqual({ status: 'failed' });
    expect(entry.statusLinkSentAt).toBeNull();
    expect(entry.statusLinkDelivery).toBe('FAILED');
  });

  it('blocks a concurrent manual request while SMTP is running', async () => {
    let finish!: (value: string) => void;
    send.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = service.send('entry');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await expect(service.send('entry')).rejects.toThrow('not available');
    finish('sent');
    await pending;
  });

  it('allows explicit recovery of an expired/uncertain attempt and fences late completion', async () => {
    entry.statusLinkDelivery = 'SENDING';
    entry.statusLinkAttemptAt = new Date(Date.now() - statusLinkAttemptTimeout);
    expect(statusLinkDeliveryDetails(entry)).toMatchObject({ status: 'UNKNOWN', canSend: true });
    send.mockImplementationOnce(() => {
      entry.statusLinkAttemptId = 'a-newer-attempt';
      return 'sent';
    });
    await expect(service.send('entry')).rejects.toThrow('no longer current');
    expect(entry.statusLinkDelivery).toBe('SENDING');
  });

  it('allows existing assigned records but never sends to unassigned or closed entries', async () => {
    entry.statusLinkDelivery = 'NONE';
    await expect(service.send('entry')).resolves.toEqual({ status: 'sent' });
    for (const status of ['UNASSIGNED', 'ACCEPTED', 'CANCELLED'] as const) {
      entry.status = status;
      entry.statusLinkDelivery = 'NONE';
      await expect(service.send('entry')).rejects.toThrow('not available');
    }
    await expect(service.send('missing')).rejects.toThrow('not found');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('leaves a post-SMTP database failure uncertain instead of claiming delivery', async () => {
    // Issuance uses the first updateMany; completion uses the second.
    updateMany.mockImplementationOnce(({ data }: { data: object }) => {
      Object.assign(entry, data);
      return { count: 1 };
    });
    updateMany.mockRejectedValueOnce(new Error('database unavailable'));
    await service.sendAutomatic('entry');
    expect(entry.statusLinkDelivery).toBe('SENDING');
    expect(entry.statusLinkSentAt).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

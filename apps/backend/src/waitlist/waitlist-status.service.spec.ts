import { PrismaService } from '../database/prisma.service.js';
import { WaitlistStatusService } from './waitlist-status.service.js';
import { generateStatusToken, hashStatusToken } from './status-token.js';

describe('Waitlist status service', () => {
  const updateMany = vi.fn();
  const query = vi.fn();
  const service = new WaitlistStatusService({
    waitlistEntry: { updateMany },
    $queryRaw: query,
  } as unknown as PrismaService);

  beforeEach(() => {
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    query.mockReset().mockResolvedValue([]);
  });

  it('persists only a hash and refuses to overwrite an existing token', async () => {
    const token = await service.issueToken('entry-id');
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: 'entry-id',
        statusTokenHash: null,
        status: { notIn: ['ACCEPTED', 'CANCELLED'] },
      },
      data: { statusTokenHash: hashStatusToken(token) },
    });
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain(token);
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.issueToken('entry-id')).rejects.toThrow(
      'Status token could not be issued',
    );
  });

  it('rejects malformed secrets without querying the database', async () => {
    await expect(service.resolve('invalid')).rejects.toThrow('Waitlist status not found');
    expect(query).not.toHaveBeenCalled();
  });

  it('binds only the hash and returns an explicit public projection', async () => {
    const token = generateStatusToken();
    query.mockResolvedValueOnce([
      {
        status: 'WAITING',
        group: 'GROUP_4',
        position: 2,
        email: 'private',
        internalNotes: 'private',
      },
    ]);
    await expect(service.resolve(token)).resolves.toEqual({
      status: 'WAITING',
      group: 'GROUP_4',
      position: 2,
    });
    expect(query.mock.calls[0]?.[1]).toBe(hashStatusToken(token));
    expect(JSON.stringify(query.mock.calls)).not.toContain(token);
  });

  it('does not distinguish unknown or revoked tokens', async () => {
    await expect(service.resolve(generateStatusToken())).rejects.toThrow(
      'Waitlist status not found',
    );
  });
});

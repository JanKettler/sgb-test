import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { SwimmingGroup, WaitlistStatus } from '../generated/prisma/enums.js';
import { generateStatusToken, hashStatusToken } from './status-token.js';

export interface PublicWaitlistStatus {
  status: WaitlistStatus;
  group: SwimmingGroup | null;
  position: number | null;
}

@Injectable()
export class WaitlistStatusService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Backend-only: status-link delivery calls this within its claim transaction.
  // The caller must deliver the returned secret immediately; hashes cannot recover it.
  async issueToken(
    entryId: string,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const token = generateStatusToken();
    const result = await database.waitlistEntry.updateMany({
      where: {
        id: entryId,
        statusTokenHash: null,
        status: { notIn: ['ACCEPTED', 'CANCELLED'] },
      },
      data: { statusTokenHash: hashStatusToken(token) },
    });
    if (result.count !== 1) throw new ConflictException('Status token could not be issued');
    return token;
  }

  async resolve(token: string): Promise<PublicWaitlistStatus> {
    const hash = hashStatusToken(token);
    if (!hash) throw new NotFoundException('Waitlist status not found');
    // One statement observes entry and queue from the same PostgreSQL snapshot.
    // The token is a bound hash parameter; no personal fields are selected.
    const entries = await this.prisma.$queryRaw<PublicWaitlistStatus[]>`
      SELECT entry."status", entry."group",
        CASE WHEN entry."status" = 'WAITING' THEN (
          SELECT COUNT(*)::integer FROM "WaitlistEntry" AS waiting
          WHERE waiting."status" = 'WAITING' AND waiting."group" = entry."group"
            AND waiting."queueOrder" <= entry."queueOrder"
        ) ELSE NULL END AS "position"
      FROM "WaitlistEntry" AS entry
      WHERE entry."statusTokenHash" = ${hash}
        AND entry."status" NOT IN ('ACCEPTED', 'CANCELLED')
    `;
    const entry = entries[0];
    if (!entry) throw new NotFoundException('Waitlist status not found');
    return { status: entry.status, group: entry.group, position: entry.position };
  }
}

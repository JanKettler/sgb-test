import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { WaitlistStatusService } from './waitlist-status.service.js';
import { getPublicFrontendUrl, statusLinkMessage } from './status-link-message.js';
import { statusLinkDeliveryDetails } from './status-link-delivery.js';

@Injectable()
export class StatusLinkService {
  private readonly origin = getPublicFrontendUrl();
  private readonly logger = new Logger(StatusLinkService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(WaitlistStatusService) private readonly tokens: WaitlistStatusService,
  ) {}

  async sendAutomatic(id: string): Promise<void> {
    try {
      await this.send(id, true);
    } catch {
      this.logger.warn('Status-link delivery could not be completed; assignment remains saved');
    }
  }

  async send(id: string, automatic = false): Promise<{ status: 'sent' | 'failed' | 'skipped' }> {
    const attempt = await this.prisma.$transaction(async (tx) => {
      // Per-entry row lock protects claims and token rotation without holding the queue lock during SMTP.
      await tx.$queryRaw`SELECT "id" FROM "WaitlistEntry" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const entry = await tx.waitlistEntry.findUnique({
        where: { id },
        select: {
          email: true,
          status: true,
          statusLinkDelivery: true,
          statusLinkAttemptAt: true,
          statusLinkSentAt: true,
        },
      });
      if (!entry) throw new NotFoundException('Waitlist entry not found');
      const delivery = statusLinkDeliveryDetails(entry);
      if (automatic && (entry.statusLinkDelivery !== 'PENDING' || !delivery.canSend)) return null;
      if (!delivery.canSend) throw new ConflictException('Status-link delivery is not available');
      const attemptId = randomUUID();
      await tx.waitlistEntry.update({
        where: { id },
        data: {
          statusTokenHash: null,
          statusLinkDelivery: 'SENDING',
          statusLinkAttemptId: attemptId,
          statusLinkAttemptAt: new Date(),
          statusLinkSentAt: null,
        },
      });
      const token = await this.tokens.issueToken(id, tx);
      return { attemptId, token, email: entry.email };
    });
    if (!attempt) return { status: 'skipped' };
    // Claim/hash commit before SMTP. No plaintext is persisted, including in delivery state.
    let sent = false;
    try {
      sent =
        (await this.mail.send(statusLinkMessage(attempt.email, this.origin, attempt.token))) ===
        'sent';
    } catch {
      /* SMTP errors may contain secrets; never log or return them. */
    }
    const result = await this.prisma.waitlistEntry.updateMany({
      where: { id, statusLinkDelivery: 'SENDING', statusLinkAttemptId: attempt.attemptId },
      data: {
        statusLinkDelivery: sent ? 'SENT' : 'FAILED',
        statusLinkSentAt: sent ? new Date() : null,
      },
    });
    if (result.count !== 1) throw new ConflictException('Status-link attempt is no longer current');
    if (!sent)
      this.logger.warn('Status-link delivery was not confirmed; manual retry is available');
    return { status: sent ? 'sent' : 'failed' };
  }
}

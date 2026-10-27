import type { StatusLinkDeliveryStatus, WaitlistStatus } from '../generated/prisma/enums.js';

export const statusLinkAttemptTimeout = 120000;

export function statusLinkDeliveryDetails(
  entry: {
    status: WaitlistStatus;
    statusLinkDelivery: StatusLinkDeliveryStatus;
    statusLinkAttemptAt: Date | null;
    statusLinkSentAt: Date | null;
  },
  now = Date.now(),
) {
  const expired =
    entry.statusLinkDelivery === 'SENDING' &&
    entry.statusLinkAttemptAt !== null &&
    entry.statusLinkAttemptAt.getTime() + statusLinkAttemptTimeout <= now;
  return {
    status: expired ? 'UNKNOWN' : entry.statusLinkDelivery,
    attemptedAt: entry.statusLinkAttemptAt,
    sentAt: entry.statusLinkSentAt,
    canSend:
      entry.status !== 'UNASSIGNED' &&
      entry.status !== 'ACCEPTED' &&
      entry.status !== 'CANCELLED' &&
      (['NONE', 'PENDING', 'FAILED'].includes(entry.statusLinkDelivery) || expired),
  };
}

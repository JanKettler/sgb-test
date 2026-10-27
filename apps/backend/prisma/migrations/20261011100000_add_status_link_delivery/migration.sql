CREATE TYPE "StatusLinkDeliveryStatus" AS ENUM ('NONE', 'PENDING', 'SENDING', 'SENT', 'FAILED');

-- Do not backfill delivery claims or send mail for existing registrations.
ALTER TABLE "WaitlistEntry"
  ADD COLUMN "statusLinkDelivery" "StatusLinkDeliveryStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "statusLinkAttemptId" UUID,
  ADD COLUMN "statusLinkAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "statusLinkSentAt" TIMESTAMPTZ(3);

ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_status_link_delivery_check" CHECK (
  ("statusLinkDelivery" IN ('NONE', 'PENDING') AND "statusLinkAttemptId" IS NULL AND "statusLinkAttemptAt" IS NULL AND "statusLinkSentAt" IS NULL)
  OR ("statusLinkDelivery" IN ('SENDING', 'FAILED') AND "statusLinkAttemptId" IS NOT NULL AND "statusLinkAttemptAt" IS NOT NULL AND "statusLinkSentAt" IS NULL)
  OR ("statusLinkDelivery" = 'SENT' AND "statusLinkAttemptId" IS NOT NULL AND "statusLinkAttemptAt" IS NOT NULL AND "statusLinkSentAt" IS NOT NULL)
);

-- Existing entries remain without a token until their first link delivery is prepared.
ALTER TABLE "WaitlistEntry" ADD COLUMN "statusTokenHash" CHAR(64);

CREATE UNIQUE INDEX "WaitlistEntry_statusTokenHash_key" ON "WaitlistEntry"("statusTokenHash");

ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_statusTokenHash_check"
CHECK ("statusTokenHash" IS NULL OR "statusTokenHash" ~ '^[0-9a-f]{64}$');

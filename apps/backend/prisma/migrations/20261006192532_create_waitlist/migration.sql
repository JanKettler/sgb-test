-- CreateEnum
CREATE TYPE "SwimmingBadge" AS ENUM ('SEAHORSE', 'DSA_BRONZE', 'DSA_SILVER', 'DSA_GOLD');

-- CreateEnum
CREATE TYPE "SwimmingStyle" AS ENUM ('BUTTERFLY', 'BACKSTROKE', 'BREASTSTROKE', 'FREESTYLE');

-- CreateEnum
CREATE TYPE "SwimmingGroup" AS ENUM ('GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('UNASSIGNED', 'WAITING', 'INVITED', 'TRIAL_COMPLETED', 'ACCEPTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "badges" "SwimmingBadge"[],
    "swimmingStyles" "SwimmingStyle"[],
    "message" TEXT,
    "internalNotes" TEXT,
    "registeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "group" "SwimmingGroup",
    "queueOrder" INTEGER,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistOrderChange" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "group" "SwimmingGroup" NOT NULL,
    "previousPosition" INTEGER NOT NULL,
    "newPosition" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistOrderChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_group_status_queueOrder_idx" ON "WaitlistEntry"("group", "status", "queueOrder");

-- CreateIndex
CREATE INDEX "WaitlistEntry_registeredAt_id_idx" ON "WaitlistEntry"("registeredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_group_queueOrder_key" ON "WaitlistEntry"("group", "queueOrder");

-- CreateIndex
CREATE INDEX "WaitlistOrderChange_entryId_createdAt_idx" ON "WaitlistOrderChange"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "WaitlistOrderChange" ADD CONSTRAINT "WaitlistOrderChange_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Required selections must contain at least one non-null enum value.
ALTER TABLE "WaitlistEntry"
    ALTER COLUMN "badges" SET NOT NULL,
    ALTER COLUMN "swimmingStyles" SET NOT NULL,
    ADD CONSTRAINT "WaitlistEntry_required_text_check"
        CHECK (length(btrim("firstName", E' \t\n\r')) > 0
            AND length(btrim("lastName", E' \t\n\r')) > 0
            AND length(btrim("email", E' \t\n\r')) > 0),
    ADD CONSTRAINT "WaitlistEntry_badges_check"
        CHECK (cardinality("badges") > 0 AND array_position("badges", NULL) IS NULL),
    ADD CONSTRAINT "WaitlistEntry_swimmingStyles_check"
        CHECK (cardinality("swimmingStyles") > 0 AND array_position("swimmingStyles", NULL) IS NULL),
    ADD CONSTRAINT "WaitlistEntry_waiting_assignment_check"
        CHECK (("status" = 'WAITING' AND "group" IS NOT NULL
                AND "queueOrder" IS NOT NULL AND "queueOrder" > 0)
            OR ("status" <> 'WAITING' AND "queueOrder" IS NULL)),
    ADD CONSTRAINT "WaitlistEntry_unassigned_group_check"
        CHECK ("status" <> 'UNASSIGNED' OR "group" IS NULL);

ALTER TABLE "WaitlistOrderChange"
    ADD CONSTRAINT "WaitlistOrderChange_reason_check"
        CHECK (length(btrim("reason", E' \t\n\r')) > 0),
    ADD CONSTRAINT "WaitlistOrderChange_positions_check"
        CHECK ("previousPosition" > 0 AND "newPosition" > 0
            AND "previousPosition" <> "newPosition");

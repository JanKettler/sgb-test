-- CreateTable
CREATE TABLE "WaitlistGroupChange" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "previousGroup" "SwimmingGroup",
    "newGroup" "SwimmingGroup" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistGroupChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistGroupChange_entryId_createdAt_idx" ON "WaitlistGroupChange"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "WaitlistGroupChange" ADD CONSTRAINT "WaitlistGroupChange_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

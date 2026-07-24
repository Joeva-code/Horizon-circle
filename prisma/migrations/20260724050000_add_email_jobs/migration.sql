CREATE TYPE "EmailJobType" AS ENUM ('VERIFICATION');
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "email_jobs" (
    "id" TEXT NOT NULL,
    "type" "EmailJobType" NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_jobs_status_runAt_idx" ON "email_jobs"("status", "runAt");
CREATE INDEX "email_jobs_userId_idx" ON "email_jobs"("userId");
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

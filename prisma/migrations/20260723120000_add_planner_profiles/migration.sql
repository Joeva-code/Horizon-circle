-- CreateTable
CREATE TABLE "planner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "bio" TEXT,
    "preferredEventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planner_profiles_userId_key" ON "planner_profiles"("userId");

-- AddForeignKey
ALTER TABLE "planner_profiles" ADD CONSTRAINT "planner_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing planner accounts should receive a profile as well.
INSERT INTO "planner_profiles" ("id", "userId", "updatedAt")
SELECT gen_random_uuid(), "id", CURRENT_TIMESTAMP
FROM "users"
WHERE "role" = 'PLANNER';

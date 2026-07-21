-- Existing duplicate records must be resolved manually before this migration
-- can add a database-level uniqueness guarantee.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "enquiries"
        GROUP BY "plannerId", "vendorId", "eventType", "eventDate"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce unique enquiries: duplicate records already exist';
    END IF;
END $$;

CREATE UNIQUE INDEX "enquiries_plannerId_vendorId_eventType_eventDate_key"
ON "enquiries"("plannerId", "vendorId", "eventType", "eventDate");

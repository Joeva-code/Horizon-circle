ALTER TABLE "enquiries"
ADD COLUMN "isBookingRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bookingRequestedAt" TIMESTAMP(3),
ADD COLUMN "bookingRespondedAt" TIMESTAMP(3);

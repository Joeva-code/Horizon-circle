-- A Google subject identifier must be linked to at most one EventConnect user.
-- PostgreSQL unique indexes allow multiple NULL provider IDs for local accounts.
CREATE UNIQUE INDEX "users_provider_providerId_key" ON "users"("provider", "providerId");

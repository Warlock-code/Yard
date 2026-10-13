-- Remove cash-payout + legacy GHS-earning models. Credits are a virtual
-- in-app currency with no monetary value — nothing may be withdrawn,
-- transferred, or redeemed for cash. App code no longer reads or writes
-- these tables (schema.prisma already dropped the models), so dropping is
-- safe. Deploy with: npx prisma migrate deploy

-- Drop legacy tables (constraints go with them).
DROP TABLE IF EXISTS "CreditPayout";
DROP TABLE IF EXISTS "Payout";
DROP TABLE IF EXISTS "Earning";

-- Drop payout/KYC columns from User (missedEarnings stays — upgrade nudge).
ALTER TABLE "User" DROP COLUMN IF EXISTS "creditsWithdrawn";
ALTER TABLE "User" DROP COLUMN IF EXISTS "kycStatus";
ALTER TABLE "User" DROP COLUMN IF EXISTS "kycData";
ALTER TABLE "User" DROP COLUMN IF EXISTS "kycSubmittedAt";

-- Drop the now-unused enum.
DROP TYPE IF EXISTS "KycStatus";

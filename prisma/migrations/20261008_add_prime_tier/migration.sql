-- Restore PRIME tier (removed Sep 2026, restored Oct 2026).
-- Adds PRIME to the AccountTier enum. ADD VALUE cannot run inside a
-- transaction block, so if `prisma migrate deploy` fails here, apply with:
--   ALTER TYPE "AccountTier" ADD VALUE IF NOT EXISTS 'PRIME';
ALTER TYPE "AccountTier" ADD VALUE IF NOT EXISTS 'PRIME';

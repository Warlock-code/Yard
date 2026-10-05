-- Cohort (admission year) for per-class feeds. Nullable so existing
-- users and posts keep working untouched; they fall back to the
-- legacy school+program feed until they pick a year.
ALTER TABLE "User" ADD COLUMN "cohortYear" INTEGER;
ALTER TABLE "Post" ADD COLUMN "cohortYear" INTEGER;

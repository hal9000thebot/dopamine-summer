-- AlterTable
ALTER TABLE "LiquidityPosition"
ADD COLUMN "harvestStreakClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "harvestCooldownUntil" TIMESTAMP(3);

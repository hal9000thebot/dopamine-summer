ALTER TABLE "LiquidityPosition"
ADD COLUMN "harvestBribeUnlockUntil" TIMESTAMP(3);

ALTER TABLE "MetaFarmPosition"
ADD COLUMN "harvestBribeUnlockUntil" TIMESTAMP(3);

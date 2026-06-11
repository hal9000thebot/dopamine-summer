-- AlterTable
ALTER TABLE "FakeAssetBalance" ADD COLUMN "streakClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cooldownUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LiquidityPosition" ADD COLUMN "unharvestedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "harvestClicks" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PoolState" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "reserveA" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "reserveB" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "totalLp" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "suppliedCount" INTEGER NOT NULL DEFAULT 0,
    "harvestClicks" INTEGER NOT NULL DEFAULT 0,
    "totalHarvestedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolState_poolId_key" ON "PoolState"("poolId");

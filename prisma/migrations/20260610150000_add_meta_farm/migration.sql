-- AlterTable
ALTER TABLE "ProtocolGameState"
ADD COLUMN "metaFarmLockedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "metaFarmBurnedFake" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "metaFarmLp" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "metaFarmHarvestedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MetaFarmPosition" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "lockedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "burnedFakeAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "lpBalance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "unharvestedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "suppliedCount" INTEGER NOT NULL DEFAULT 0,
    "harvestClicks" INTEGER NOT NULL DEFAULT 0,
    "harvestStreakClicks" INTEGER NOT NULL DEFAULT 0,
    "harvestCooldownUntil" TIMESTAMP(3),
    "lastHarvestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaFarmPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaFarmPosition_walletId_poolId_key" ON "MetaFarmPosition"("walletId", "poolId");

-- AddForeignKey
ALTER TABLE "MetaFarmPosition" ADD CONSTRAINT "MetaFarmPosition_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "GameWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

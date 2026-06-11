-- CreateEnum
CREATE TYPE "FakeAssetSymbol" AS ENUM ('FETH', 'FHYPE', 'FUSDC', 'FUSDT', 'FWBTC');

-- CreateTable
CREATE TABLE "GameWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayAddress" TEXT NOT NULL,
    "faucetClicks" INTEGER NOT NULL DEFAULT 0,
    "panicClicks" INTEGER NOT NULL DEFAULT 0,
    "totalPendingEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "totalClaimedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "totalDumpedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FakeAssetBalance" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "symbol" "FakeAssetSymbol" NOT NULL,
    "balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FakeAssetBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityPosition" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "lpBalance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "pendingEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "suppliedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquidityPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "claimNonce" INTEGER NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "claimHash" TEXT NOT NULL,
    "signature" TEXT,
    "txHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolGameState" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "vibePrice" DECIMAL(38,18) NOT NULL DEFAULT 0.0042,
    "hype" DECIMAL(10,4) NOT NULL DEFAULT 18,
    "jeetPressure" DECIMAL(10,4) NOT NULL DEFAULT 8,
    "totalDumpedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "panicClicks" INTEGER NOT NULL DEFAULT 0,
    "chartPoints" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolGameState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameWallet_address_key" ON "GameWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "FakeAssetBalance_walletId_symbol_key" ON "FakeAssetBalance"("walletId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidityPosition_walletId_poolId_key" ON "LiquidityPosition"("walletId", "poolId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_claimHash_key" ON "RewardClaim"("claimHash");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_walletId_claimNonce_key" ON "RewardClaim"("walletId", "claimNonce");

-- AddForeignKey
ALTER TABLE "FakeAssetBalance" ADD CONSTRAINT "FakeAssetBalance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "GameWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityPosition" ADD CONSTRAINT "LiquidityPosition_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "GameWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "GameWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

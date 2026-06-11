-- AlterTable
ALTER TABLE "GameWallet" ADD COLUMN "totalLotteryWonEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LotteryEpoch" (
    "id" TEXT NOT NULL,
    "epochId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalDumpedEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "totalStEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "prizeEmoji" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "winnerWalletId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotteryEpoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryEntry" (
    "id" TEXT NOT NULL,
    "lotteryEpochId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "stEmojiAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotteryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LotteryEpoch_epochId_key" ON "LotteryEpoch"("epochId");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryEntry_lotteryEpochId_walletId_key" ON "LotteryEntry"("lotteryEpochId", "walletId");

-- AddForeignKey
ALTER TABLE "LotteryEpoch" ADD CONSTRAINT "LotteryEpoch_winnerWalletId_fkey" FOREIGN KEY ("winnerWalletId") REFERENCES "GameWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_lotteryEpochId_fkey" FOREIGN KEY ("lotteryEpochId") REFERENCES "LotteryEpoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "GameWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

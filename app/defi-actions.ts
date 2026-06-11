"use server";

import { FakeAssetSymbol, Prisma } from "@prisma/client";
import { createPublicClient, decodeFunctionData, formatUnits, http, parseUnits, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db/prisma";
import {
  type AssetSymbol,
  type GameSnapshot,
  type LotterySnapshot,
  type MetaFarmSnapshot,
  type OnchainVaultSnapshot,
  type PreparedEmojiClaim,
  calculateDipBoost,
  calculatePoolTvlUsd,
  calculateVibeMove,
  displayAddress,
  EMOJI_CLAIM_TYPES,
  EMOJI_DUMP_VAULT_ABI,
  EMOJI_STAKING_ABI,
  EMOJI_TOKEN_ABI,
  FAUCET_ASSETS,
  getExplorerTxUrl,
  INITIAL_BALANCES,
  INITIAL_CHART_POINTS,
  isWalletAddress,
  META_FARM,
  POOLS,
  STAKING_REWARD_APY,
  STAKING_REWARD_SUPPLY
} from "@/lib/defi/game";

const decimal = (value: number | string) => new Prisma.Decimal(value);
const toNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);

const assetBySymbol = new Map(FAUCET_ASSETS.map((asset) => [asset.symbol, asset]));
const assetByDbSymbol = new Map(FAUCET_ASSETS.map((asset) => [asset.dbSymbol, asset]));
const poolById = new Map(POOLS.map((pool) => [pool.id, pool]));
const DEFAULT_EMOJI_CHAIN_ID = 84532;
const BASE_SEPOLIA_USDC_ADDRESS = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const DEV_BRIBE_TIERS = [
  { amount: 100, unlockMs: 3 * 60 * 60 * 1000, label: "3 hours" },
  { amount: 5, unlockMs: 30 * 60 * 1000, label: "30 minutes" },
  { amount: 1, unlockMs: 5 * 60 * 1000, label: "5 minutes" },
  { amount: 0.5, unlockMs: 60 * 1000, label: "1 minute" }
];
const MIN_DEV_BRIBE_USDC = 0.5;
const FAUCET_CLICKS_BEFORE_COOLDOWN = 10;
const FAUCET_COOLDOWN_MS = 90 * 1000;
const HARVEST_CLICKS_BEFORE_COOLDOWN = 50;
const HARVEST_COOLDOWN_MS = 60 * 1000;
const MAX_HARVEST_ACCRUAL_MINUTES = 12 * 60;
const LOTTERY_EPOCH_MS = 3 * 60 * 60 * 1000;
const STAKING_REWARD_ACCRUAL_CAP_MS = 12 * 60 * 60 * 1000;

function assertWallet(address: string) {
  const normalized = address.trim().toLowerCase();
  if (!isWalletAddress(normalized)) {
    throw new Error("Invalid wallet address.");
  }
  return normalized;
}

function parseChartPoints(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return INITIAL_CHART_POINTS;
  const points = value.map((point) => Number(point)).filter((point) => Number.isFinite(point));
  return points.length ? points : INITIAL_CHART_POINTS;
}

function getClaimConfig() {
  const privateKey = process.env.EMOJI_CLAIM_SIGNER_PRIVATE_KEY;
  const claimContract = process.env.NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS;
  const chainId = Number(process.env.NEXT_PUBLIC_EMOJI_CHAIN_ID ?? DEFAULT_EMOJI_CHAIN_ID);

  if (!privateKey || !claimContract || claimContract === zeroAddress) {
    return null;
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("Invalid EMOJI_CLAIM_SIGNER_PRIVATE_KEY.");
  }

  if (!isWalletAddress(claimContract)) {
    throw new Error("Invalid NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS.");
  }

  return {
    account: privateKeyToAccount(privateKey as `0x${string}`),
    claimContract: claimContract.toLowerCase() as `0x${string}`,
    chainId: Number.isFinite(chainId) ? chainId : DEFAULT_EMOJI_CHAIN_ID
  };
}

function getEmojiChainId() {
  const chainId = Number(process.env.NEXT_PUBLIC_EMOJI_CHAIN_ID ?? DEFAULT_EMOJI_CHAIN_ID);
  return Number.isFinite(chainId) ? chainId : DEFAULT_EMOJI_CHAIN_ID;
}

function getAddressEnv(name: string) {
  const value = process.env[name];
  return value && isWalletAddress(value) && value !== zeroAddress ? (value.toLowerCase() as `0x${string}`) : null;
}

function getDonationConfig() {
  const chainId = getEmojiChainId();
  const donationAddress = getAddressEnv("NEXT_PUBLIC_DEV_DONATION_ADDRESS") ?? getAddressEnv("EMOJI_OWNER_ADDRESS");
  const usdcAddress =
    getAddressEnv("NEXT_PUBLIC_DONATION_USDC_ADDRESS") ??
    (chainId === 84532 ? (BASE_SEPOLIA_USDC_ADDRESS as `0x${string}`) : null);
  return { chainId, donationAddress, usdcAddress };
}

function formatTokenUnits(value: bigint) {
  return Number(formatUnits(value, 18));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRpcRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await fn();
      await sleep(125);
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransient =
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("closed") ||
        message.toLowerCase().includes("timeout");
      if (!isTransient || attempt === 5) break;
      await sleep(500 * attempt);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed: ${message}`);
}

function getDevBribeTier(amount: number) {
  return DEV_BRIBE_TIERS.find((tier) => amount >= tier.amount) ?? null;
}

async function verifyDevBribePayment({
  walletAddress,
  txHash,
  amount
}: {
  walletAddress: `0x${string}`;
  txHash: string;
  amount: number;
}) {
  const cleanTxHash = txHash.trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanTxHash)) throw new Error("Invalid bribe transaction hash.");

  const cleanAmount = Math.max(0, Number(amount));
  const requestedTier = Number.isFinite(cleanAmount) ? getDevBribeTier(cleanAmount) : null;
  if (!requestedTier) throw new Error("Minimum bribe is 0.50 USDC. The dev has standards, barely.");

  const { donationAddress, usdcAddress } = getDonationConfig();
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl || !donationAddress || !usdcAddress) {
    throw new Error("Dev bribe config is missing. Add donation address and USDC token env vars.");
  }

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const [transaction, receipt] = await Promise.all([
    publicClient.getTransaction({ hash: cleanTxHash as `0x${string}` }),
    publicClient.getTransactionReceipt({ hash: cleanTxHash as `0x${string}` })
  ]);

  if (receipt.status !== "success") throw new Error("Bribe tx failed. Cooldown remains emotionally unavailable.");
  if (transaction.from.toLowerCase() !== walletAddress) throw new Error("Bribe tx was not sent by this wallet.");
  if (transaction.to?.toLowerCase() !== usdcAddress) throw new Error("Bribe tx did not go to the configured USDC token.");

  const decoded = decodeFunctionData({
    abi: EMOJI_TOKEN_ABI,
    data: transaction.input
  });
  if (decoded.functionName !== "transfer") throw new Error("Bribe tx was not a USDC transfer.");

  const [recipient, rawAmount] = decoded.args as readonly [`0x${string}`, bigint];
  if (recipient.toLowerCase() !== donationAddress) throw new Error("Bribe tx did not pay the dev address.");
  const paidAmount = Number(formatUnits(rawAmount, 6));
  const paidTier = getDevBribeTier(paidAmount);
  if (!paidTier) throw new Error("Bribe tx was under 0.50 USDC.");

  return {
    paidAmount,
    unlockTier: paidTier,
    unlockUntil: new Date(Date.now() + paidTier.unlockMs)
  };
}

function getLotteryWindow(now = new Date()) {
  const epochId = Math.floor(now.getTime() / LOTTERY_EPOCH_MS);
  const startsAt = new Date(epochId * LOTTERY_EPOCH_MS);
  const endsAt = new Date((epochId + 1) * LOTTERY_EPOCH_MS);
  return { epochId, startsAt, endsAt };
}

async function ensureLotteryEpoch(tx: Prisma.TransactionClient, epochId: number) {
  const startsAt = new Date(epochId * LOTTERY_EPOCH_MS);
  const endsAt = new Date((epochId + 1) * LOTTERY_EPOCH_MS);
  return tx.lotteryEpoch.upsert({
    where: { epochId },
    update: {},
    create: { epochId, startsAt, endsAt }
  });
}

async function accrueStakingRewards(tx: Prisma.TransactionClient, walletId: string, stakedBalance: number, now = new Date()) {
  const wallet = await tx.gameWallet.findUniqueOrThrow({ where: { id: walletId } });
  const elapsedMs = Math.min(
    STAKING_REWARD_ACCRUAL_CAP_MS,
    Math.max(0, now.getTime() - wallet.lastStakingRewardAt.getTime())
  );
  if (stakedBalance <= 0 || elapsedMs <= 0) {
    await tx.gameWallet.update({
      where: { id: walletId },
      data: { lastStakingRewardAt: now }
    });
    return 0;
  }

  const annualReward = stakedBalance * (STAKING_REWARD_APY / 100);
  const reward = annualReward * (elapsedMs / (365 * 24 * 60 * 60 * 1000));
  const remainingBudget = Math.max(0, STAKING_REWARD_SUPPLY - toNumber(wallet.totalStakingRewardEmoji));
  const credited = Math.min(reward, remainingBudget);

  await tx.gameWallet.update({
    where: { id: walletId },
    data: {
      totalPendingEmoji: { increment: decimal(credited) },
      totalStakingRewardEmoji: { increment: decimal(credited) },
      lastStakingRewardAt: now
    }
  });

  return credited;
}

function calculateHarvestableEmoji({
  position,
  pool,
  dipBoost,
  now
}: {
  position: {
    lpBalance: Prisma.Decimal;
    unharvestedEmoji: Prisma.Decimal;
    lastHarvestAt: Date;
  };
  pool: { rewardRate: number };
  dipBoost: number;
  now: Date;
}) {
  const lpBalance = toNumber(position.lpBalance);
  if (lpBalance <= 0) return toNumber(position.unharvestedEmoji);

  const elapsedMinutes = Math.min(
    MAX_HARVEST_ACCRUAL_MINUTES,
    Math.max(0, (now.getTime() - position.lastHarvestAt.getTime()) / 60_000)
  );
  const accrued = elapsedMinutes * pool.rewardRate * dipBoost * lpBalance;
  return toNumber(position.unharvestedEmoji) + accrued;
}

function calculateHarvestClickAmount() {
  return 1;
}

function calculateMetaHarvestableEmoji({
  position,
  dipBoost,
  now
}: {
  position: {
    lpBalance: Prisma.Decimal;
    unharvestedEmoji: Prisma.Decimal;
    lastHarvestAt: Date;
  };
  dipBoost: number;
  now: Date;
}) {
  const lpBalance = toNumber(position.lpBalance);
  if (lpBalance <= 0) return toNumber(position.unharvestedEmoji);
  const elapsedMinutes = Math.min(
    MAX_HARVEST_ACCRUAL_MINUTES,
    Math.max(0, (now.getTime() - position.lastHarvestAt.getTime()) / 60_000)
  );
  return toNumber(position.unharvestedEmoji) + elapsedMinutes * META_FARM.rewardRate * dipBoost * lpBalance;
}

async function metaFarmSnapshotForWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
  protocol: { jeetPressure: Prisma.Decimal; metaFarmHarvestedEmoji: Prisma.Decimal; metaFarmLockedEmoji: Prisma.Decimal; metaFarmBurnedFake: Prisma.Decimal; metaFarmLp: Prisma.Decimal },
  now = new Date()
): Promise<MetaFarmSnapshot> {
  const position = await tx.metaFarmPosition.findUnique({
    where: {
      walletId_poolId: {
        walletId,
        poolId: META_FARM.poolId
      }
    }
  });
  const dipBoost = calculateDipBoost(toNumber(protocol.jeetPressure));
  const remainingRewards = Math.max(0, META_FARM.rewardAllocation - toNumber(protocol.metaFarmHarvestedEmoji));
  const accrued = position ? calculateMetaHarvestableEmoji({ position, dipBoost, now }) : 0;
  const lpBalance = toNumber(position?.lpBalance);
  const cooldownActive = position?.harvestCooldownUntil ? position.harvestCooldownUntil > now : false;
  const bribeUnlockActive = position?.harvestBribeUnlockUntil ? position.harvestBribeUnlockUntil > now : false;

  return {
    poolId: META_FARM.poolId,
    name: META_FARM.name,
    pair: META_FARM.pair,
    vibe: META_FARM.vibe,
    requiredEmoji: META_FARM.requiredEmoji,
    requiredFakeSymbol: META_FARM.requiredFakeSymbol,
    requiredFakeAmount: META_FARM.requiredFakeAmount,
    rewardAllocationEmoji: META_FARM.rewardAllocation,
    remainingRewardsEmoji: remainingRewards,
    rewardRate: META_FARM.rewardRate,
    baseApy: META_FARM.baseApy,
    lockedEmoji: toNumber(position?.lockedEmoji),
    burnedFakeAmount: toNumber(position?.burnedFakeAmount),
    lpBalance,
    totalLockedEmoji: toNumber(protocol.metaFarmLockedEmoji),
    totalBurnedFakeAmount: toNumber(protocol.metaFarmBurnedFake),
    totalLp: toNumber(protocol.metaFarmLp),
    totalHarvestedEmoji: toNumber(protocol.metaFarmHarvestedEmoji),
    unharvestedEmoji: Math.min(accrued, remainingRewards),
    unharvestedEmojiPerSecond: Math.min((lpBalance * META_FARM.rewardRate * dipBoost) / 60, remainingRewards),
    harvestClicks: position?.harvestClicks ?? 0,
    harvestClicksUntilCooldown: cooldownActive ? 0 : Math.max(0, HARVEST_CLICKS_BEFORE_COOLDOWN - (position?.harvestStreakClicks ?? 0)),
    harvestCooldownUntil: cooldownActive ? position?.harvestCooldownUntil?.toISOString() ?? null : null,
    harvestBribeUnlockUntil: bribeUnlockActive ? position?.harvestBribeUnlockUntil?.toISOString() ?? null : null
  };
}

async function signClaimVoucher({
  wallet,
  amount,
  nonce,
  deadline
}: {
  wallet: string;
  amount: number;
  nonce: number;
  deadline: number;
}): Promise<PreparedEmojiClaim | null> {
  const config = getClaimConfig();
  if (!config) return null;

  const amountWei = parseUnits(String(amount), 18);
  const message = {
    wallet: wallet as `0x${string}`,
    amount: amountWei,
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  };
  const signature = await config.account.signTypedData({
    domain: {
      name: "DOPAMINE Claim",
      version: "1",
      chainId: config.chainId,
      verifyingContract: config.claimContract
    },
    types: EMOJI_CLAIM_TYPES,
    primaryType: "Claim",
    message
  });

  return {
    wallet: wallet as `0x${string}`,
    amount: String(amount),
    amountWei: amountWei.toString(),
    nonce: String(nonce),
    deadline: String(deadline),
    claimHash: `${wallet}:${nonce}:${amountWei.toString()}:${deadline}`,
    signature,
    claimContract: config.claimContract,
    chainId: config.chainId
  };
}

async function ensureProtocolState(tx: Prisma.TransactionClient) {
  return tx.protocolGameState.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      chartPoints: INITIAL_CHART_POINTS
    }
  });
}

async function ensurePoolState(tx: Prisma.TransactionClient, poolId: string) {
  const pool = poolById.get(poolId);
  if (!pool) throw new Error("Unknown pool.");

  return tx.poolState.upsert({
    where: { poolId },
    update: {},
    create: {
      poolId,
      pair: pool.pair
    }
  });
}

async function ensureWallet(tx: Prisma.TransactionClient, address: string) {
  const wallet = await tx.gameWallet.upsert({
    where: { address },
    update: {},
    create: {
      address,
      displayAddress: displayAddress(address)
    }
  });

  await Promise.all(
    FAUCET_ASSETS.map((asset) =>
      tx.fakeAssetBalance.upsert({
        where: {
          walletId_symbol: {
            walletId: wallet.id,
            symbol: asset.dbSymbol as FakeAssetSymbol
          }
        },
        update: {},
        create: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      })
    )
  );

  return wallet;
}

async function snapshotForWallet(tx: Prisma.TransactionClient, walletId: string, log: string): Promise<GameSnapshot> {
  await Promise.all(POOLS.map((pool) => ensurePoolState(tx, pool.id)));

  const [wallet, balances, positions, allPositions, poolStates, latestClaim, recentClaims, protocol] = await Promise.all([
    tx.gameWallet.findUniqueOrThrow({ where: { id: walletId } }),
    tx.fakeAssetBalance.findMany({ where: { walletId } }),
    tx.liquidityPosition.findMany({ where: { walletId } }),
    tx.liquidityPosition.findMany(),
    tx.poolState.findMany(),
    tx.rewardClaim.findMany({ where: { walletId }, orderBy: { claimNonce: "desc" }, take: 1 }),
    tx.rewardClaim.findMany({ where: { walletId }, orderBy: { claimNonce: "desc" }, take: 5 }),
    ensureProtocolState(tx)
  ]);

  const fakeBalances = { ...INITIAL_BALANCES };
  balances.forEach((balance) => {
    const asset = assetByDbSymbol.get(balance.symbol);
    if (asset) {
      fakeBalances[asset.symbol] = toNumber(balance.balance);
    }
  });

  const lpBalances: Record<string, number> = {};
  const positionByPool = new Map(positions.map((position) => [position.poolId, position]));
  positions.forEach((position) => {
    lpBalances[position.poolId] = toNumber(position.lpBalance);
  });

  const nowMs = Date.now();
  const faucetStatus = Object.fromEntries(
    FAUCET_ASSETS.map((asset) => [
      asset.symbol,
      {
        streakClicks: 0,
        clicksUntilCooldown: FAUCET_CLICKS_BEFORE_COOLDOWN,
        cooldownUntil: null,
        bribeUnlockUntil: null
      }
    ])
  ) as GameSnapshot["faucetStatus"];
  balances.forEach((balance) => {
    const asset = assetByDbSymbol.get(balance.symbol);
    if (!asset) return;
    const cooldownActive = balance.cooldownUntil ? balance.cooldownUntil.getTime() > nowMs : false;
    const bribeUnlockActive = balance.bribeUnlockUntil ? balance.bribeUnlockUntil.getTime() > nowMs : false;
    faucetStatus[asset.symbol] = {
      streakClicks: balance.streakClicks,
      clicksUntilCooldown: cooldownActive ? 0 : Math.max(0, FAUCET_CLICKS_BEFORE_COOLDOWN - balance.streakClicks),
      cooldownUntil: cooldownActive ? balance.cooldownUntil?.toISOString() ?? null : null,
      bribeUnlockUntil: bribeUnlockActive ? balance.bribeUnlockUntil?.toISOString() ?? null : null
    };
  });

  const poolStateSnapshots: GameSnapshot["poolStates"] = {};
  const protocolDipBoost = calculateDipBoost(toNumber(protocol.jeetPressure));
  const snapshotNow = new Date();
  poolStates.forEach((poolState) => {
    const position = positionByPool.get(poolState.poolId);
    const pool = poolById.get(poolState.poolId);
    const reserveA = toNumber(poolState.reserveA);
    const reserveB = toNumber(poolState.reserveB);
    const rewardAllocation = pool?.rewardAllocation ?? 0;
    const totalHarvestedEmoji = toNumber(poolState.totalHarvestedEmoji);
    const poolPositions = allPositions.filter((candidate) => candidate.poolId === poolState.poolId);
    const totalAccruedEmoji = pool
      ? poolPositions.reduce(
          (total, candidate) =>
            total + calculateHarvestableEmoji({ position: candidate, pool, dipBoost: protocolDipBoost, now: snapshotNow }),
          0
        )
      : 0;
    const totalEmittedEmoji = Math.min(rewardAllocation, totalHarvestedEmoji + totalAccruedEmoji);
    const remainingRewards = Math.max(0, rewardAllocation - totalEmittedEmoji);
    const accruedEmoji = position && pool ? calculateHarvestableEmoji({ position, pool, dipBoost: protocolDipBoost, now: snapshotNow }) : 0;
    const walletAccrualPerSecond =
      position && pool ? (toNumber(position.lpBalance) * pool.rewardRate * protocolDipBoost) / 60 : 0;
    const poolEmissionPerSecond = pool ? (toNumber(poolState.totalLp) * pool.rewardRate * protocolDipBoost) / 60 : 0;
    const cooldownActive = position?.harvestCooldownUntil ? position.harvestCooldownUntil > snapshotNow : false;
    const bribeUnlockActive = position?.harvestBribeUnlockUntil ? position.harvestBribeUnlockUntil > snapshotNow : false;
    poolStateSnapshots[poolState.poolId] = {
      reserveA,
      reserveB,
      tvlUsd: pool ? calculatePoolTvlUsd(pool, reserveA, reserveB) : 0,
      totalLp: toNumber(poolState.totalLp),
      suppliedCount: poolState.suppliedCount,
      harvestClicks: poolState.harvestClicks,
      totalHarvestedEmoji,
      totalEmittedEmoji,
      emittedEmojiPerSecond: Math.min(poolEmissionPerSecond, remainingRewards),
      remainingRewardsEmoji: remainingRewards,
      rewardAllocationEmoji: rewardAllocation,
      unharvestedEmoji: Math.min(accruedEmoji, remainingRewards),
      unharvestedEmojiPerSecond: Math.min(walletAccrualPerSecond, remainingRewards),
      snapshotAt: snapshotNow.toISOString(),
      harvestStreakClicks: cooldownActive ? HARVEST_CLICKS_BEFORE_COOLDOWN : position?.harvestStreakClicks ?? 0,
      harvestClicksUntilCooldown: cooldownActive
        ? 0
        : Math.max(0, HARVEST_CLICKS_BEFORE_COOLDOWN - (position?.harvestStreakClicks ?? 0)),
      harvestCooldownUntil: cooldownActive ? position?.harvestCooldownUntil?.toISOString() ?? null : null,
      harvestBribeUnlockUntil: bribeUnlockActive ? position?.harvestBribeUnlockUntil?.toISOString() ?? null : null
    };
  });

  return {
    wallet: wallet.address,
    displayAddress: wallet.displayAddress,
    balances: fakeBalances,
    lpBalances,
    poolStates: poolStateSnapshots,
    faucetStatus,
    claimHistory: recentClaims.map((claim) => ({
      id: claim.id,
      nonce: claim.claimNonce,
      amount: toNumber(claim.amount),
      txHash: claim.txHash,
      explorerUrl: getExplorerTxUrl(getEmojiChainId(), claim.txHash),
      status: claim.txHash ? "submitted" : "prepared",
      createdAt: claim.createdAt.toISOString()
    })),
    claimedEmoji: toNumber(wallet.totalClaimedEmoji),
    pendingEmoji: toNumber(wallet.totalPendingEmoji),
    faucetClicks: wallet.faucetClicks,
    claimNonce: (latestClaim[0]?.claimNonce ?? 0) + 1,
    hype: toNumber(protocol.hype),
    jeetPressure: toNumber(protocol.jeetPressure),
    vibePrice: toNumber(protocol.vibePrice),
    chartPoints: parseChartPoints(protocol.chartPoints),
    dumpedEmoji: toNumber(wallet.totalDumpedEmoji),
    panicClicks: wallet.panicClicks,
    metaFarm: await metaFarmSnapshotForWallet(tx, wallet.id, protocol, snapshotNow),
    log
  };
}

async function snapshotWithPreservedPoolStates(tx: Prisma.TransactionClient, walletId: string, log: string): Promise<GameSnapshot> {
  return {
    ...(await snapshotForWallet(tx, walletId, log)),
    preservePoolStates: true
  };
}

async function settleEndedLotteryEpochs(tx: Prisma.TransactionClient, now = new Date()) {
  const endedEpochs = await tx.lotteryEpoch.findMany({
    where: {
      endsAt: { lte: now },
      settledAt: null
    },
    include: {
      entries: {
        include: { wallet: true },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { epochId: "asc" },
    take: 12
  });

  for (const epoch of endedEpochs) {
    const prizeEmoji = toNumber(epoch.totalDumpedEmoji);
    const totalStEmoji = toNumber(epoch.totalStEmoji);
    if (prizeEmoji <= 0 || totalStEmoji <= 0 || epoch.entries.length === 0) {
      await tx.lotteryEpoch.update({
        where: { id: epoch.id },
        data: { settledAt: now }
      });
      continue;
    }

    const seed = Array.from(`${epoch.epochId}:${prizeEmoji}:${totalStEmoji}`).reduce(
      (total, char) => (total * 31 + char.charCodeAt(0)) % 1_000_000_007,
      7
    );
    const winningPoint = (seed / 1_000_000_007) * totalStEmoji;
    let cursor = 0;
    const winnerEntry =
      epoch.entries.find((entry) => {
        cursor += toNumber(entry.stEmojiAmount);
        return cursor >= winningPoint;
      }) ?? epoch.entries[epoch.entries.length - 1];

    await tx.lotteryEpoch.update({
      where: { id: epoch.id },
      data: {
        winnerWalletId: winnerEntry.walletId,
        prizeEmoji: decimal(prizeEmoji),
        settledAt: now
      }
    });
    await tx.gameWallet.update({
      where: { id: winnerEntry.walletId },
      data: {
        totalPendingEmoji: { increment: decimal(prizeEmoji) },
        totalLotteryWonEmoji: { increment: decimal(prizeEmoji) }
      }
    });
  }
}

async function lotterySnapshotForWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
  stakedBalance: number,
  now = new Date()
): Promise<LotterySnapshot> {
  await settleEndedLotteryEpochs(tx, now);
  const { epochId, startsAt, endsAt } = getLotteryWindow(now);
  const epoch = await ensureLotteryEpoch(tx, epochId);
  const [entry, previousEpoch] = await Promise.all([
    tx.lotteryEntry.findUnique({
      where: {
        lotteryEpochId_walletId: {
          lotteryEpochId: epoch.id,
          walletId
        }
      }
    }),
    tx.lotteryEpoch.findFirst({
      where: {
        epochId: { lt: epochId },
        settledAt: { not: null }
      },
      include: { winner: true },
      orderBy: { epochId: "desc" }
    })
  ]);
  const deposited = toNumber(entry?.stEmojiAmount);

  return {
    epochId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    secondsRemaining: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000)),
    totalDumpedEmoji: toNumber(epoch.totalDumpedEmoji),
    totalStEmoji: toNumber(epoch.totalStEmoji),
    yourStEmojiDeposited: deposited,
    yourStEmojiAvailable: Math.max(0, stakedBalance - deposited),
    previousEpochId: previousEpoch?.epochId ?? null,
    previousPrizeEmoji: toNumber(previousEpoch?.prizeEmoji),
    previousWinner: previousEpoch?.winner?.displayAddress ?? null,
    previousWonByYou: previousEpoch?.winnerWalletId === walletId
  };
}

async function moveProtocol(tx: Prisma.TransactionClient, hypeDelta: number, jeetDelta: number) {
  const protocol = await ensureProtocolState(tx);
  const [wallets, poolAggregate, poolCounters, walletAggregate] = await Promise.all([
    tx.gameWallet.count(),
    tx.poolState.aggregate({
      _sum: {
        totalLp: true
      }
    }),
    tx.poolState.aggregate({
      _sum: {
        harvestClicks: true
      }
    }),
    tx.gameWallet.aggregate({
      _sum: {
        faucetClicks: true,
        totalClaimedEmoji: true,
        totalDumpedEmoji: true
      }
    })
  ]);
  const next = calculateVibeMove({
    hype: toNumber(protocol.hype),
    jeetPressure: toNumber(protocol.jeetPressure),
    vibePrice: toNumber(protocol.vibePrice),
    chartPoints: parseChartPoints(protocol.chartPoints),
    hypeDelta,
    jeetDelta,
    activity: {
      wallets,
      totalLp: toNumber(poolAggregate._sum.totalLp),
      harvestClicks: poolCounters._sum.harvestClicks ?? 0,
      faucetClicks: walletAggregate._sum.faucetClicks ?? 0,
      claimedEmoji: toNumber(walletAggregate._sum.totalClaimedEmoji),
      dumpedEmoji: toNumber(walletAggregate._sum.totalDumpedEmoji)
    }
  });

  return tx.protocolGameState.update({
    where: { id: "global" },
    data: {
      hype: decimal(next.hype),
      jeetPressure: decimal(next.jeetPressure),
      vibePrice: decimal(next.vibePrice),
      chartPoints: next.chartPoints
    }
  });
}

export async function loadGameAction(address: string) {
  const walletAddress = assertWallet(address);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    await moveProtocol(tx, 7, -1);
    return snapshotForWallet(tx, wallet.id, "Wallet connected. Fake balances are persistent now; claim time is still the only Base tx.");
  });
}

export async function mintFakeAssetAction(address: string, symbol: AssetSymbol) {
  const walletAddress = assertWallet(address);
  const asset = assetBySymbol.get(symbol);
  if (!asset) throw new Error("Unknown fake asset.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const current = await tx.fakeAssetBalance.findUniqueOrThrow({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      }
    });
    const now = new Date();
    const bribeUnlockActive = current.bribeUnlockUntil ? current.bribeUnlockUntil > now : false;
    if (!bribeUnlockActive && current.cooldownUntil && current.cooldownUntil > now) {
      const seconds = Math.ceil((current.cooldownUntil.getTime() - now.getTime()) / 1000);
      return snapshotForWallet(tx, wallet.id, `${symbol} faucet is cooling down for ${seconds}s. The button needs to miss you first.`);
    }

    const nextStreak = current.streakClicks + 1;
    const triggersCooldown = nextStreak >= FAUCET_CLICKS_BEFORE_COOLDOWN;
    await tx.fakeAssetBalance.update({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      },
      data: {
        balance: { increment: decimal(asset.amount) },
        clicks: { increment: 1 },
        streakClicks: triggersCooldown ? 0 : nextStreak,
        cooldownUntil: triggersCooldown ? new Date(now.getTime() + FAUCET_COOLDOWN_MS) : null
      }
    });
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: { faucetClicks: { increment: 1 } }
    });
    await moveProtocol(tx, 0.6, -0.1);
    return snapshotForWallet(
      tx,
      wallet.id,
      triggersCooldown
        ? `Minted ${asset.amount} ${symbol}. That was click #${FAUCET_CLICKS_BEFORE_COOLDOWN}; ${symbol} faucet now cools down for 90s.`
        : `Minted ${asset.amount} ${symbol}. ${FAUCET_CLICKS_BEFORE_COOLDOWN - nextStreak} clicks before this faucet overheats.`
    );
  });
}

export async function recordFaucetBribeAction(address: string, symbol: AssetSymbol, txHash: string, amount: number) {
  const walletAddress = assertWallet(address) as `0x${string}`;
  const asset = assetBySymbol.get(symbol);
  if (!asset) throw new Error("Unknown fake asset.");

  const { paidAmount, unlockTier, unlockUntil } = await verifyDevBribePayment({ walletAddress, txHash, amount });

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    await tx.fakeAssetBalance.update({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      },
      data: {
        bribeUnlockUntil: unlockUntil,
        streakClicks: 0
      }
    });
    await moveProtocol(tx, 1.5, -0.2);
    return snapshotForWallet(
      tx,
      wallet.id,
      `Dev accepted ${paidAmount} USDC. ${symbol} faucet unlocked for ${unlockTier.label}. Capitalism remains undefeated.`
    );
  });
}

export async function recordHarvestBribeAction(address: string, targetId: string, txHash: string, amount: number) {
  const walletAddress = assertWallet(address) as `0x${string}`;
  const pool = poolById.get(targetId);
  const isMetaFarm = targetId === META_FARM.poolId;
  if (!pool && !isMetaFarm) throw new Error("Unknown harvest target.");

  const { paidAmount, unlockTier, unlockUntil } = await verifyDevBribePayment({ walletAddress, txHash, amount });

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    if (isMetaFarm) {
      await tx.metaFarmPosition.update({
        where: {
          walletId_poolId: {
            walletId: wallet.id,
            poolId: META_FARM.poolId
          }
        },
        data: {
          harvestBribeUnlockUntil: unlockUntil,
          harvestStreakClicks: 0
        }
      });
      await moveProtocol(tx, 1.5, -0.2);
      return snapshotForWallet(
        tx,
        wallet.id,
        `Dev accepted ${paidAmount} USDC. Recursive harvest unlocked for ${unlockTier.label}. The reactor has been compromised.`
      );
    }

    await tx.liquidityPosition.update({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: targetId
        }
      },
      data: {
        harvestBribeUnlockUntil: unlockUntil,
        harvestStreakClicks: 0
      }
    });
    await moveProtocol(tx, 1.5, -0.2);
    return snapshotForWallet(
      tx,
      wallet.id,
      `Dev accepted ${paidAmount} USDC. ${pool?.pair ?? "Harvest"} unlocked for ${unlockTier.label}. Manual labor has been privatized.`
    );
  });
}

export async function supplyPoolAction(address: string, poolId: string) {
  const walletAddress = assertWallet(address);
  const pool = poolById.get(poolId);
  if (!pool) throw new Error("Unknown pool.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const balances = await tx.fakeAssetBalance.findMany({ where: { walletId: wallet.id } });
    const bySymbol = new Map(balances.map((balance) => [balance.symbol, balance]));

    const missingAsset = Object.entries(pool.recipe).find(([symbol, amount]) => {
      const asset = assetBySymbol.get(symbol as AssetSymbol);
      if (!asset) return true;
      return toNumber(bySymbol.get(asset.dbSymbol as FakeAssetSymbol)?.balance) < amount;
    });

    if (missingAsset) {
      return snapshotWithPreservedPoolStates(tx, wallet.id, `Need ${missingAsset[1]} ${missingAsset[0]}. The faucet buttons await your commitment.`);
    }

    await Promise.all(
      Object.entries(pool.recipe).map(([symbol, amount]) => {
        const asset = assetBySymbol.get(symbol as AssetSymbol);
        if (!asset) throw new Error("Unknown recipe asset.");
        return tx.fakeAssetBalance.update({
          where: {
            walletId_symbol: {
              walletId: wallet.id,
              symbol: asset.dbSymbol as FakeAssetSymbol
            }
          },
          data: {
            balance: { decrement: decimal(amount) }
          }
        });
      })
    );

    const protocol = await ensureProtocolState(tx);
    const poolState = await ensurePoolState(tx, pool.id);
    const dipBoost = calculateDipBoost(toNumber(protocol.jeetPressure));
    const [firstRecipeAmount, secondRecipeAmount] = Object.values(pool.recipe);
    const existingPosition = await tx.liquidityPosition.findUnique({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: pool.id
        }
      }
    });
    const now = new Date();
    const accruedBeforeSupply = existingPosition
      ? calculateHarvestableEmoji({ position: existingPosition, pool, dipBoost, now })
      : 0;

    await tx.liquidityPosition.upsert({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: pool.id
        }
      },
      update: {
        lpBalance: { increment: decimal(1) },
        unharvestedEmoji: decimal(accruedBeforeSupply),
        suppliedCount: { increment: 1 },
        lastHarvestAt: now
      },
      create: {
        walletId: wallet.id,
        poolId: pool.id,
        pair: pool.pair,
        lpBalance: decimal(1),
        unharvestedEmoji: decimal(0),
        suppliedCount: 1,
        lastHarvestAt: now
      }
    });
    await tx.poolState.update({
      where: { id: poolState.id },
      data: {
        reserveA: { increment: decimal(firstRecipeAmount ?? 0) },
        reserveB: { increment: decimal(secondRecipeAmount ?? 0) },
        totalLp: { increment: decimal(1) },
        suppliedCount: { increment: 1 }
      }
    });
    await moveProtocol(tx, 4.5, -1.2);

    return snapshotForWallet(tx, wallet.id, `Supplied ${pool.pair}, minted 1 fake LP. This position now accrues DOPAMINE over time; keep clicking harvest like it is 2020.`);
  });
}

export async function harvestPoolAction(address: string, poolId: string) {
  const walletAddress = assertWallet(address);
  const pool = poolById.get(poolId);
  if (!pool) throw new Error("Unknown pool.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const position = await tx.liquidityPosition.findUnique({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: pool.id
        }
      }
    });

    if (!position || toNumber(position.lpBalance) <= 0) {
      return snapshotWithPreservedPoolStates(tx, wallet.id, `Supply ${pool.pair} before harvesting. The farm refuses imaginary labor.`);
    }

    const protocol = await ensureProtocolState(tx);
    const dipBoost = calculateDipBoost(toNumber(protocol.jeetPressure));
    const now = new Date();
    const harvestBribeUnlockActive = position.harvestBribeUnlockUntil ? position.harvestBribeUnlockUntil > now : false;
    if (!harvestBribeUnlockActive && position.harvestCooldownUntil && position.harvestCooldownUntil > now) {
      const seconds = Math.ceil((position.harvestCooldownUntil.getTime() - now.getTime()) / 1000);
      return snapshotWithPreservedPoolStates(tx, wallet.id, `${pool.pair} harvest is cooling down for ${seconds}s. The farm hands are unionizing.`);
    }

    const harvestable = calculateHarvestableEmoji({ position, pool, dipBoost, now });
    const poolState = await ensurePoolState(tx, pool.id);
    const remainingRewards = Math.max(0, pool.rewardAllocation - toNumber(poolState.totalHarvestedEmoji));
    const payableHarvestable = Math.min(harvestable, remainingRewards);

    if (remainingRewards <= 0) {
      return snapshotWithPreservedPoolStates(tx, wallet.id, `${pool.pair} rewards are fully emitted. The farm is now vintage.`);
    }

    if (payableHarvestable < 0.25) {
      return snapshotWithPreservedPoolStates(tx, wallet.id, `${pool.pair} is still accruing. Give it a moment, then click harvest again.`);
    }

    const perClick = calculateHarvestClickAmount();
    const harvested = Math.min(payableHarvestable, perClick);
    const nextHarvestStreak = position.harvestStreakClicks + 1;
    const triggersCooldown = nextHarvestStreak >= HARVEST_CLICKS_BEFORE_COOLDOWN;

    await tx.liquidityPosition.update({
      where: { id: position.id },
      data: {
        pendingEmoji: { increment: decimal(harvested) },
        unharvestedEmoji: decimal(Math.max(0, harvestable - harvested)),
        harvestClicks: { increment: 1 },
        harvestStreakClicks: triggersCooldown ? 0 : nextHarvestStreak,
        harvestCooldownUntil: triggersCooldown ? new Date(now.getTime() + HARVEST_COOLDOWN_MS) : null,
        lastHarvestAt: now
      }
    });
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalPendingEmoji: { increment: decimal(harvested) }
      }
    });
    await tx.poolState.update({
      where: { id: poolState.id },
      data: {
        harvestClicks: { increment: 1 },
        totalHarvestedEmoji: { increment: decimal(harvested) }
      }
    });
    await moveProtocol(tx, 1.2, -0.3);

    return snapshotForWallet(
      tx,
      wallet.id,
      triggersCooldown
        ? `Harvested ${Number(harvested.toFixed(4))} DOPAMINE from ${pool.pair}. That was click #${HARVEST_CLICKS_BEFORE_COOLDOWN}; harvest now cools down for 60s.`
        : `Harvested ${Number(harvested.toFixed(4))} DOPAMINE from ${pool.pair}. ${HARVEST_CLICKS_BEFORE_COOLDOWN - nextHarvestStreak} clicks before the 60s timeout.`
    );
  });
}

export async function recordMetaFarmSupplyAction(address: string, txHash: string) {
  const walletAddress = assertWallet(address);
  const cleanTxHash = txHash.trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanTxHash)) throw new Error("Invalid meta farm transaction hash.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const asset = assetBySymbol.get(META_FARM.requiredFakeSymbol);
    if (!asset) throw new Error("Meta farm fake asset is misconfigured.");
    const fakeBalance = await tx.fakeAssetBalance.findUniqueOrThrow({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      }
    });
    if (toNumber(fakeBalance.balance) < META_FARM.requiredFakeAmount) {
      return snapshotForWallet(tx, wallet.id, `Need ${META_FARM.requiredFakeAmount} ${META_FARM.requiredFakeSymbol}. The reactor refuses undercollateralized nonsense.`);
    }

    const protocol = await ensureProtocolState(tx);
    const existingPosition = await tx.metaFarmPosition.findUnique({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: META_FARM.poolId
        }
      }
    });
    const now = new Date();
    const accruedBeforeSupply = existingPosition
      ? calculateMetaHarvestableEmoji({ position: existingPosition, dipBoost: calculateDipBoost(toNumber(protocol.jeetPressure)), now })
      : 0;

    await tx.fakeAssetBalance.update({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol: asset.dbSymbol as FakeAssetSymbol
        }
      },
      data: {
        balance: { decrement: decimal(META_FARM.requiredFakeAmount) }
      }
    });
    await tx.metaFarmPosition.upsert({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: META_FARM.poolId
        }
      },
      update: {
        lockedEmoji: { increment: decimal(META_FARM.requiredEmoji) },
        burnedFakeAmount: { increment: decimal(META_FARM.requiredFakeAmount) },
        lpBalance: { increment: decimal(1) },
        unharvestedEmoji: decimal(accruedBeforeSupply),
        suppliedCount: { increment: 1 },
        lastHarvestAt: now
      },
      create: {
        walletId: wallet.id,
        poolId: META_FARM.poolId,
        lockedEmoji: decimal(META_FARM.requiredEmoji),
        burnedFakeAmount: decimal(META_FARM.requiredFakeAmount),
        lpBalance: decimal(1),
        lastHarvestAt: now
      }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: {
        metaFarmLockedEmoji: { increment: decimal(META_FARM.requiredEmoji) },
        metaFarmBurnedFake: { increment: decimal(META_FARM.requiredFakeAmount) },
        metaFarmLp: { increment: decimal(1) }
      }
    });
    await moveProtocol(tx, 6, 4);

    return snapshotForWallet(tx, wallet.id, `Fed ${META_FARM.requiredEmoji} real DOPAMINE and ${META_FARM.requiredFakeAmount} ${META_FARM.requiredFakeSymbol} into the Recursive Yield Reactor.`);
  });
}

export async function harvestMetaFarmAction(address: string) {
  const walletAddress = assertWallet(address);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const position = await tx.metaFarmPosition.findUnique({
      where: {
        walletId_poolId: {
          walletId: wallet.id,
          poolId: META_FARM.poolId
        }
      }
    });
    if (!position || toNumber(position.lpBalance) <= 0) {
      return snapshotForWallet(tx, wallet.id, "Enter the Meta Farm before harvesting recursive yield.");
    }

    const protocol = await ensureProtocolState(tx);
    const now = new Date();
    const harvestBribeUnlockActive = position.harvestBribeUnlockUntil ? position.harvestBribeUnlockUntil > now : false;
    if (!harvestBribeUnlockActive && position.harvestCooldownUntil && position.harvestCooldownUntil > now) {
      const seconds = Math.ceil((position.harvestCooldownUntil.getTime() - now.getTime()) / 1000);
      return snapshotForWallet(tx, wallet.id, `Meta farm is cooling down for ${seconds}s. The recursion needs garbage collection.`);
    }

    const harvestable = calculateMetaHarvestableEmoji({
      position,
      dipBoost: calculateDipBoost(toNumber(protocol.jeetPressure)),
      now
    });
    const remainingRewards = Math.max(0, META_FARM.rewardAllocation - toNumber(protocol.metaFarmHarvestedEmoji));
    const payableHarvestable = Math.min(harvestable, remainingRewards);
    if (remainingRewards <= 0) {
      return snapshotForWallet(tx, wallet.id, "The Recursive Yield Reactor has emitted its last nonsense token.");
    }
    if (payableHarvestable < 0.25) {
      return snapshotForWallet(tx, wallet.id, "Recursive yield is still compiling. Give it a moment.");
    }

    const harvested = Math.min(payableHarvestable, calculateHarvestClickAmount());
    const nextHarvestStreak = position.harvestStreakClicks + 1;
    const triggersCooldown = nextHarvestStreak >= HARVEST_CLICKS_BEFORE_COOLDOWN;

    await tx.metaFarmPosition.update({
      where: { id: position.id },
      data: {
        unharvestedEmoji: decimal(Math.max(0, harvestable - harvested)),
        harvestClicks: { increment: 1 },
        harvestStreakClicks: triggersCooldown ? 0 : nextHarvestStreak,
        harvestCooldownUntil: triggersCooldown ? new Date(now.getTime() + HARVEST_COOLDOWN_MS) : null,
        lastHarvestAt: now
      }
    });
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalPendingEmoji: { increment: decimal(harvested) }
      }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: {
        metaFarmHarvestedEmoji: { increment: decimal(harvested) }
      }
    });
    await moveProtocol(tx, 2.5, 1.5);

    return snapshotForWallet(
      tx,
      wallet.id,
      triggersCooldown
        ? `Harvested 1 recursive DOPAMINE. That was click #${HARVEST_CLICKS_BEFORE_COOLDOWN}; reactor timeout engaged.`
        : `Harvested 1 recursive DOPAMINE. ${HARVEST_CLICKS_BEFORE_COOLDOWN - nextHarvestStreak} clicks before the reactor sulks.`
    );
  });
}

export async function prepareClaimAction(address: string) {
  const walletAddress = assertWallet(address);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const pendingEmoji = toNumber(wallet.totalPendingEmoji);
    if (pendingEmoji <= 0) {
      return snapshotForWallet(tx, wallet.id, "No pending DOPAMINE yet. Farm first, claim later, question everything.");
    }

    const lastClaim = await tx.rewardClaim.findFirst({
      where: { walletId: wallet.id },
      orderBy: { claimNonce: "desc" }
    });
    const claimNonce = (lastClaim?.claimNonce ?? 0) + 1;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    const preparedClaim = await signClaimVoucher({
      wallet: wallet.address,
      amount: pendingEmoji,
      nonce: claimNonce,
      deadline
    });
    const claimHash = preparedClaim?.claimHash ?? `${wallet.address}:${claimNonce}:${pendingEmoji}`;

    await tx.rewardClaim.create({
      data: {
        walletId: wallet.id,
        claimNonce,
        amount: decimal(pendingEmoji),
        claimHash,
        signature: preparedClaim?.signature,
        expiresAt: new Date(deadline * 1000)
      }
    });
    await tx.liquidityPosition.updateMany({
      where: { walletId: wallet.id },
      data: { pendingEmoji: decimal(0) }
    });
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalPendingEmoji: decimal(0),
        totalClaimedEmoji: { increment: decimal(pendingEmoji) }
      }
    });
    await moveProtocol(tx, 8, -2);

    const snapshot = await snapshotForWallet(
      tx,
      wallet.id,
      preparedClaim
        ? `Prepared signed claim #${claimNonce} for ${pendingEmoji} DOPAMINE. Your wallet can submit one Base tx now.`
        : `Prepared DB claim #${claimNonce} for ${pendingEmoji} DOPAMINE. Add claim contract env vars to enable wallet tx.`
    );
    return {
      ...snapshot,
      preparedClaim: preparedClaim ?? undefined
    };
  });
}

export async function recordClaimTransactionAction(address: string, claimHash: string, txHash: string) {
  const walletAddress = assertWallet(address);
  const cleanClaimHash = claimHash.trim();
  const cleanTxHash = txHash.trim().toLowerCase();

  if (!cleanClaimHash) {
    throw new Error("Missing claim reference.");
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanTxHash)) {
    throw new Error("Invalid transaction hash.");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const claim = await tx.rewardClaim.findFirst({
      where: {
        walletId: wallet.id,
        claimHash: cleanClaimHash
      }
    });

    if (!claim) {
      throw new Error("Could not find the prepared claim to attach this transaction.");
    }

    await tx.rewardClaim.update({
      where: { id: claim.id },
      data: { txHash: cleanTxHash }
    });

    return snapshotForWallet(
      tx,
      wallet.id,
      `Claim transaction recorded: ${cleanTxHash.slice(0, 10)}...${cleanTxHash.slice(-8)}. The token remains spiritually priceless.`
    );
  });
}

export async function loadOnchainVaultAction(address: string): Promise<OnchainVaultSnapshot> {
  const walletAddress = assertWallet(address) as `0x${string}`;
  const chainId = getEmojiChainId();
  const tokenAddress = getAddressEnv("EMOJI_TOKEN_ADDRESS");
  const stakingAddress = getAddressEnv("NEXT_PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS");
  const dumpVaultAddress = getAddressEnv("NEXT_PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS");
  const ownerAddress = getAddressEnv("EMOJI_OWNER_ADDRESS");
  const rpcUrl = process.env.BASE_RPC_URL;

  const emptySnapshot: OnchainVaultSnapshot = {
    configured: false,
    chainId,
    tokenAddress,
    stakingAddress,
    dumpVaultAddress,
    ownerAddress,
    wallet: walletAddress,
    tokenBalance: 0,
    stakedBalance: 0,
    totalStaked: 0,
    stakingAllowance: 0,
    dumpAllowance: 0,
    currentEpochId: 0,
    epochStartsAt: null,
    epochEndsAt: null,
    epochTotalDumped: 0,
    epochPrizePaid: 0,
    epochWinner: null,
    epochSettled: false,
    dumpedThisEpoch: 0,
    vaultBalance: 0,
    stakingApy: STAKING_REWARD_APY,
    stakingRewardSupply: STAKING_REWARD_SUPPLY,
    stakingRewardsCredited: 0
  };

  if (!rpcUrl || !tokenAddress || !stakingAddress || !dumpVaultAddress) {
    return emptySnapshot;
  }

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const readContract = <T>(label: string, parameters: Parameters<typeof publicClient.readContract>[0]) =>
    withRpcRetry(label, () => publicClient.readContract(parameters) as Promise<T>);
  const tokenBalance = await readContract<bigint>("DOPAMINE wallet balance", {
    address: tokenAddress,
    abi: EMOJI_TOKEN_ABI,
    functionName: "balanceOf",
    args: [walletAddress]
  });
  const stakedBalance = await readContract<bigint>("Staked DOPAMINE balance", {
    address: stakingAddress,
    abi: EMOJI_STAKING_ABI,
    functionName: "stakedBalanceOf",
    args: [walletAddress]
  });
  const totalStaked = await readContract<bigint>("Total staked DOPAMINE", {
    address: stakingAddress,
    abi: EMOJI_STAKING_ABI,
    functionName: "totalStaked"
  });
  const stakingAllowance = await readContract<bigint>("Staking allowance", {
    address: tokenAddress,
    abi: EMOJI_TOKEN_ABI,
    functionName: "allowance",
    args: [walletAddress, stakingAddress]
  });
  const dumpAllowance = await readContract<bigint>("Dump allowance", {
    address: tokenAddress,
    abi: EMOJI_TOKEN_ABI,
    functionName: "allowance",
    args: [walletAddress, dumpVaultAddress]
  });
  const currentEpochId = await readContract<bigint>("Current lottery epoch", {
    address: dumpVaultAddress,
    abi: EMOJI_DUMP_VAULT_ABI,
    functionName: "currentEpochId"
  });
  const vaultTokenBalance = await readContract<bigint>("Dump vault DOPAMINE balance", {
    address: tokenAddress,
    abi: EMOJI_TOKEN_ABI,
    functionName: "balanceOf",
    args: [dumpVaultAddress]
  });

  let epochStartsAt: string | null = null;
  let epochEndsAt: string | null = null;
  let epochTotalDumped = 0;
  let epochPrizePaid = 0;
  let epochWinner: string | null = null;
  let epochSettled = false;
  let dumpedThisEpoch = 0;

  if (currentEpochId > BigInt(0)) {
    const epoch = await readContract<readonly [bigint, bigint, bigint, bigint, `0x${string}`, boolean, bigint]>("Current lottery epoch details", {
      address: dumpVaultAddress,
      abi: EMOJI_DUMP_VAULT_ABI,
      functionName: "epochs",
      args: [currentEpochId]
    });
    const dumpedByWallet = await readContract<bigint>("Wallet dumped this epoch", {
      address: dumpVaultAddress,
      abi: EMOJI_DUMP_VAULT_ABI,
      functionName: "dumpedByEpoch",
      args: [currentEpochId, walletAddress]
    });
    const epochTuple = epoch as readonly [bigint, bigint, bigint, bigint, `0x${string}`, boolean, bigint];
    epochStartsAt = Number(epochTuple[0]) > 0 ? new Date(Number(epochTuple[0]) * 1000).toISOString() : null;
    epochEndsAt = Number(epochTuple[1]) > 0 ? new Date(Number(epochTuple[1]) * 1000).toISOString() : null;
    epochTotalDumped = formatTokenUnits(epochTuple[2]);
    epochPrizePaid = formatTokenUnits(epochTuple[3]);
    epochWinner = epochTuple[4] === zeroAddress ? null : epochTuple[4];
    epochSettled = epochTuple[5];
    dumpedThisEpoch = formatTokenUnits(dumpedByWallet);
  }
  const formattedStakedBalance = formatTokenUnits(stakedBalance);
  const stakingRewardsCredited = await prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    return accrueStakingRewards(tx, wallet.id, formattedStakedBalance);
  });

  return {
    ...emptySnapshot,
    configured: true,
    tokenBalance: formatTokenUnits(tokenBalance),
    stakedBalance: formattedStakedBalance,
    totalStaked: formatTokenUnits(totalStaked),
    stakingAllowance: formatTokenUnits(stakingAllowance),
    dumpAllowance: formatTokenUnits(dumpAllowance),
    currentEpochId: Number(currentEpochId),
    epochStartsAt,
    epochEndsAt,
    epochTotalDumped,
    epochPrizePaid,
    epochWinner,
    epochSettled,
    dumpedThisEpoch,
    vaultBalance: formatTokenUnits(vaultTokenBalance),
    stakingApy: STAKING_REWARD_APY,
    stakingRewardSupply: STAKING_REWARD_SUPPLY,
    stakingRewardsCredited
  };
}

export async function loadLotteryAction(address: string, stakedBalance = 0): Promise<LotterySnapshot> {
  const walletAddress = assertWallet(address);
  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    return lotterySnapshotForWallet(tx, wallet.id, stakedBalance);
  });
}

export async function depositStEmojiToLotteryAction(address: string, amount: number, stakedBalance: number) {
  const walletAddress = assertWallet(address);
  const cleanAmount = Math.max(0, Number(amount));
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) throw new Error("Enter stDOPAMINE to deposit.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const { epochId } = getLotteryWindow();
    const epoch = await ensureLotteryEpoch(tx, epochId);
    const existing = await tx.lotteryEntry.findUnique({
      where: {
        lotteryEpochId_walletId: {
          lotteryEpochId: epoch.id,
          walletId: wallet.id
        }
      }
    });
    const alreadyDeposited = toNumber(existing?.stEmojiAmount);
    if (alreadyDeposited + cleanAmount > stakedBalance) {
      throw new Error("You need more staked DOPAMINE to mint that much stDOPAMINE into the lottery.");
    }

    await tx.lotteryEntry.upsert({
      where: {
        lotteryEpochId_walletId: {
          lotteryEpochId: epoch.id,
          walletId: wallet.id
        }
      },
      update: {
        stEmojiAmount: { increment: decimal(cleanAmount) }
      },
      create: {
        lotteryEpochId: epoch.id,
        walletId: wallet.id,
        stEmojiAmount: decimal(cleanAmount)
      }
    });
    await tx.lotteryEpoch.update({
      where: { id: epoch.id },
      data: {
        totalStEmoji: { increment: decimal(cleanAmount) }
      }
    });
    return lotterySnapshotForWallet(tx, wallet.id, stakedBalance);
  });
}

export async function dumpEmojiToLotteryAction(address: string, amount: number, stakedBalance = 0) {
  const walletAddress = assertWallet(address);
  const cleanAmount = Math.max(0, Number(amount));
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) throw new Error("Enter DOPAMINE to dump.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    if (toNumber(wallet.totalClaimedEmoji) < cleanAmount) {
      throw new Error("You need claimed DOPAMINE in the app before dumping into the lottery.");
    }

    const { epochId } = getLotteryWindow();
    const epoch = await ensureLotteryEpoch(tx, epochId);
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalClaimedEmoji: { decrement: decimal(cleanAmount) },
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: {
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await tx.lotteryEpoch.update({
      where: { id: epoch.id },
      data: {
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await moveProtocol(tx, -2, 8);
    return {
      game: await snapshotForWallet(tx, wallet.id, `Dumped ${cleanAmount} DOPAMINE into lottery epoch #${epochId}.`),
      lottery: await lotterySnapshotForWallet(tx, wallet.id, stakedBalance)
    };
  });
}

export async function recordOnchainLotteryDumpAction(address: string, amount: number, txHash: string, stakedBalance = 0) {
  const walletAddress = assertWallet(address);
  const cleanAmount = Math.max(0, Number(amount));
  const cleanTxHash = txHash.trim().toLowerCase();
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) throw new Error("Enter DOPAMINE to dump.");
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanTxHash)) throw new Error("Invalid dump transaction hash.");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const { epochId } = getLotteryWindow();
    const epoch = await ensureLotteryEpoch(tx, epochId);

    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: {
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await tx.lotteryEpoch.update({
      where: { id: epoch.id },
      data: {
        totalDumpedEmoji: { increment: decimal(cleanAmount) }
      }
    });
    await moveProtocol(tx, -2, 8);

    return {
      game: await snapshotForWallet(tx, wallet.id, `Dumped ${cleanAmount} real DOPAMINE onchain into lottery epoch #${epochId}.`),
      lottery: await lotterySnapshotForWallet(tx, wallet.id, stakedBalance)
    };
  });
}

export async function dumpOnChartAction(address: string) {
  const walletAddress = assertWallet(address);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    const claimedEmoji = toNumber(wallet.totalClaimedEmoji);
    if (claimedEmoji <= 0) {
      return snapshotForWallet(tx, wallet.id, "You need claimed DOPAMINE before you can dump on the fake chart. Earn the right to be annoying.");
    }

    const dumpAmount = Math.max(1, Math.ceil(claimedEmoji * 0.25));
    await ensureProtocolState(tx);
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: {
        totalClaimedEmoji: { decrement: decimal(dumpAmount) },
        totalDumpedEmoji: { increment: decimal(dumpAmount) }
      }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: {
        totalDumpedEmoji: { increment: decimal(dumpAmount) }
      }
    });
    await moveProtocol(tx, -6, 16);

    return snapshotForWallet(tx, wallet.id, `Dumped ${dumpAmount} DOPAMINE into the fake chart. APY is juicier because morale is lower.`);
  });
}

export async function panicSellAction(address: string) {
  const walletAddress = assertWallet(address);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, walletAddress);
    await ensureProtocolState(tx);
    await tx.gameWallet.update({
      where: { id: wallet.id },
      data: { panicClicks: { increment: 1 } }
    });
    await tx.protocolGameState.update({
      where: { id: "global" },
      data: { panicClicks: { increment: 1 } }
    });
    await moveProtocol(tx, -9, 24);

    return snapshotForWallet(tx, wallet.id, "Panic sell pressed. Nothing was sold, everything felt urgent, dip farmers are suddenly awake.");
  });
}

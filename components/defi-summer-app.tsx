"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { encodeFunctionData, numberToHex, parseUnits } from "viem";
import {
  depositStEmojiToLotteryAction,
  harvestMetaFarmAction,
  harvestPoolAction,
  loadLotteryAction,
  loadOnchainVaultAction,
  loadGameAction,
  mintFakeAssetAction,
  prepareClaimAction,
  recordFaucetBribeAction,
  recordHarvestBribeAction,
  recordClaimTransactionAction,
  recordMetaFarmSupplyAction,
  recordOnchainLotteryDumpAction,
  supplyPoolAction
} from "@/app/defi-actions";
import {
  type AssetSymbol,
  type ClaimHistoryItem,
  type GameSnapshot,
  type LotterySnapshot,
  type MetaFarmSnapshot,
  type OnchainVaultSnapshot,
  calculateDipBoost,
  displayAddress,
  EMOJI_CLAIM_ABI,
  EMOJI_CHAINS,
  EMOJI_DUMP_VAULT_ABI,
  EMOJI_MAX_SUPPLY,
  EMOJI_STAKING_ABI,
  EMOJI_TOKEN_ABI,
  FARM_REWARD_SUPPLY,
  FAUCET_ASSETS,
  INITIAL_BALANCES,
  INITIAL_CHART_POINTS,
  META_FARM,
  POOLS,
  STAKING_REWARD_APY,
  STAKING_REWARD_SUPPLY
} from "@/lib/defi/game";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type GameplayTab = "farms" | "staking" | "lottery" | "meta";
type ExplainerKey = "claim" | "price" | "farms" | "faucet" | "staking" | "lottery" | "meta";
type BribeTarget =
  | { kind: "faucet"; symbol: AssetSymbol; label: string }
  | { kind: "harvest"; targetId: string; label: string };

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const formatToken = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(value);

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 5,
    minimumFractionDigits: 5
  }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 2 : 0
  }).format(value);

const formatClaimDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(value))
    : "No epoch";

const DOPAMINE_BURST_LABELS = [
  "REAL DOPAMINE LEAK",
  "APY ENTERED THE BLOODSTREAM",
  "FAUCET SAID MORE",
  "DEGEN THUMB DETECTED",
  "NUMBER GO UP RECEPTORS",
  "2020 WAS A STATE OF MIND",
  "FAKE ASSET, REAL CLICK",
  "SEROTONIN DENIED"
];

const DOPAMINE_BURST_IMAGES = [
  "Akoin Akon.webp",
  "Based Chad Meme.webp",
  "Bogdanoff Twins Meme.png",
  "CZ Meme.jpg",
  "Carlos Matos On the Media NFT.png",
  "Crypto Retard Meme.jpeg",
  "Crypto Retard Meme.jpg",
  "Disgusted Girl Meme.jpg",
  "Elon Cringe Image.jpeg",
  "Gigachad Meme.webp",
  "Indian Crypto Meme.jpg",
  "Justin Sun Funny.webp",
  "Milady Crypto Meme.jpeg",
  "Money Printer Meme Wojak.png",
  "Money Printer Meme.jpeg",
  "Pepe Frog Image.jpeg",
  "Pepe the Frog.jpg",
  "Ruja Ignatova.jpg.webp",
  "SBF Meme.jpg",
  "Truman Show Meme Nov 24 2025.webp",
  "Trump Crypto Meme.jpeg",
  "Trump Solana Meme Coin.webp",
  "Vitalik Funny Photo.jpg",
  "Vitalik Meme.jpeg",
  "Vitalik Meme.jpg"
].map((fileName) => `/dopamine-bursts/${encodeURIComponent(fileName)}`);

const WALLET_GATE_BURST_IMAGE = "/dopamine-bursts/Kim%20Jong%20Un%20Meme.jpg";
const WALLET_GATE_BURST_LABEL = "CONNECT WALLET FIRST";
const HARVEST_BURST_IMAGE = "/harvest.webp";
const HARVEST_BURST_LABEL = "1 DOPAMINE HARVESTED";
const EXPLAINER_IMAGE = "/doge-q.png";
const PUBLIC_EMOJI_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_EMOJI_TOKEN_ADDRESS as `0x${string}` | undefined;
const PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
const PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
const PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
const DEV_RESERVE_SUPPLY = EMOJI_MAX_SUPPLY * 0.01;
const PUBLIC_GAME_SUPPLY = EMOJI_MAX_SUPPLY - DEV_RESERVE_SUPPLY;
const UNISWAP_TOKEN_URL = PUBLIC_EMOJI_TOKEN_ADDRESS
  ? `https://app.uniswap.org/explore/tokens/base/${PUBLIC_EMOJI_TOKEN_ADDRESS}`
  : "https://app.uniswap.org/";
const UNISWAP_CREATE_POOL_URL = PUBLIC_EMOJI_TOKEN_ADDRESS
  ? `https://app.uniswap.org/positions/create/v3?chain=base&currencyA=ETH&currencyB=${PUBLIC_EMOJI_TOKEN_ADDRESS}`
  : "https://app.uniswap.org/positions/create";
const EXPLAINERS: Record<ExplainerKey, { eyebrow: string; title: string; bullets: string[] }> = {
  claim: {
    eyebrow: "Real Token Button",
    title: "Claim DOPAMINE",
    bullets: [
      "Pending DOPAMINE is offchain until you claim it.",
      "Claim creates a signed voucher and asks your wallet for a real Base transaction.",
      "After claim, the token is in your wallet. It still has no promised value, only theatre."
    ]
  },
  price: {
    eyebrow: "Fake Market",
    title: "Vibe Price",
    bullets: [
      "The price is made up from app activity, hype, TVL, and collective delusion.",
      "Farming and supplying LP push the candle up. Dumping pushes jeet pressure up.",
      "Dumped real DOPAMINE goes to the lottery vault, so panic creates someone else's prize."
    ]
  },
  farms: {
    eyebrow: "Liquidity Mining",
    title: "LP Farms",
    bullets: [
      "Mint fake faucet assets, supply a pool recipe, then watch farmable DOPAMINE accrue over time.",
      "Harvesting is intentionally painful: one DOPAMINE per click.",
      "After 50 harvest clicks, your thumb gets a timeout unless you wait or bribe the dev."
    ]
  },
  faucet: {
    eyebrow: "Fake Asset Printer",
    title: "Faucet",
    bullets: [
      "Each button mints fake offchain assets for the connected wallet.",
      "Every asset has its own click counter, so farming more means clicking more buttons.",
      "After 10 mint clicks, that asset cools down. Waiting is free, bribery is faster and morally worse."
    ]
  },
  staking: {
    eyebrow: "Onchain Vault",
    title: "Staking",
    bullets: [
      "Stake real DOPAMINE in the staking contract to earn more pending DOPAMINE.",
      "The app mirrors your stake into offchain stDOPAMINE, which is your lottery ticket power.",
      "Rewards accrue to pending DOPAMINE and need a claim transaction before they hit your wallet."
    ]
  },
  lottery: {
    eyebrow: "Dump Recycling",
    title: "Lottery",
    bullets: [
      "Deposit stDOPAMINE into the current fixed 3-hour epoch.",
      "All DOPAMINE dumped by panic sellers becomes the epoch prize pool.",
      "At rollover, one depositor wins the dumped pool, weighted by stDOPAMINE deposited."
    ]
  },
  meta: {
    eyebrow: "Recursive Nonsense",
    title: "Meta Farm",
    bullets: [
      "Feed real DOPAMINE and fake fETH into a farm that farms more DOPAMINE.",
      "It is circular by design, because that is how the most spiritually honest farms felt.",
      "Harvesting is click-based here too, with the same cooldown-bribe comedy loop."
    ]
  }
};
const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const MIN_DEV_BRIBE_USDC = 0.5;
const DONATION_USDC_ADDRESS = process.env.NEXT_PUBLIC_DONATION_USDC_ADDRESS;
const DEV_DONATION_ADDRESS = process.env.NEXT_PUBLIC_DEV_DONATION_ADDRESS;
const DEV_BRIBE_TIERS = [
  { amount: 0.5, label: "1 minute", seconds: 60 },
  { amount: 1, label: "5 minutes", seconds: 5 * 60 },
  { amount: 5, label: "30 minutes", seconds: 30 * 60 },
  { amount: 100, label: "3 hours", seconds: 3 * 60 * 60 }
];
const CLAIM_CONFETTI = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  left: (index * 23) % 100,
  delay: (index % 9) * 90,
  duration: 1700 + (index % 7) * 150,
  color: ["#f7ff64", "#ff4f9a", "#64f7ff", "#35c66b"][index % 4]
}));
const FLYING_DOPAMINE = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: 8 + ((index * 17) % 84),
  delay: (index % 6) * 130,
  size: 26 + (index % 5) * 8
}));
const EXPLAINER_HEARTS = Array.from({ length: 64 }, (_, index) => ({
  id: index,
  left: (index * 19) % 100,
  delay: (index % 16) * 45,
  duration: 1200 + (index % 9) * 120,
  size: 18 + (index % 8) * 5,
  drift: -80 + ((index * 37) % 160),
  rotation: -28 + ((index * 17) % 56)
}));

function isMissingChainError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number | string }).code === 4902
  );
}

export function DeFiSummerApp() {
  const faucetRef = useRef<HTMLElement | null>(null);
  const lotteryWinNoticeRef = useRef<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<AssetSymbol, number>>(INITIAL_BALANCES);
  const [lpBalances, setLpBalances] = useState<Record<string, number>>({});
  const [poolStates, setPoolStates] = useState<GameSnapshot["poolStates"]>({});
  const [metaFarm, setMetaFarm] = useState<MetaFarmSnapshot | null>(null);
  const [faucetStatus, setFaucetStatus] = useState<GameSnapshot["faucetStatus"]>(
    Object.fromEntries(
      FAUCET_ASSETS.map((asset) => [
        asset.symbol,
        {
          streakClicks: 0,
          clicksUntilCooldown: 10,
          cooldownUntil: null,
          bribeUnlockUntil: null
        }
      ])
    ) as GameSnapshot["faucetStatus"]
  );
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryItem[]>([]);
  const [claimedEmoji, setClaimedEmoji] = useState(0);
  const [pendingEmoji, setPendingEmoji] = useState(0);
  const [faucetClicks, setFaucetClicks] = useState(0);
  const [claimNonce, setClaimNonce] = useState(1);
  const [hype, setHype] = useState(18);
  const [jeetPressure, setJeetPressure] = useState(8);
  const [vibePrice, setVibePrice] = useState(0.0042);
  const [chartPoints, setChartPoints] = useState(INITIAL_CHART_POINTS);
  const [dumpedEmoji, setDumpedEmoji] = useState(0);
  const [panicClicks, setPanicClicks] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [vaultState, setVaultState] = useState<OnchainVaultSnapshot | null>(null);
  const [lotteryState, setLotteryState] = useState<LotterySnapshot | null>(null);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [withdrawAmount, setWithdrawAmount] = useState("10");
  const [stEmojiDepositAmount, setStEmojiDepositAmount] = useState("10");
  const [lotteryDumpAmount, setLotteryDumpAmount] = useState("5");
  const [bribeTierIndex, setBribeTierIndex] = useState(0);
  const [bribeTarget, setBribeTarget] = useState<BribeTarget | null>(null);
  const [isDumpModalOpen, setIsDumpModalOpen] = useState(false);
  const [isBribeModalOpen, setIsBribeModalOpen] = useState(false);
  const [claimCelebration, setClaimCelebration] = useState<{ id: number; amount: number } | null>(null);
  const [activeExplainer, setActiveExplainer] = useState<ExplainerKey | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [isForbiddenPoolModalOpen, setIsForbiddenPoolModalOpen] = useState(false);
  const [heartStormId, setHeartStormId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<GameplayTab>("farms");
  const [log, setLog] = useState("Waiting for wallet. Fake balances are offchain. DOPAMINE claims are real.");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const totalLp = useMemo(
    () => Object.values(lpBalances).reduce((total, value) => total + value, 0),
    [lpBalances]
  );
  const totalLpPositions = useMemo(
    () => Object.values(lpBalances).filter((value) => value > 0).length,
    [lpBalances]
  );
  const totalTvlUsd = useMemo(
    () => Object.values(poolStates).reduce((total, poolState) => total + poolState.tvlUsd, 0),
    [poolStates]
  );
  const dipBoost = calculateDipBoost(jeetPressure);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
      setPoolStates((currentPoolStates) =>
        Object.fromEntries(
          Object.entries(currentPoolStates).map(([poolId, poolState]) => {
            const remainingRewards = Math.max(0, poolState.remainingRewardsEmoji);
            const emittedDelta = Math.min(poolState.emittedEmojiPerSecond, remainingRewards);
            const nextRemainingRewards = Math.max(0, remainingRewards - emittedDelta);
            const farmableDelta = Math.min(poolState.unharvestedEmojiPerSecond, nextRemainingRewards);

            return [
              poolId,
              {
                ...poolState,
                totalEmittedEmoji: Math.min(poolState.rewardAllocationEmoji, poolState.totalEmittedEmoji + emittedDelta),
                remainingRewardsEmoji: nextRemainingRewards,
                unharvestedEmoji: Math.min(nextRemainingRewards, poolState.unharvestedEmoji + farmableDelta)
              }
            ];
          })
        ) as GameSnapshot["poolStates"]
      );
      setMetaFarm((currentMetaFarm) => {
        if (!currentMetaFarm) return currentMetaFarm;
        const farmableDelta = Math.min(currentMetaFarm.unharvestedEmojiPerSecond, currentMetaFarm.remainingRewardsEmoji);
        return {
          ...currentMetaFarm,
          remainingRewardsEmoji: Math.max(0, currentMetaFarm.remainingRewardsEmoji - farmableDelta),
          unharvestedEmoji: Math.min(
            Math.max(0, currentMetaFarm.remainingRewardsEmoji - farmableDelta),
            currentMetaFarm.unharvestedEmoji + farmableDelta
          )
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!heartStormId) return undefined;
    const timeout = window.setTimeout(() => setHeartStormId(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [heartStormId]);

  const applySnapshot = (snapshot: GameSnapshot) => {
    setWalletAddress(snapshot.wallet);
    setWalletLabel(snapshot.displayAddress);
    setBalances(snapshot.balances);
    setLpBalances(snapshot.lpBalances);
    setMetaFarm(snapshot.metaFarm ?? null);
    if (!snapshot.preservePoolStates) {
      setPoolStates(snapshot.poolStates);
    }
    setFaucetStatus(snapshot.faucetStatus);
    setClaimHistory(snapshot.claimHistory);
    setClaimedEmoji(snapshot.claimedEmoji);
    setPendingEmoji(snapshot.pendingEmoji);
    setFaucetClicks(snapshot.faucetClicks);
    setClaimNonce(snapshot.claimNonce);
    setHype(snapshot.hype);
    setJeetPressure(snapshot.jeetPressure);
    setVibePrice(snapshot.vibePrice);
    setChartPoints(snapshot.chartPoints);
    setDumpedEmoji(snapshot.dumpedEmoji);
    setPanicClicks(snapshot.panicClicks);
    setLog(snapshot.log);
  };

  const refreshVault = async (address = walletAddress) => {
    if (!address) return;
    try {
      const nextVaultState = await loadOnchainVaultAction(address);
      setVaultState(nextVaultState);
      const lotteryWinNoticeKey =
        nextVaultState.epochSettled && nextVaultState.epochWinner && nextVaultState.epochPrizePaid > 0
          ? `${nextVaultState.currentEpochId}:${nextVaultState.epochWinner}:${nextVaultState.epochPrizePaid}`
          : null;
      if (lotteryWinNoticeKey && lotteryWinNoticeRef.current !== lotteryWinNoticeKey) {
        lotteryWinNoticeRef.current = lotteryWinNoticeKey;
        setLog(
          `LOTTERY WIN: ${displayAddress(nextVaultState.epochWinner ?? "")} won ${formatToken(nextVaultState.epochPrizePaid)} DOPAMINE in epoch #${nextVaultState.currentEpochId}.`
        );
      }
      if (nextVaultState.stakingRewardsCredited > 0) {
        setPendingEmoji((current) => current + nextVaultState.stakingRewardsCredited);
      }
      setLotteryState(await loadLotteryAction(address, nextVaultState.stakedBalance));
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not load staking and dump vault state.");
    }
  };

  const ensureEmojiChain = async (chainId: number) => {
    if (!window.ethereum) {
      return false;
    }

    const chainHex = numberToHex(chainId);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }]
      });
    } catch (error) {
      const chain = EMOJI_CHAINS[chainId];
      if (!isMissingChainError(error) || !chain) {
        setLog(`Switch your wallet to chain ${chainId}, then try again.`);
        return false;
      }

      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainHex,
              chainName: chain.chainName,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls,
              blockExplorerUrls: chain.blockExplorerUrls
            }
          ]
        });
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainHex }]
        });
      } catch {
        setLog(`Add ${chain.chainName} in your wallet, then try again.`);
        return false;
      }
    }

    return true;
  };

  const submitClaimTransaction = async (snapshot: GameSnapshot) => {
    if (!snapshot.preparedClaim) return false;
    if (!window.ethereum) {
      setLog("Signed claim is ready, but no injected wallet is available to submit the Base transaction.");
      return false;
    }

    const claim = snapshot.preparedClaim;
    if (!(await ensureEmojiChain(claim.chainId))) return false;

    const data = encodeFunctionData({
      abi: EMOJI_CLAIM_ABI,
      functionName: "claim",
      args: [
        {
          wallet: claim.wallet,
          amount: BigInt(claim.amountWei),
          nonce: BigInt(claim.nonce),
          deadline: BigInt(claim.deadline)
        },
        claim.signature
      ]
    });

    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: snapshot.wallet,
          to: claim.claimContract,
          data
        }
      ]
    });

    if (typeof txHash === "string") {
      setClaimTxHash(txHash);
      applySnapshot(await recordClaimTransactionAction(snapshot.wallet, claim.claimHash, txHash));
      await refreshVault(snapshot.wallet);
      return true;
    }

    return false;
  };

  const runGameAction = async (action: (address: string) => Promise<GameSnapshot>) => {
    if (!walletAddress) {
      setLog("Connect a wallet first so the DB knows which farmer is clicking.");
      return;
    }

    setIsBusy(true);
    try {
      applySnapshot(await action(walletAddress));
    } catch (error) {
      setLog(error instanceof Error ? error.message : "The fake protocol tripped over a server action.");
    } finally {
      setIsBusy(false);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setLog("No injected wallet found. Install or open a wallet-enabled browser to farm with a real address.");
      return;
    }

    setIsBusy(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const [account] = Array.isArray(accounts) ? accounts : [];
      if (typeof account !== "string") {
        setLog("Wallet connection did not return an address.");
        return;
      }

      applySnapshot(await loadGameAction(account));
      await refreshVault(account);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Wallet connection was rejected or failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const spawnBurst = (
    event: React.MouseEvent<HTMLButtonElement>,
    label: string,
    image: string,
    rotation?: number,
    className = ""
  ) => {
    let layer = document.getElementById("dopamine-burst-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "dopamine-burst-layer";
      layer.className = "dopamine-burst-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    const burstRotation = rotation ?? Math.round(Math.random() * 24 - 12);
    const burst = document.createElement("div");
    burst.className = `dopamine-burst ${className}`.trim();
    burst.style.setProperty("--burst-x", `${event.clientX}px`);
    burst.style.setProperty("--burst-y", `${event.clientY}px`);
    burst.style.setProperty("--burst-rotation", `${burstRotation}deg`);
    burst.innerHTML = `<div class="burst-photo"><img src="${image}" alt="" /></div><strong>${label}</strong>`;
    layer.appendChild(burst);
    window.setTimeout(() => {
      burst.remove();
    }, 5000);
  };

  const spawnDopamineBurst = (event: React.MouseEvent<HTMLButtonElement>) => {
    const label = DOPAMINE_BURST_LABELS[Math.floor(Math.random() * DOPAMINE_BURST_LABELS.length)];
    const image = DOPAMINE_BURST_IMAGES[Math.floor(Math.random() * DOPAMINE_BURST_IMAGES.length)];
    spawnBurst(event, label, image);
  };

  const spawnHarvestBurst = (event: React.MouseEvent<HTMLButtonElement>) => {
    spawnBurst(event, HARVEST_BURST_LABEL, HARVEST_BURST_IMAGE, -2, "harvest-burst");
  };

  const promptWallet = (event: React.MouseEvent<HTMLButtonElement>) => {
    spawnBurst(event, WALLET_GATE_BURST_LABEL, WALLET_GATE_BURST_IMAGE, -4);
    setLog("Connect wallet first. The fake protocol refuses to hallucinate your address.");
  };

  const runWalletAction = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    if (!walletAddress) {
      promptWallet(event);
      return;
    }
    action();
  };

  const mintFaucetAsset = (symbol: AssetSymbol) => {
    void runGameAction((address) => mintFakeAssetAction(address, symbol));
  };

  const pointAtFaucet = () => {
    setLog("Faucet is in the right panel. No mint-all button exists. The inconvenience is the feature.");
    faucetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const supplyPool = (poolId: string) => {
    void runGameAction((address) => supplyPoolAction(address, poolId));
  };

  const harvestPool = (poolId: string) => {
    void runGameAction((address) => harvestPoolAction(address, poolId));
  };

  const claimRewards = () => {
    void runGameAction(async (address) => {
      const snapshot = await prepareClaimAction(address);
      await submitClaimTransaction(snapshot);
      if (snapshot.preparedClaim) {
        const amount = Number(snapshot.preparedClaim.amount);
        if (Number.isFinite(amount) && amount > 0) {
          setClaimCelebration({ id: Date.now(), amount });
        }
      }
      return snapshot;
    });
  };

  const dumpOnChart = () => {
    const onchainBalance = vaultState?.tokenBalance ?? 0;
    setLotteryDumpAmount(onchainBalance > 0 ? String(Math.max(1, Math.floor(onchainBalance * 0.25))) : "1");
    setIsDumpModalOpen(true);
  };

  const openFaucetBribeModal = (symbol: AssetSymbol) => {
    setBribeTarget({ kind: "faucet", symbol, label: `${symbol} faucet` });
    setBribeTierIndex(0);
    setIsBribeModalOpen(true);
  };

  const openHarvestBribeModal = (targetId: string, label: string) => {
    setBribeTarget({ kind: "harvest", targetId, label });
    setBribeTierIndex(0);
    setIsBribeModalOpen(true);
  };

  const panicSell = () => {
    if (!walletAddress || !vaultState?.tokenBalance) {
      setLog("Connect a wallet before panic dumping.");
      return;
    }
    void dumpEmojiToLottery(String(vaultState.tokenBalance));
  };

  const sendVaultTransaction = async ({
    label,
    to,
    abi,
    functionName,
    args,
    vault = vaultState
  }: {
    label: string;
    to: `0x${string}` | null;
    abi: typeof EMOJI_TOKEN_ABI | typeof EMOJI_STAKING_ABI | typeof EMOJI_DUMP_VAULT_ABI;
    functionName: string;
    args: readonly unknown[];
    vault?: OnchainVaultSnapshot | null;
  }) => {
    if (!walletAddress || !vault || !to) {
      setLog("Connect a wallet and load the vault first.");
      return null;
    }

    if (!window.ethereum) {
      setLog("No injected wallet found for the onchain vault transaction.");
      return null;
    }

    if (!(await ensureEmojiChain(vault.chainId))) return null;

    const data = encodeFunctionData({
      abi,
      functionName,
      args
    } as never);
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: walletAddress,
          to,
          data
        }
      ]
    });

    if (typeof txHash === "string") {
      setLog(`${label} submitted: ${txHash.slice(0, 10)}...${txHash.slice(-8)}.`);
      await refreshVault(walletAddress);
      return txHash;
    }

    return null;
  };

  const parseEmojiAmount = (value: string) => parseUnits(value.trim() || "0", 18);
  const parseUsdcAmount = (value: string) => parseUnits(value.trim() || "0", 6);

  const waitForWalletReceipt = async (txHash: string) => {
    if (!window.ethereum) return;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash]
      });
      if (receipt) return;
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
  };

  const stakeEmoji = async () => {
    if (!walletAddress) return;
    setIsBusy(true);
    try {
      const latestVaultState = await loadOnchainVaultAction(walletAddress);
      setVaultState(latestVaultState);
      setLotteryState(await loadLotteryAction(walletAddress, latestVaultState.stakedBalance));
      if (!latestVaultState.tokenAddress || !latestVaultState.stakingAddress) return;

      const amount = parseEmojiAmount(stakeAmount);
      const amountNumber = Number(stakeAmount);
      if (amount <= BigInt(0)) throw new Error("Enter a DOPAMINE amount to stake.");
      if (!Number.isFinite(amountNumber)) throw new Error("Enter a valid DOPAMINE amount to stake.");
      if (latestVaultState.tokenBalance + 0.000000001 < amountNumber) {
        throw new Error(`Not enough DOPAMINE balance to stake that amount. App sees ${formatToken(latestVaultState.tokenBalance)} DOPAMINE onchain.`);
      }
      if (latestVaultState.stakingAllowance < amountNumber) {
        const approvalTx = await sendVaultTransaction({
          label: "Stake approval",
          to: latestVaultState.tokenAddress,
          abi: EMOJI_TOKEN_ABI,
          functionName: "approve",
          args: [latestVaultState.stakingAddress, amount],
          vault: latestVaultState
        });
        if (approvalTx) {
          setLog("Stake approval submitted. Waiting for it to land before staking.");
          await waitForWalletReceipt(approvalTx);
        }
      }
      const stakeTx = await sendVaultTransaction({
        label: "Stake",
        to: latestVaultState.stakingAddress,
        abi: EMOJI_STAKING_ABI,
        functionName: "stake",
        args: [amount],
        vault: latestVaultState
      });
      if (stakeTx) {
        await waitForWalletReceipt(stakeTx);
        await refreshVault(walletAddress);
      }
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Stake transaction failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const withdrawEmoji = async () => {
    if (!vaultState?.stakingAddress) return;
    setIsBusy(true);
    try {
      const amount = parseEmojiAmount(withdrawAmount);
      if (amount <= BigInt(0)) throw new Error("Enter a DOPAMINE amount to withdraw.");
      const withdrawTx = await sendVaultTransaction({
        label: "Withdraw",
        to: vaultState.stakingAddress,
        abi: EMOJI_STAKING_ABI,
        functionName: "withdraw",
        args: [amount]
      });
      if (withdrawTx) {
        await waitForWalletReceipt(withdrawTx);
        await refreshVault(walletAddress);
      }
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Withdraw transaction failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const depositStEmoji = async () => {
    if (!walletAddress || !vaultState) return;
    setIsBusy(true);
    try {
      if (!vaultState.dumpVaultAddress) throw new Error("Lottery vault is not configured.");
      const amountNumber = Number(stEmojiDepositAmount);
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) throw new Error("Enter stDOPAMINE to deposit.");
      const amount = parseEmojiAmount(stEmojiDepositAmount);
      const depositTx = await sendVaultTransaction({
        label: "Lottery ticket deposit",
        to: vaultState.dumpVaultAddress,
        abi: EMOJI_DUMP_VAULT_ABI,
        functionName: "depositTickets",
        args: [amount]
      });
      if (!depositTx) return;
      await waitForWalletReceipt(depositTx);
      const nextLottery = await depositStEmojiToLotteryAction(
        walletAddress,
        amountNumber,
        vaultState.stakedBalance
      );
      setLotteryState(nextLottery);
      await refreshVault(walletAddress);
      setLog(`Deposited ${stEmojiDepositAmount} stDOPAMINE into lottery epoch #${nextLottery.epochId}.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "stDOPAMINE lottery deposit failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const enterMetaFarm = async () => {
    if (!walletAddress || !vaultState?.tokenAddress || !vaultState.dumpVaultAddress) return;
    setIsBusy(true);
    try {
      if (vaultState.tokenBalance < metaFarmView.requiredEmoji) {
        throw new Error("Not enough onchain DOPAMINE to feed the reactor.");
      }
      if ((balances[metaFarmView.requiredFakeSymbol] ?? 0) < metaFarmView.requiredFakeAmount) {
        throw new Error(`Need ${metaFarmView.requiredFakeAmount} ${metaFarmView.requiredFakeSymbol} for the fake side of this extremely real LP.`);
      }
      const txHash = await sendVaultTransaction({
        label: "Recursive LP transfer",
        to: vaultState.tokenAddress,
        abi: EMOJI_TOKEN_ABI,
        functionName: "transfer",
        args: [vaultState.dumpVaultAddress, parseEmojiAmount(String(metaFarmView.requiredEmoji))]
      });
      if (!txHash) return;
      await waitForWalletReceipt(txHash);
      applySnapshot(await recordMetaFarmSupplyAction(walletAddress, txHash));
      await refreshVault(walletAddress);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Meta farm entry failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const harvestMetaFarm = () => {
    void runGameAction(harvestMetaFarmAction);
  };

  const bribeDev = async () => {
    if (!walletAddress || !bribeTarget || !vaultState) return;
    const selectedTier = DEV_BRIBE_TIERS[bribeTierIndex] ?? DEV_BRIBE_TIERS[0];
    const donationTokenAddress =
      (DONATION_USDC_ADDRESS || (vaultState.chainId === 84532 ? BASE_SEPOLIA_USDC_ADDRESS : "")) as `0x${string}`;
    const donationAddress = (DEV_DONATION_ADDRESS || vaultState.ownerAddress) as `0x${string}` | null;

    setIsBusy(true);
    try {
      const amountNumber = selectedTier.amount;
      if (!Number.isFinite(amountNumber) || amountNumber < MIN_DEV_BRIBE_USDC) {
        throw new Error("Minimum dev bribe is 0.50 USDC. Dignity was already discounted.");
      }
      if (!donationAddress || !donationTokenAddress) {
        throw new Error("Dev bribe address or USDC token is not configured.");
      }
      if (!(await ensureEmojiChain(vaultState.chainId))) return;

      const data = encodeFunctionData({
        abi: EMOJI_TOKEN_ABI,
        functionName: "transfer",
        args: [donationAddress, parseUsdcAmount(String(selectedTier.amount))]
      });
      const txHash = await window.ethereum?.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAddress,
            to: donationTokenAddress,
            data
          }
        ]
      });
      if (typeof txHash !== "string") throw new Error("Wallet did not return a bribe transaction hash.");

      setLog(`Bribe submitted: ${txHash.slice(0, 10)}...${txHash.slice(-8)}. Buying ${selectedTier.label} of moral flexibility.`);
      await waitForWalletReceipt(txHash);
      applySnapshot(
        bribeTarget.kind === "faucet"
          ? await recordFaucetBribeAction(walletAddress, bribeTarget.symbol, txHash, amountNumber)
          : await recordHarvestBribeAction(walletAddress, bribeTarget.targetId, txHash, amountNumber)
      );
      setIsBribeModalOpen(false);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Dev bribe failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const dumpEmojiToLottery = async (forcedAmount?: string) => {
    if (!walletAddress) {
      setLog("Connect wallet before dumping. The lottery requires a real degen signature.");
      return;
    }
    if (!vaultState?.tokenAddress || !vaultState.dumpVaultAddress) {
      setLog("Onchain vault state is still loading. Try again in a few seconds.");
      await refreshVault(walletAddress);
      return;
    }
    setIsBusy(true);
    try {
      const latestVaultState = await loadOnchainVaultAction(walletAddress);
      setVaultState(latestVaultState);
      setLotteryState(await loadLotteryAction(walletAddress, latestVaultState.stakedBalance));
      if (!latestVaultState.tokenAddress || !latestVaultState.dumpVaultAddress) {
        throw new Error("Dump vault is not configured.");
      }
      const amountInput = forcedAmount ?? lotteryDumpAmount;
      const amountNumber = Number(amountInput);
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) throw new Error("Enter DOPAMINE to dump.");
      if (amountNumber > latestVaultState.tokenBalance) {
        throw new Error(`Not enough onchain DOPAMINE to dump that amount. App sees ${formatToken(latestVaultState.tokenBalance)} DOPAMINE.`);
      }
      const amount = parseEmojiAmount(amountInput);
      if (latestVaultState.dumpAllowance < amountNumber) {
        const approvalTx = await sendVaultTransaction({
          label: "Dump approval",
          to: latestVaultState.tokenAddress,
          abi: EMOJI_TOKEN_ABI,
          functionName: "approve",
          args: [latestVaultState.dumpVaultAddress, amount],
          vault: latestVaultState
        });
        if (approvalTx) {
          setLog("Dump approval submitted. Waiting for it to land before dumping.");
          await waitForWalletReceipt(approvalTx);
        }
      }
      const txHash = await sendVaultTransaction({
        label: "Onchain dump",
        to: latestVaultState.dumpVaultAddress,
        abi: EMOJI_DUMP_VAULT_ABI,
        functionName: "dump",
        args: [amount],
        vault: latestVaultState
      });
      if (!txHash) return;
      await waitForWalletReceipt(txHash);
      const result = await recordOnchainLotteryDumpAction(
        walletAddress,
        amountNumber,
        txHash,
        latestVaultState.stakedBalance
      );
      applySnapshot(result.game);
      setLotteryState(result.lottery);
      await refreshVault(walletAddress);
      setIsDumpModalOpen(false);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Onchain lottery dump failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const metaFarmView =
    metaFarm ?? {
      poolId: META_FARM.poolId,
      name: META_FARM.name,
      pair: META_FARM.pair,
      vibe: META_FARM.vibe,
      requiredEmoji: META_FARM.requiredEmoji,
      requiredFakeSymbol: META_FARM.requiredFakeSymbol,
      requiredFakeAmount: META_FARM.requiredFakeAmount,
      rewardAllocationEmoji: META_FARM.rewardAllocation,
      remainingRewardsEmoji: META_FARM.rewardAllocation,
      rewardRate: META_FARM.rewardRate,
      baseApy: META_FARM.baseApy,
      lockedEmoji: 0,
      burnedFakeAmount: 0,
      lpBalance: 0,
      totalLockedEmoji: 0,
      totalBurnedFakeAmount: 0,
      totalLp: 0,
      totalHarvestedEmoji: 0,
      unharvestedEmoji: 0,
      unharvestedEmojiPerSecond: 0,
      harvestClicks: 0,
      harvestClicksUntilCooldown: 50,
      harvestCooldownUntil: null,
      harvestBribeUnlockUntil: null
    };

  const renderExplainerButton = (topic: ExplainerKey) => (
    <button
      type="button"
      className="explainer-button"
      onClick={() => setActiveExplainer(topic)}
      aria-label={`Explain ${EXPLAINERS[topic].title}`}
    >
      <img src={EXPLAINER_IMAGE} alt="" />
    </button>
  );

  const chainExplorer = EMOJI_CHAINS[vaultState?.chainId ?? Number(process.env.NEXT_PUBLIC_EMOJI_CHAIN_ID ?? 84532)]
    ?.blockExplorerUrls[0];
  const addressUrl = (address: string | null | undefined) =>
    address && chainExplorer ? `${chainExplorer}/address/${address}` : null;
  const auditContracts = [
    {
      name: "DOPAMINE token",
      address: vaultState?.tokenAddress ?? PUBLIC_EMOJI_TOKEN_ADDRESS,
      note: "ERC20Capped + ERC20Permit + AccessControl. Production cap: 10B, no taxes, no blacklist, no pause."
    },
    {
      name: "Claim / farming mint",
      address: PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS,
      note: "EIP-712 signed claims. Production target: hard 9.9B public emission budget."
    },
    {
      name: "Staking vault",
      address: vaultState?.stakingAddress ?? PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS,
      note: "Stake real DOPAMINE onchain. App mirrors stake into offchain stDOPAMINE for lottery power."
    },
    {
      name: "Dump vault",
      address: vaultState?.dumpVaultAddress ?? PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS,
      note: "Receives panic dumps and holds prize inventory for fixed lottery epochs."
    }
  ];

  return (
    <div className="defi-app">
      <section className="defi-hero">
        <div className="ticker" aria-label="Protocol stats">
          <span>🟢 FAKE DOPAMINE ONLINE</span>
          <span>REAL DOPAMINE WAS 2020</span>
          <span>APY: TOO MUCH</span>
          <span>TVL: {formatUsd(totalTvlUsd)}</span>
          <span>RUG: SELF-DEPRECATING ONLY</span>
          <span>VIBE PRICE: MEDICALLY UNSUPERVISED</span>
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Definitely Audited By The Group Chat</p>
            <div className="hero-title-row">
              <h1>Dopamine Summer</h1>
              <button type="button" className="creator-link-button" onClick={() => setIsCreatorModalOpen(true)}>
                Made by vanzooeth
              </button>
            </div>
            <p>
              DeFi summer was real dopamine. Degen farms were real dopamine. This is the fake
              dopamine simulator where the assets are fake, the clicks are excessive, and the token
              is real enough to make your wallet ask questions.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={connectWallet}>
                {walletAddress ? "Wallet Connected" : "Connect Wallet"}
              </button>
              <button className="secondary" type="button" onClick={pointAtFaucet}>
                Scroll Faucet
              </button>
              <button className="danger audit-open-button" type="button" onClick={() => setIsAuditModalOpen(true)}>
                Audits
              </button>
            </div>
            <p className="hero-status" aria-live="polite">{log}</p>
          </div>
          <div className="token-machine" aria-label="Dopamine token machine">
            {renderExplainerButton("claim")}
            <div className="coin-stack">
              <span>🫠</span>
              <span>🫠</span>
              <span>🫠</span>
            </div>
            <div className="machine-screen">
              <strong>{formatToken(pendingEmoji)} 🫠</strong>
              <span>pending DOPAMINE claim, still no value</span>
              <div className="machine-balances">
                <small>DOPAMINE {formatToken(claimedEmoji)}</small>
                <small>LP units {formatToken(totalLp)}</small>
                <small>stDOPAMINE {formatToken(lotteryState?.yourStEmojiAvailable ?? 0)}</small>
                <small>Tickets {formatToken(lotteryState?.yourStEmojiDeposited ?? 0)}</small>
              </div>
            </div>
            <button type="button" onClick={(event) => runWalletAction(event, claimRewards)} className={!walletAddress ? "wallet-gated" : ""}>
              Claim DOPAMINE
            </button>
            {claimTxHash ? <small className="tx-hash">TX {claimTxHash.slice(0, 10)}...{claimTxHash.slice(-8)}</small> : null}
          </div>
        </div>
      </section>

      <section className="protocol-strip" aria-label="Protocol summary">
        <div>
          <span>Wallet</span>
          <strong>{walletLabel ?? "Not connected"}</strong>
        </div>
        <div>
          <span>LP Positions</span>
          <strong>{formatToken(totalLpPositions)}</strong>
        </div>
        <div>
          <span>Fake TVL</span>
          <strong>{formatUsd(totalTvlUsd)}</strong>
        </div>
        <div>
          <span>Reward Token</span>
          <strong>{formatToken(claimedEmoji)} claimed</strong>
        </div>
        <div>
          <span>Faucet Clicks</span>
          <strong>{formatToken(faucetClicks)}</strong>
        </div>
        <div>
          <span>Vibe Price</span>
          <strong>${formatPrice(vibePrice)}</strong>
        </div>
      </section>

      <main className="defi-grid">
        <section className="farm-board" aria-label="Farming pools">
          <div className="chart-board-shell">
            <button
              type="button"
              className="forbidden-pool-easter-egg"
              onClick={() => setIsForbiddenPoolModalOpen(true)}
              aria-label="Open forbidden pool"
            >
              <img src="/hidden-skull.png" alt="" />
            </button>
          <section className="chart-board" aria-label="Fake DOPAMINE price game">
            {renderExplainerButton("price")}
            <div className="section-heading">
              <p className="eyebrow">Fake Market</p>
              <h2>Vibe Price</h2>
            </div>
            <div className="price-grid">
              <div>
                <span>Fake DOPAMINE</span>
                <strong>${formatPrice(vibePrice)}</strong>
                <small>not a market, not redeemable</small>
              </div>
              <div>
                <span>Hype</span>
                <strong>{Math.round(hype)}%</strong>
                <small>farmers pushing the candle</small>
              </div>
              <div>
                <span>Jeet Pressure</span>
                <strong>{Math.round(jeetPressure)}%</strong>
                <small>{dipBoost.toFixed(2)}x dip boost</small>
              </div>
            </div>
            <div className="vibe-chart" aria-hidden="true">
              {chartPoints.map((point, index) => (
                <span key={`${point}-${index}`} style={{ height: `${point}%` }} />
              ))}
            </div>
            <div className="dump-controls">
              <button type="button" onClick={(event) => runWalletAction(event, dumpOnChart)} disabled={isBusy} className={!walletAddress ? "wallet-gated" : ""}>
                Dump On Chart
              </button>
              <button className={`danger ${!walletAddress ? "wallet-gated" : ""}`} type="button" onClick={(event) => runWalletAction(event, panicSell)} disabled={isBusy}>
                Panic Sell
              </button>
            </div>
            <div className="dump-stats">
              <span>{formatToken(dumpedEmoji)} dumped</span>
              <span>{panicClicks} panic clicks</span>
              <span>APY rises when morale falls</span>
            </div>
          </section>
          </div>

          <nav className="gameplay-tabs" aria-label="Gameplay sections">
            <button
              type="button"
              className={activeTab === "farms" ? "active" : ""}
              onClick={() => setActiveTab("farms")}
            >
              Farms
            </button>
            <button
              type="button"
              className={activeTab === "staking" ? "active" : ""}
              onClick={() => setActiveTab("staking")}
            >
              Staking
            </button>
            <button
              type="button"
              className={activeTab === "lottery" ? "active" : ""}
              onClick={() => setActiveTab("lottery")}
            >
              Lottery
            </button>
            <button
              type="button"
              className={activeTab === "meta" ? "active" : ""}
              onClick={() => setActiveTab("meta")}
            >
              Meta Farm
            </button>
          </nav>

          {activeTab === "staking" ? (
          <section className="chart-board vault-board" aria-label="Onchain staking">
            {renderExplainerButton("staking")}
            <div className="section-heading">
              <p className="eyebrow">Staking</p>
              <h2>Stake DOPAMINE</h2>
            </div>
            <div className="price-grid">
              <div>
                <span>Wallet DOPAMINE</span>
                <strong>{formatToken(vaultState?.tokenBalance ?? 0)}</strong>
                <small>real token balance</small>
              </div>
              <div>
                <span>Your Stake</span>
                <strong>{formatToken(vaultState?.stakedBalance ?? 0)}</strong>
                <small>{formatToken(vaultState?.totalStaked ?? 0)} total staked</small>
              </div>
              <div>
                <span>stDOPAMINE</span>
                <strong>{formatToken(lotteryState?.yourStEmojiAvailable ?? 0)}</strong>
                <small>offchain lottery tickets available</small>
              </div>
            </div>
            <div className="dump-stats">
              <span>{formatToken(vaultState?.stakingApy ?? STAKING_REWARD_APY)}% staking APY</span>
              <span>{formatToken(vaultState?.stakingRewardSupply ?? STAKING_REWARD_SUPPLY)} 🫠 reward budget</span>
              <span>rewards accrue to pending DOPAMINE</span>
            </div>
            <div className="vault-controls">
              <label>
                <span>Stake DOPAMINE</span>
                <input value={stakeAmount} onChange={(event) => setStakeAmount(event.target.value)} inputMode="decimal" />
              </label>
              <button type="button" onClick={(event) => runWalletAction(event, stakeEmoji)} disabled={isBusy || (!!walletAddress && !vaultState?.configured)} className={!walletAddress ? "wallet-gated" : ""}>
                Approve + Stake
              </button>
              <label>
                <span>Withdraw DOPAMINE</span>
                <input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} inputMode="decimal" />
              </label>
              <button type="button" className={`secondary ${!walletAddress ? "wallet-gated" : ""}`} onClick={(event) => runWalletAction(event, withdrawEmoji)} disabled={isBusy || (!!walletAddress && !vaultState?.configured)}>
                Withdraw
              </button>
            </div>
          </section>
          ) : null}

          {activeTab === "lottery" ? (
          <section className="chart-board vault-board" aria-label="Fixed lottery">
            {renderExplainerButton("lottery")}
            <div className="section-heading">
              <p className="eyebrow">Lottery</p>
              <h2>3-hour dump pool</h2>
              <p className="section-note">Stake creates offchain stDOPAMINE. Deposit stDOPAMINE into this epoch to be eligible.</p>
            </div>
            <div className="reserve-row" aria-label="Lottery epoch state">
              <span>Epoch #{lotteryState?.epochId ?? 0}</span>
              <span>Ends {formatDateTime(lotteryState?.endsAt ?? null)}</span>
              <span>{formatToken(lotteryState?.secondsRemaining ?? 0)}s left</span>
              <span>Dumped {formatToken(lotteryState?.totalDumpedEmoji ?? 0)} 🫠</span>
            </div>
            <div className="reserve-row" aria-label="Lottery settlement state">
              <span>Pool stDOPAMINE {formatToken(lotteryState?.totalStEmoji ?? 0)}</span>
              <span>Your deposit {formatToken(lotteryState?.yourStEmojiDeposited ?? 0)}</span>
              <span>Last prize {formatToken(lotteryState?.previousPrizeEmoji ?? 0)} 🫠</span>
              <span>Last winner {lotteryState?.previousWinner ?? "TBD"}</span>
            </div>
            <div className="vault-controls">
              <label>
                <span>Deposit stDOPAMINE</span>
                <input value={stEmojiDepositAmount} onChange={(event) => setStEmojiDepositAmount(event.target.value)} inputMode="decimal" />
              </label>
              <button type="button" onClick={(event) => runWalletAction(event, depositStEmoji)} disabled={isBusy} className={!walletAddress ? "wallet-gated" : ""}>
                Deposit stDOPAMINE
              </button>
            </div>
          </section>
          ) : null}

          {activeTab === "meta" ? (
          <section className="chart-board vault-board" aria-label="Meta farm">
            {renderExplainerButton("meta")}
            <div className="section-heading">
              <p className="eyebrow">Meta Farm</p>
              <h2>{metaFarmView.name}</h2>
              <p className="section-note">{metaFarmView.vibe}</p>
            </div>
            <div className="price-grid">
              <div>
                <span>Pair</span>
                <strong>{metaFarmView.pair}</strong>
                <small>{formatToken(metaFarmView.baseApy)}% recursively advertised APY</small>
              </div>
              <div>
                <span>Your Reactor LP</span>
                <strong>{formatToken(metaFarmView.lpBalance)}</strong>
                <small>{formatToken(metaFarmView.unharvestedEmoji)} DOPAMINE compiled</small>
              </div>
              <div>
                <span>Protocol Delusion</span>
                <strong>{formatToken(metaFarmView.totalLockedEmoji)}</strong>
                <small>real DOPAMINE fed to the machine</small>
              </div>
            </div>
            <div className="reserve-row" aria-label="Meta farm recipe">
              <span>Requires {formatToken(metaFarmView.requiredEmoji)} DOPAMINE</span>
              <span>Burns {formatToken(metaFarmView.requiredFakeAmount)} {metaFarmView.requiredFakeSymbol}</span>
              <span>Remaining {formatToken(metaFarmView.remainingRewardsEmoji)} 🫠</span>
              <span>
                {metaFarmView.harvestBribeUnlockUntil
                  ? `Bribed until ${formatDateTime(metaFarmView.harvestBribeUnlockUntil)}`
                  : metaFarmView.harvestCooldownUntil
                  ? `Cooling until ${formatDateTime(metaFarmView.harvestCooldownUntil)}`
                  : `${metaFarmView.harvestClicksUntilCooldown} harvests to timeout`}
              </span>
            </div>
            <div className="reserve-row" aria-label="Meta farm totals">
              <span>Total LP {formatToken(metaFarmView.totalLp)}</span>
              <span>Fake burned {formatToken(metaFarmView.totalBurnedFakeAmount)} {metaFarmView.requiredFakeSymbol}</span>
              <span>Harvested {formatToken(metaFarmView.totalHarvestedEmoji)} 🫠</span>
              <span>Rate {formatToken(metaFarmView.rewardRate)} / min / LP</span>
            </div>
            <div className="vault-controls">
              <button type="button" className={`danger ${!walletAddress ? "wallet-gated" : ""}`} onClick={(event) => runWalletAction(event, enterMetaFarm)} disabled={isBusy}>
                Feed Reactor
              </button>
              <button
                type="button"
                className={`secondary ${!walletAddress ? "wallet-gated" : ""} ${metaFarmView.harvestCooldownUntil && !metaFarmView.harvestBribeUnlockUntil ? "cooldown-muted" : ""}`}
                onMouseDown={(event) => {
                  if (walletAddress && !(metaFarmView.harvestCooldownUntil && !metaFarmView.harvestBribeUnlockUntil)) spawnHarvestBurst(event);
                }}
                onClick={(event) => runWalletAction(event, harvestMetaFarm)}
                disabled={isBusy || (!!metaFarmView.harvestCooldownUntil && !metaFarmView.harvestBribeUnlockUntil)}
              >
                Harvest Recursive DOPAMINE
              </button>
              {metaFarmView.harvestCooldownUntil ? (
                <button
                  type="button"
                  className={`danger bribe-button ${!walletAddress ? "wallet-gated" : ""}`}
                  onClick={(event) => runWalletAction(event, () => openHarvestBribeModal(META_FARM.poolId, "recursive harvest"))}
                  disabled={isBusy}
                >
                  BRIBE DEV
                </button>
              ) : null}
            </div>
          </section>
          ) : null}

          {activeTab === "farms" ? (
          <>
          <div className="section-heading farm-section-heading">
            {renderExplainerButton("farms")}
            <p className="eyebrow">Liquidity Mining</p>
            <h2>Choose your farm</h2>
            <p className="section-note">
              {formatToken(FARM_REWARD_SUPPLY)} of {formatToken(EMOJI_MAX_SUPPLY)} DOPAMINE are allocated to LP farms.
            </p>
          </div>
          <div className="pool-list">
            {POOLS.map((pool) => {
              const poolState = poolStates[pool.id];
              const rewardAllocation = poolState?.rewardAllocationEmoji ?? pool.rewardAllocation;
              const emittedRewards = poolState?.totalEmittedEmoji ?? poolState?.totalHarvestedEmoji ?? 0;
              const remainingRewards = poolState?.remainingRewardsEmoji ?? rewardAllocation;
              const harvestCooldownUntil = poolState?.harvestCooldownUntil;
              const harvestBribeUnlockUntil = poolState?.harvestBribeUnlockUntil;
              const isHarvestCoolingDown = !!harvestCooldownUntil;
              const isHarvestBribeUnlocked = !!harvestBribeUnlockUntil;
              return (
                <article className="pool-card" key={pool.id} style={{ "--pool-color": pool.color } as React.CSSProperties}>
                  <div className="pool-top">
                    <div>
                      <h3>{pool.pair}</h3>
                      <p>{pool.vibe}</p>
                    </div>
                    <div className="apy-badge">{formatToken(Math.round(pool.baseApy * dipBoost))}% APY</div>
                  </div>
                  <div className="pool-stats">
                    <span>TVL {formatUsd(poolState?.tvlUsd ?? 0)}</span>
                    <span>LP {formatToken(lpBalances[pool.id] ?? 0)}</span>
                    <span>{formatToken(poolState?.unharvestedEmoji ?? 0)} 🫠 farmable</span>
                  </div>
                  <div className="reserve-row" aria-label={`${pool.pair} fake reserves`}>
                    <span>Reserve A {formatToken(poolState?.reserveA ?? 0)}</span>
                    <span>Reserve B {formatToken(poolState?.reserveB ?? 0)}</span>
                    <span>Total LP {formatToken(poolState?.totalLp ?? 0)}</span>
                    <span>Harvests {formatToken(poolState?.harvestClicks ?? 0)}</span>
                  </div>
                  <div className="reserve-row" aria-label={`${pool.pair} reward allocation`}>
                    <span>Allocation {formatToken(rewardAllocation)} 🫠</span>
                    <span>Emitted {formatToken(emittedRewards)} 🫠</span>
                    <span>Remaining {formatToken(remainingRewards)} 🫠</span>
                    <span>
                      {isHarvestBribeUnlocked
                        ? `Bribed until ${new Date(harvestBribeUnlockUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                        : harvestCooldownUntil
                        ? `Cooling until ${new Date(harvestCooldownUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                        : `${poolState?.harvestClicksUntilCooldown ?? 50} harvests to timeout`}
                    </span>
                  </div>
                  <div className="recipe-row" aria-label={`${pool.pair} recipe`}>
                    {Object.entries(pool.recipe).map(([symbol, amount]) => (
                      <span key={symbol}>
                        {formatToken(amount)} {symbol}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={(event) => runWalletAction(event, () => supplyPool(pool.id))} disabled={isBusy} className={!walletAddress ? "wallet-gated" : ""}>
                    Supply LP
                  </button>
                  <button
                    className={`secondary harvest-button ${!walletAddress ? "wallet-gated" : ""} ${isHarvestCoolingDown && !isHarvestBribeUnlocked ? "cooldown-muted" : ""}`}
                    type="button"
                    onMouseDown={(event) => {
                      if (walletAddress && !(isHarvestCoolingDown && !isHarvestBribeUnlocked)) spawnHarvestBurst(event);
                    }}
                    onClick={(event) => runWalletAction(event, () => harvestPool(pool.id))}
                    disabled={isBusy || (isHarvestCoolingDown && !isHarvestBribeUnlocked)}
                  >
                    Harvest Click
                  </button>
                  {isHarvestCoolingDown ? (
                    <button
                      type="button"
                      className={`danger bribe-button harvest-bribe-button ${!walletAddress ? "wallet-gated" : ""}`}
                      onClick={(event) => runWalletAction(event, () => openHarvestBribeModal(pool.id, `${pool.pair} harvest`))}
                      disabled={isBusy}
                    >
                      BRIBE DEV
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
          </>
          ) : null}
        </section>

        <aside className="side-console" aria-label="Faucet and balances" ref={faucetRef}>
          <div className="console-card">
            {renderExplainerButton("faucet")}
            <div className="section-heading">
              <p className="eyebrow">Faucet</p>
              <h2>Mint fake assets</h2>
            </div>
            <div className="asset-list">
              {FAUCET_ASSETS.map((asset) => {
                const cooldownUntil = faucetStatus[asset.symbol]?.cooldownUntil;
                const cooldownUntilMs = cooldownUntil ? new Date(cooldownUntil).getTime() : 0;
                const bribeUnlockUntil = faucetStatus[asset.symbol]?.bribeUnlockUntil;
                const bribeUnlockUntilMs = bribeUnlockUntil ? new Date(bribeUnlockUntil).getTime() : 0;
                const isCoolingDown = cooldownUntilMs > nowMs;
                const isBribeUnlocked = bribeUnlockUntilMs > nowMs;
                return (
                  <div className="asset-row" key={asset.symbol}>
                    <span className="asset-icon">{asset.emoji}</span>
                    <div>
                      <strong>{asset.symbol}</strong>
                      <small>
                        +{formatToken(asset.amount)} per click · {asset.name}
                      </small>
                      <small>
                        {isBribeUnlocked
                          ? `Bribed until ${new Date(bribeUnlockUntilMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                          : isCoolingDown
                          ? `Cooling until ${new Date(cooldownUntilMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                          : `${faucetStatus[asset.symbol]?.clicksUntilCooldown ?? 10} clicks before cooldown`}
                      </small>
                    </div>
                    <b>{formatToken(balances[asset.symbol])}</b>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        if (walletAddress) spawnDopamineBurst(event);
                      }}
                      onClick={(event) => runWalletAction(event, () => mintFaucetAsset(asset.symbol))}
                      disabled={isBusy || (isCoolingDown && !isBribeUnlocked)}
                      className={!walletAddress ? "wallet-gated" : ""}
                    >
                      Mint {asset.symbol}
                    </button>
                    {isCoolingDown ? (
                      <button type="button" className={`danger bribe-button ${!walletAddress ? "wallet-gated" : ""}`} onClick={(event) => runWalletAction(event, () => openFaucetBribeModal(asset.symbol))} disabled={isBusy}>
                        BRIBE DEV
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="console-card terminal">
            <div className="terminal-bar">
              <span />
              <span />
              <span />
            </div>
            <p>{log}</p>
          </div>

          <div className="console-card claim-history">
            <div className="section-heading">
              <p className="eyebrow">Receipts</p>
              <h2>Claim history</h2>
            </div>
            {claimHistory.length > 0 ? (
              <div className="claim-list">
                {claimHistory.map((claim) => (
                  <article className="claim-row" key={claim.id}>
                    <div>
                      <strong>Claim #{claim.nonce}</strong>
                      <span>{formatToken(claim.amount)} DOPAMINE · {formatClaimDate(claim.createdAt)}</span>
                    </div>
                    {claim.explorerUrl ? (
                      <a href={claim.explorerUrl} target="_blank" rel="noreferrer">
                        BaseScan
                      </a>
                    ) : (
                      <small>{claim.status}</small>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-history">No receipts yet. Farm, claim, then pretend this was alpha.</p>
            )}
          </div>
        </aside>
      </main>
      {isDumpModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Dump DOPAMINE to lottery">
          <div className="dump-modal">
            <div className="section-heading">
              <p className="eyebrow">Dump</p>
              <h2>Send it to lottery</h2>
            </div>
            <p>
              Dumped DOPAMINE leaves your app balance and joins the current 3-hour lottery prize pool.
            </p>
            <label>
              <span>DOPAMINE amount</span>
              <input value={lotteryDumpAmount} onChange={(event) => setLotteryDumpAmount(event.target.value)} inputMode="decimal" />
            </label>
            <div className="dump-controls">
              <button type="button" className={`danger ${!walletAddress ? "wallet-gated" : ""}`} onClick={() => void dumpEmojiToLottery()} disabled={isBusy}>
                DUMP
              </button>
              <button type="button" className="secondary" onClick={() => setIsDumpModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isBribeModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Bribe dev to unfreeze faucet">
          <div className="dump-modal bribe-modal">
            <div className="section-heading">
              <p className="eyebrow">Corruption Layer</p>
              <h2>Bribe me daddy!</h2>
            </div>
            <p>
              Send real USDC to the dev* address (to pay AI overlord bills) and the {bribeTarget?.label ?? "button"} gets unfrozen on a proudly unfair sliding scale.
              <br />
              <br />
              *prompting monkey, doesn't know a shit about code tbf
            </p>
            <div className="bribe-fine-print">
              <span>Target {bribeTarget?.label ?? "none"}</span>
              <span>Dev {displayAddress(DEV_DONATION_ADDRESS || vaultState?.ownerAddress || "")}</span>
              <span>{DEV_BRIBE_TIERS[bribeTierIndex]?.label ?? "1 minute"} unlock</span>
            </div>
            <label className="bribe-slider">
              <span>Tip size</span>
              <input
                type="range"
                min="0"
                max={DEV_BRIBE_TIERS.length - 1}
                step="1"
                value={bribeTierIndex}
                onChange={(event) => setBribeTierIndex(Number(event.target.value))}
              />
            </label>
            <div className="bribe-scale" aria-label="Dev bribe tiers">
              {DEV_BRIBE_TIERS.map((tier, index) => (
                <button
                  type="button"
                  className={index === bribeTierIndex ? "active" : ""}
                  key={tier.amount}
                  onClick={() => setBribeTierIndex(index)}
                >
                  <strong>{tier.amount} USDC</strong>
                  <span>{tier.label}</span>
                </button>
              ))}
            </div>
            <div className="dump-controls">
              <button type="button" className={`danger ${!walletAddress ? "wallet-gated" : ""}`} onClick={(event) => runWalletAction(event, () => void bribeDev())} disabled={isBusy}>
                Send {DEV_BRIBE_TIERS[bribeTierIndex]?.amount ?? 0.5} USDC
              </button>
              <button type="button" className="secondary" onClick={() => setIsBribeModalOpen(false)}>
                NAH, I'LL CUCK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isAuditModalOpen ? (
        <div className="modal-backdrop audit-backdrop" role="dialog" aria-modal="true" aria-label="DOPAMINE audits and tokenomics">
          <div className="dump-modal audit-modal">
            <div className="section-heading">
              <p className="eyebrow">Audits</p>
              <h2>Imagine lol</h2>
            </div>
            <p className="audit-lede">
              Of course there are no audits, but I told Codex "make no mistakes".
            </p>
            <div className="audit-warning">
              DOPAMINE is a joke token for an absurd clicking game. It has no promised value, no redemption, no roadmap,
              and no expectation of profit. If a real Uniswap pool appears, that is the simulation breaching containment.
            </div>
            <div className="audit-grid">
              <div>
                <span>Max supply</span>
                <strong>{formatToken(EMOJI_MAX_SUPPLY)}</strong>
                <small>hard cap, never more</small>
              </div>
              <div>
                <span>Dev reserve</span>
                <strong>{formatToken(DEV_RESERVE_SUPPLY)}</strong>
                <small>1%, minted once at production deploy</small>
              </div>
              <div>
                <span>Public game budget</span>
                <strong>{formatToken(PUBLIC_GAME_SUPPLY)}</strong>
                <small>claims, farms, staking, meta nonsense</small>
              </div>
            </div>
            <div className="audit-section">
              <h3>Production rules</h3>
              <ul>
                <li>Owner should not keep mint power after deployment setup.</li>
                <li>Only fixed-purpose contracts should mint, and they should have their own emission ceilings.</li>
                <li>No taxes, no blacklist, no pause, no transfer restrictions, no upgradeability.</li>
                <li>After setup, admin/minter-granting power should be revoked or renounced.</li>
              </ul>
            </div>
            <div className="audit-section">
              <h3>Current test contracts</h3>
              <div className="contract-list">
                {auditContracts.map((contract) => {
                  const explorerUrl = addressUrl(contract.address);
                  return (
                    <article className="contract-row" key={contract.name}>
                      <div>
                        <strong>{contract.name}</strong>
                        <span>{contract.address ? displayAddress(contract.address) : "not configured"}</span>
                        <small>{contract.note}</small>
                      </div>
                      {explorerUrl ? (
                        <a href={explorerUrl} target="_blank" rel="noreferrer">
                          Contract
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="dump-controls">
              <button type="button" className="secondary" onClick={() => setIsAuditModalOpen(false)}>
                Seems legit
              </button>
              {chainExplorer ? (
                <a className="modal-link-button" href={chainExplorer} target="_blank" rel="noreferrer">
                  Open Explorer
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {isForbiddenPoolModalOpen ? (
        <div className="modal-backdrop forbidden-pool-backdrop" role="dialog" aria-modal="true" aria-label="Forbidden DOPAMINE pool">
          <div className="dump-modal forbidden-pool-modal">
            <div className="section-heading">
              <p className="eyebrow">Experimental Door</p>
              <h2>The forbidden real pool</h2>
            </div>
            <p className="forbidden-pool-lede">
              Somebody can make this worse on Uniswap.
            </p>
            <div className="forbidden-warning">
              DOPAMINE has no promised value, no roadmap, no redemption, and no expectation of profit.
              A real pool may exist only because the internet cannot be stopped.
            </div>
            <div className="forbidden-address">
              <span>DOPAMINE token</span>
              <strong>{PUBLIC_EMOJI_TOKEN_ADDRESS ?? "not configured"}</strong>
              <small>If a pool exists, the fake vibe price has escaped containment.</small>
            </div>
            <div className="forbidden-grid">
              <div>
                <span>Pair</span>
                <strong>DOPAMINE/WETH</strong>
                <small>Uniswap uses wrapped ETH under the hood for ERC-20 pools.</small>
              </div>
              <div>
                <span>Suggested tiers</span>
                <strong>1% or 0.3%</strong>
                <small>Chaotic meme assets deserve volatile-pair fees, not stablecoin cosplay.</small>
              </div>
              <div>
                <span>V3 position</span>
                <strong>NFT LP</strong>
                <small>Uniswap v3 liquidity positions are represented as NFTs.</small>
              </div>
            </div>
            <div className="forbidden-status-stack">
              <p>NO REAL POOL YET</p>
              <p>DOPAMINE STILL TRAPPED IN SIMULATION</p>
              <p>BE THE FIRST LIQUIDITY SICKO</p>
            </div>
            <div className="forbidden-source-row">
              <a href="https://support.uniswap.org/hc/en-us/articles/7423194619661-How-to-add-a-new-liquidity-position-to-Uniswap-v3" target="_blank" rel="noreferrer">
                Uniswap v3 liquidity docs
              </a>
              <a href="https://support.uniswap.org/hc/en-us/articles/20904283758349-What-are-fee-tiers" target="_blank" rel="noreferrer">
                Fee tiers
              </a>
            </div>
            <div className="dump-controls">
              <a className="modal-link-button" href={UNISWAP_TOKEN_URL} target="_blank" rel="noreferrer">
                Open Uniswap
              </a>
              <a className="modal-link-button forbidden-create-link" href={UNISWAP_CREATE_POOL_URL} target="_blank" rel="noreferrer">
                Create DOPAMINE/WETH Pool
              </a>
            </div>
            <button type="button" className="secondary" onClick={() => setIsForbiddenPoolModalOpen(false)}>
              Keep it fake
            </button>
          </div>
        </div>
      ) : null}
      {isCreatorModalOpen ? (
        <div className="modal-backdrop creator-backdrop" role="dialog" aria-modal="true" aria-label="About vanzooeth">
          <div className="dump-modal creator-modal">
            <img className="creator-avatar" src="/vanzooeth-avatar.jpg" alt="vanzooeth profile" />
            <div className="section-heading">
              <p className="eyebrow">Made By</p>
              <h2>vanzooeth</h2>
            </div>
            <p>
              Built this dopamine simulator for people who remember when DeFi felt like a casino
              stapled to a spreadsheet. Fake assets, real contracts, questionable life choices,
              and a lot of clicking.
            </p>
            <div className="dump-controls">
              <a className="modal-link-button creator-x-link" href="https://x.com/vanzooeth" target="_blank" rel="noreferrer">
                Follow me on X
              </a>
              <button type="button" className="secondary" onClick={() => setIsCreatorModalOpen(false)}>
                Back to farm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeExplainer ? (
        <div className="modal-backdrop explainer-backdrop" role="dialog" aria-modal="true" aria-label={`${EXPLAINERS[activeExplainer].title} explainer`}>
          <div className="dump-modal explainer-modal">
            <img className="explainer-modal-image" src={EXPLAINER_IMAGE} alt="" />
            <div className="section-heading">
              <p className="eyebrow">{EXPLAINERS[activeExplainer].eyebrow}</p>
              <h2>{EXPLAINERS[activeExplainer].title}</h2>
            </div>
            <div className="explainer-list">
              {EXPLAINERS[activeExplainer].bullets.map((bullet) => (
                <p key={bullet}>{bullet}</p>
              ))}
            </div>
            <div className="explainer-actions">
              <button type="button" className="secondary" onClick={() => setActiveExplainer(null)}>
                OK I GET IT
              </button>
              <button type="button" className="danger" onClick={() => setHeartStormId(Date.now())}>
                You are retarded
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {heartStormId ? (
        <div className="heart-storm-layer" aria-hidden="true" key={`hearts-${heartStormId}`}>
          {EXPLAINER_HEARTS.map((heart) => (
            <span
              className="heart-storm-heart"
              key={heart.id}
              style={
                {
                  "--heart-left": `${heart.left}%`,
                  "--heart-delay": `${heart.delay}ms`,
                  "--heart-duration": `${heart.duration}ms`,
                  "--heart-size": `${heart.size}px`,
                  "--heart-drift": `${heart.drift}px`,
                  "--heart-rotation": `${heart.rotation}deg`
                } as React.CSSProperties
              }
            >
              💖
            </span>
          ))}
        </div>
      ) : null}
      {claimCelebration ? (
        <>
          <div className="claim-party-layer" aria-hidden="true" key={`party-${claimCelebration.id}`}>
            {CLAIM_CONFETTI.map((piece) => (
              <span
                className="claim-confetti-piece"
                key={piece.id}
                style={
                  {
                    "--confetti-left": `${piece.left}%`,
                    "--confetti-delay": `${piece.delay}ms`,
                    "--confetti-duration": `${piece.duration}ms`,
                    "--confetti-color": piece.color
                  } as React.CSSProperties
                }
              />
            ))}
            {FLYING_DOPAMINE.map((piece) => (
              <span
                className="flying-dopamine"
                key={piece.id}
                style={
                  {
                    "--dopamine-left": `${piece.left}%`,
                    "--dopamine-delay": `${piece.delay}ms`,
                    "--dopamine-size": `${piece.size}px`
                  } as React.CSSProperties
                }
              >
                🫠
              </span>
            ))}
          </div>
          <div className="modal-backdrop claim-modal-backdrop" role="dialog" aria-modal="true" aria-label="DOPAMINE claimed">
            <div className="dump-modal claim-modal">
              <div className="claim-modal-coin" aria-hidden="true">🫠</div>
              <div className="section-heading">
                <p className="eyebrow">Claimed</p>
                <h2>{formatToken(claimCelebration.amount)} DOPAMINE claimed</h2>
              </div>
              <p>
                Wallet dopamine receptors overloaded. Still no intrinsic value, now with more theatrical accounting.
              </p>
              <button type="button" className="danger" onClick={() => setClaimCelebration(null)}>
                Nice
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

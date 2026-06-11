export type AssetSymbol = "fETH" | "fHYPE" | "fUSDC" | "fUSDT" | "fWBTC";

export type Pool = {
  id: string;
  pair: `${AssetSymbol}/${AssetSymbol}`;
  vibe: string;
  baseApy: number;
  rewardRate: number;
  rewardAllocation: number;
  color: string;
  recipe: Partial<Record<AssetSymbol, number>>;
};

export type GameSnapshot = {
  wallet: string;
  displayAddress: string;
  balances: Record<AssetSymbol, number>;
  lpBalances: Record<string, number>;
  poolStates: Record<string, PoolStateSnapshot>;
  faucetStatus: Record<AssetSymbol, FaucetAssetStatus>;
  claimHistory: ClaimHistoryItem[];
  claimedEmoji: number;
  pendingEmoji: number;
  faucetClicks: number;
  claimNonce: number;
  hype: number;
  jeetPressure: number;
  vibePrice: number;
  chartPoints: number[];
  dumpedEmoji: number;
  panicClicks: number;
  preparedClaim?: PreparedEmojiClaim;
  preservePoolStates?: boolean;
  lottery?: LotterySnapshot;
  metaFarm?: MetaFarmSnapshot;
  log: string;
};

export type MetaFarmSnapshot = {
  poolId: string;
  name: string;
  pair: string;
  vibe: string;
  requiredEmoji: number;
  requiredFakeSymbol: AssetSymbol;
  requiredFakeAmount: number;
  rewardAllocationEmoji: number;
  remainingRewardsEmoji: number;
  rewardRate: number;
  baseApy: number;
  lockedEmoji: number;
  burnedFakeAmount: number;
  lpBalance: number;
  totalLockedEmoji: number;
  totalBurnedFakeAmount: number;
  totalLp: number;
  totalHarvestedEmoji: number;
  unharvestedEmoji: number;
  unharvestedEmojiPerSecond: number;
  harvestClicks: number;
  harvestClicksUntilCooldown: number;
  harvestCooldownUntil: string | null;
  harvestBribeUnlockUntil: string | null;
};

export type LotterySnapshot = {
  epochId: number;
  startsAt: string;
  endsAt: string;
  secondsRemaining: number;
  totalDumpedEmoji: number;
  totalStEmoji: number;
  yourStEmojiDeposited: number;
  yourStEmojiAvailable: number;
  previousEpochId: number | null;
  previousPrizeEmoji: number;
  previousWinner: string | null;
  previousWonByYou: boolean;
};

export type PoolStateSnapshot = {
  reserveA: number;
  reserveB: number;
  tvlUsd: number;
  totalLp: number;
  suppliedCount: number;
  harvestClicks: number;
  totalHarvestedEmoji: number;
  totalEmittedEmoji: number;
  emittedEmojiPerSecond: number;
  remainingRewardsEmoji: number;
  rewardAllocationEmoji: number;
  unharvestedEmoji: number;
  unharvestedEmojiPerSecond: number;
  snapshotAt: string;
  harvestStreakClicks: number;
  harvestClicksUntilCooldown: number;
  harvestCooldownUntil: string | null;
  harvestBribeUnlockUntil: string | null;
};

export type FaucetAssetStatus = {
  streakClicks: number;
  clicksUntilCooldown: number;
  cooldownUntil: string | null;
  bribeUnlockUntil: string | null;
};

export type ClaimHistoryItem = {
  id: string;
  nonce: number;
  amount: number;
  txHash: string | null;
  explorerUrl: string | null;
  status: "prepared" | "submitted";
  createdAt: string;
};

export type PreparedEmojiClaim = {
  wallet: `0x${string}`;
  amount: string;
  amountWei: string;
  nonce: string;
  deadline: string;
  claimHash: string;
  signature: `0x${string}`;
  claimContract: `0x${string}`;
  chainId: number;
};

export type OnchainVaultSnapshot = {
  configured: boolean;
  chainId: number;
  tokenAddress: `0x${string}` | null;
  stakingAddress: `0x${string}` | null;
  dumpVaultAddress: `0x${string}` | null;
  ownerAddress: `0x${string}` | null;
  wallet: `0x${string}`;
  tokenBalance: number;
  stakedBalance: number;
  totalStaked: number;
  stakingAllowance: number;
  dumpAllowance: number;
  currentEpochId: number;
  epochStartsAt: string | null;
  epochEndsAt: string | null;
  epochTotalDumped: number;
  epochPrizePaid: number;
  epochWinner: string | null;
  epochSettled: boolean;
  dumpedThisEpoch: number;
  vaultBalance: number;
  stakingApy: number;
  stakingRewardSupply: number;
  stakingRewardsCredited: number;
};

export type EmojiChainConfig = {
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

export const FAUCET_ASSETS: Array<{ symbol: AssetSymbol; dbSymbol: string; name: string; amount: number; emoji: string }> = [
  { symbol: "fETH", dbSymbol: "FETH", name: "Fake Ether", amount: 0.01, emoji: "Ξ" },
  { symbol: "fHYPE", dbSymbol: "FHYPE", name: "Fake Hyperliquid", amount: 0.5, emoji: "↗" },
  { symbol: "fUSDC", dbSymbol: "FUSDC", name: "Fake Circle Money", amount: 25, emoji: "$" },
  { symbol: "fUSDT", dbSymbol: "FUSDT", name: "Fake Tether Energy", amount: 25, emoji: "₮" },
  { symbol: "fWBTC", dbSymbol: "FWBTC", name: "Fake Wrapped Corn", amount: 0.0005, emoji: "₿" }
];

export const EMOJI_MAX_SUPPLY = 10_000_000_000;
export const FARM_REWARD_SUPPLY = 6_000_000_000;
export const STAKING_REWARD_SUPPLY = 1_500_000_000;
export const STAKING_REWARD_APY = 420;

export const META_FARM = {
  poolId: "recursive-reactor",
  name: "Recursive Yield Reactor",
  pair: "DOPAMINE/fETH",
  vibe: "Supply DOPAMINE to farm DOPAMINE. This is not circular because the UI calls it a reactor.",
  requiredEmoji: 25,
  requiredFakeSymbol: "fETH" as AssetSymbol,
  requiredFakeAmount: 0.01,
  rewardAllocation: 500_000_000,
  rewardRate: 42,
  baseApy: 20240
};

export const FAKE_ASSET_PRICES_USD: Record<AssetSymbol, number> = {
  fETH: 3500,
  fHYPE: 35,
  fUSDC: 1,
  fUSDT: 1,
  fWBTC: 105000
};

export const POOLS: Pool[] = [
  {
    id: "moon",
    pair: "fETH/fUSDC",
    vibe: "Genesis pool for people who still say impermanent loss builds character.",
    baseApy: 4206,
    rewardRate: 18,
    rewardAllocation: 2_700_000_000,
    color: "#ffcc33",
    recipe: { fETH: 0.04, fUSDC: 100 }
  },
  {
    id: "ponzu",
    pair: "fHYPE/fUSDT",
    vibe: "A suspiciously green candle with a vesting cliff made of vibes.",
    baseApy: 9001,
    rewardRate: 28,
    rewardAllocation: 2_100_000_000,
    color: "#35c66b",
    recipe: { fHYPE: 2, fUSDT: 100 }
  },
  {
    id: "corn",
    pair: "fWBTC/fETH",
    vibe: "Blue chip fake assets, artisanal emissions, extremely serious chart noises.",
    baseApy: 1337,
    rewardRate: 11,
    rewardAllocation: 1_200_000_000,
    color: "#ff8a3d",
    recipe: { fWBTC: 0.002, fETH: 0.04 }
  }
];

export const INITIAL_BALANCES: Record<AssetSymbol, number> = {
  fETH: 0,
  fHYPE: 0,
  fUSDC: 0,
  fUSDT: 0,
  fWBTC: 0
};

export const INITIAL_CHART_POINTS = [34, 37, 35, 42, 48, 44, 52, 58, 55, 62, 67, 64];

export const EMOJI_CLAIM_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "claimData",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  }
] as const;

export const EMOJI_TOKEN_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export const EMOJI_STAKING_ABI = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "stakedBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export const EMOJI_DUMP_VAULT_ABI = [
  {
    type: "function",
    name: "dump",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "depositTickets",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "rollover",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "currentEpochId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "epochs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "totalDumped", type: "uint256" },
      { name: "prizePaid", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "settled", type: "bool" },
      { name: "totalTickets", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "dumpedByEpoch",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export const EMOJI_CLAIM_TYPES = {
  Claim: [
    { name: "wallet", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
} as const;

export const EMOJI_CHAINS: Record<number, EmojiChainConfig> = {
  8453: {
    chainId: 8453,
    chainName: "Base",
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    }
  },
  84532: {
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18
    }
  }
};

export function getExplorerTxUrl(chainId: number, txHash: string | null | undefined) {
  if (!txHash) return null;
  const explorer = EMOJI_CHAINS[chainId]?.blockExplorerUrls[0];
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function displayAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function isWalletAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function calculateDipBoost(jeetPressure: number) {
  return clamp(1 + jeetPressure / 80, 1, 2.75);
}

export function calculatePoolTvlUsd(pool: Pool, reserveA: number, reserveB: number) {
  const [assetA, assetB] = pool.pair.split("/") as [AssetSymbol, AssetSymbol];
  return reserveA * FAKE_ASSET_PRICES_USD[assetA] + reserveB * FAKE_ASSET_PRICES_USD[assetB];
}

export function calculateVibeMove({
  hype,
  jeetPressure,
  vibePrice,
  chartPoints,
  hypeDelta,
  jeetDelta,
  activity = {
    wallets: 0,
    totalLp: 0,
    harvestClicks: 0,
    faucetClicks: 0,
    claimedEmoji: 0,
    dumpedEmoji: 0
  }
}: {
  hype: number;
  jeetPressure: number;
  vibePrice: number;
  chartPoints: number[];
  hypeDelta: number;
  jeetDelta: number;
  activity?: {
    wallets: number;
    totalLp: number;
    harvestClicks: number;
    faucetClicks: number;
    claimedEmoji: number;
    dumpedEmoji: number;
  };
}) {
  const nextHype = clamp(hype + hypeDelta, 0, 100);
  const nextJeet = clamp(jeetPressure + jeetDelta, 0, 100);
  const participation = Math.log10(1 + activity.wallets) * 0.12;
  const liquidity = Math.log10(1 + activity.totalLp) * 0.2;
  const farming = Math.log10(1 + activity.harvestClicks) * 0.08;
  const faucetNoise = Math.log10(1 + activity.faucetClicks) * 0.03;
  const claimPressure = Math.log10(1 + activity.claimedEmoji / 100) * 0.06;
  const dumpPressure = Math.log10(1 + activity.dumpedEmoji / 25) * 0.18;
  const hypeMultiplier = 1 + nextHype / 95 + participation + liquidity + farming + faucetNoise + claimPressure;
  const dumpMultiplier = clamp(1 - nextJeet / 145 - dumpPressure, 0.14, 1.12);
  const nextPrice = clamp(0.0024 * hypeMultiplier * dumpMultiplier, 0.0001, 0.069);
  const nextPoint = clamp(Math.round(nextPrice * 13000), 12, 92);

  return {
    hype: nextHype,
    jeetPressure: nextJeet,
    vibePrice: Number.isFinite(nextPrice) ? nextPrice : vibePrice,
    chartPoints: [...chartPoints.slice(-17), nextPoint]
  };
}

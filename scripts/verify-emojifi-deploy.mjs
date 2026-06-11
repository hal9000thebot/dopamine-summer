import nextEnv from "@next/env";
import { createPublicClient, formatEther, http, keccak256, parseEther, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { compileContracts, getCompiledContract } from "./contract-utils.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const rpcUrl = process.env.BASE_RPC_URL;
const tokenAddress = process.env.EMOJI_TOKEN_ADDRESS;
const claimAddress = process.env.NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS;
const stakingAddress = process.env.NEXT_PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS;
const dumpVaultAddress = process.env.NEXT_PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS;
const claimSignerAddress = process.env.EMOJI_CLAIM_SIGNER_ADDRESS;
const claimSignerPrivateKey = process.env.EMOJI_CLAIM_SIGNER_PRIVATE_KEY;
const ownerAddress = process.env.EMOJI_OWNER_ADDRESS;
const reserveAddress = process.env.EMOJI_RESERVE_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_EMOJI_CHAIN_ID ?? 84532);

if (!rpcUrl || !tokenAddress || !claimAddress || !claimSignerAddress || !claimSignerPrivateKey || !ownerAddress || !reserveAddress) {
  throw new Error(
    "Missing BASE_RPC_URL, EMOJI_TOKEN_ADDRESS, NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS, EMOJI_CLAIM_SIGNER_ADDRESS, EMOJI_CLAIM_SIGNER_PRIVATE_KEY, EMOJI_OWNER_ADDRESS, or EMOJI_RESERVE_ADDRESS."
  );
}

const claimSigner = privateKeyToAccount(claimSignerPrivateKey);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const contracts = compileContracts();
const token = getCompiledContract(contracts, "contracts/EmojiToken.sol", "EmojiToken");
const claim = getCompiledContract(contracts, "contracts/EmojiClaim.sol", "EmojiClaim");
const staking = getCompiledContract(contracts, "contracts/EmojiStakingVault.sol", "EmojiStakingVault");
const dump = getCompiledContract(contracts, "contracts/EmojiDumpVault.sol", "EmojiDumpVault");
const minterRole = keccak256(toBytes("MINTER_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}`;

function isConfiguredAddress(value) {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/i.test(value));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRpcRetry(label, fn) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await fn();
      await sleep(175);
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited = message.toLowerCase().includes("rate limit");
      if (!isRateLimited || attempt === 5) break;
      process.stdout.write(`${label} rate limited, retrying (${attempt}/5)...\n`);
      await sleep(750 * attempt);
    }
  }
  throw lastError;
}

const readContract = (label, args) => withRpcRetry(label, () => publicClient.readContract(args));
const getBalance = (label, args) => withRpcRetry(label, () => publicClient.getBalance(args));

const name = await readContract("Token name", { address: tokenAddress, abi: token.abi, functionName: "name" });
const symbol = await readContract("Token symbol", { address: tokenAddress, abi: token.abi, functionName: "symbol" });
const maxSupply = await readContract("Token max supply", { address: tokenAddress, abi: token.abi, functionName: "MAX_SUPPLY" });
const totalSupply = await readContract("Token total supply", { address: tokenAddress, abi: token.abi, functionName: "totalSupply" });
const hasMinterRole = await readContract("Claim minter role", {
  address: tokenAddress,
  abi: token.abi,
  functionName: "hasRole",
  args: [minterRole, claimAddress]
});
const contractClaimSigner = await readContract("Claim signer", { address: claimAddress, abi: claim.abi, functionName: "claimSigner" });
const claimCap = await readContract("Claim cap", { address: claimAddress, abi: claim.abi, functionName: "MAX_CLAIMABLE_SUPPLY" });
const totalClaimed = await readContract("Total claimed", { address: claimAddress, abi: claim.abi, functionName: "totalClaimed" });
const claimToken = await readContract("Claim token link", { address: claimAddress, abi: claim.abi, functionName: "emojiToken" });
const claimOwner = await readContract("Claim owner", { address: claimAddress, abi: claim.abi, functionName: "owner" });
const reserveBalance = await readContract("Reserve balance", {
  address: tokenAddress,
  abi: token.abi,
  functionName: "balanceOf",
  args: [reserveAddress]
});
const ownerHasAdminRole = await readContract("Owner admin role", {
  address: tokenAddress,
  abi: token.abi,
  functionName: "hasRole",
  args: [defaultAdminRole, ownerAddress]
});
const ownerHasMinterRole = await readContract("Owner minter role", {
  address: tokenAddress,
  abi: token.abi,
  functionName: "hasRole",
  args: [minterRole, ownerAddress]
});
const tokenBalance = await getBalance("Token ETH balance", { address: tokenAddress });
const claimBalance = await getBalance("Claim ETH balance", { address: claimAddress });

const signerMatchesEnv =
  claimSigner.address.toLowerCase() === claimSignerAddress.toLowerCase() &&
  contractClaimSigner.toLowerCase() === claimSignerAddress.toLowerCase();
const tokenLinked = claimToken.toLowerCase() === tokenAddress.toLowerCase();
const capMatches = maxSupply === parseEther("10000000000");
const metadataMatches = name === "DOPAMINE" && symbol === "DOPAMINE";
const claimCapMatches = claimCap === parseEther("9900000000");
const reserveMatches = reserveBalance === parseEther("100000000");
const adminRenounced = ownerHasAdminRole === false;
const ownerCannotMint = ownerHasMinterRole === false;

process.stdout.write("DOPAMINE deployment verification\n");
process.stdout.write(`Chain ID: ${chainId}\n`);
process.stdout.write(`Token: ${tokenAddress}\n`);
process.stdout.write(`Claim: ${claimAddress}\n`);
if (isConfiguredAddress(stakingAddress)) process.stdout.write(`Staking: ${stakingAddress}\n`);
if (isConfiguredAddress(dumpVaultAddress)) process.stdout.write(`Dump vault: ${dumpVaultAddress}\n`);
process.stdout.write(`Token metadata: ${name} / ${symbol}\n`);
process.stdout.write(`Token metadata OK: ${metadataMatches}\n`);
process.stdout.write(`Max supply OK: ${capMatches}\n`);
process.stdout.write(`Total supply: ${formatEther(totalSupply)} ${symbol}\n`);
process.stdout.write(`Reserve balance OK: ${reserveMatches} (${formatEther(reserveBalance)} ${symbol})\n`);
process.stdout.write(`Claim has MINTER_ROLE: ${hasMinterRole}\n`);
process.stdout.write(`Claim cap OK: ${claimCapMatches} (${formatEther(claimCap)} ${symbol})\n`);
process.stdout.write(`Total claimed: ${formatEther(totalClaimed)} ${symbol}\n`);
process.stdout.write(`Claim token link OK: ${tokenLinked}\n`);
process.stdout.write(`Claim signer OK: ${signerMatchesEnv}\n`);
process.stdout.write(`Claim owner: ${claimOwner}\n`);
process.stdout.write(`Owner admin renounced: ${adminRenounced}\n`);
process.stdout.write(`Owner cannot mint directly: ${ownerCannotMint}\n`);
process.stdout.write(`Token contract ETH balance: ${formatEther(tokenBalance)} ETH\n`);
process.stdout.write(`Claim contract ETH balance: ${formatEther(claimBalance)} ETH\n`);

let stakingOk = true;
let dumpOk = true;

if (isConfiguredAddress(stakingAddress)) {
  const stakingToken = await readContract("Staking token link", { address: stakingAddress, abi: staking.abi, functionName: "emojiToken" });
  const stakingOwner = await readContract("Staking owner", { address: stakingAddress, abi: staking.abi, functionName: "owner" });
  const stakingTotal = await readContract("Staking total", { address: stakingAddress, abi: staking.abi, functionName: "totalStaked" });
  const stakingBalance = await getBalance("Staking ETH balance", { address: stakingAddress });
  stakingOk = stakingToken.toLowerCase() === tokenAddress.toLowerCase();
  process.stdout.write(`Staking token link OK: ${stakingOk}\n`);
  process.stdout.write(`Staking owner: ${stakingOwner}\n`);
  process.stdout.write(`Total staked: ${formatEther(stakingTotal)} ${symbol}\n`);
  process.stdout.write(`Staking contract ETH balance: ${formatEther(stakingBalance)} ETH\n`);
}

if (isConfiguredAddress(dumpVaultAddress)) {
  const dumpToken = await readContract("Dump token link", { address: dumpVaultAddress, abi: dump.abi, functionName: "emojiToken" });
  const dumpStaking = await readContract("Dump staking link", { address: dumpVaultAddress, abi: dump.abi, functionName: "stakingVault" });
  const currentEpochId = await readContract("Dump current epoch", { address: dumpVaultAddress, abi: dump.abi, functionName: "currentEpochId" });
  const epochDuration = await readContract("Dump epoch duration", { address: dumpVaultAddress, abi: dump.abi, functionName: "EPOCH_DURATION" });
  const dumpBalance = await getBalance("Dump ETH balance", { address: dumpVaultAddress });
  dumpOk =
    dumpToken.toLowerCase() === tokenAddress.toLowerCase() &&
    (!isConfiguredAddress(stakingAddress) || dumpStaking.toLowerCase() === stakingAddress.toLowerCase());
  process.stdout.write(`Dump token/staking link OK: ${dumpOk}\n`);
  process.stdout.write(`Current lottery epoch: ${currentEpochId}\n`);
  process.stdout.write(`Lottery epoch duration: ${epochDuration} seconds\n`);
  process.stdout.write(`Dump vault ETH balance: ${formatEther(dumpBalance)} ETH\n`);
}

if (
  !metadataMatches ||
  !capMatches ||
  !reserveMatches ||
  !claimCapMatches ||
  !hasMinterRole ||
  !tokenLinked ||
  !signerMatchesEnv ||
  !adminRenounced ||
  !ownerCannotMint ||
  !stakingOk ||
  !dumpOk
) {
  throw new Error("Deployment verification failed.");
}

process.stdout.write("Verification OK\n");

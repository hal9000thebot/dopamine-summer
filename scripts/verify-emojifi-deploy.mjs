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

const [
  name,
  symbol,
  maxSupply,
  totalSupply,
  hasMinterRole,
  contractClaimSigner,
  claimCap,
  totalClaimed,
  claimToken,
  claimOwner,
  reserveBalance,
  ownerHasAdminRole,
  ownerHasMinterRole,
  tokenBalance,
  claimBalance
] = await Promise.all([
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "name" }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "symbol" }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "MAX_SUPPLY" }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "totalSupply" }),
  publicClient.readContract({
    address: tokenAddress,
    abi: token.abi,
    functionName: "hasRole",
    args: [minterRole, claimAddress]
  }),
  publicClient.readContract({ address: claimAddress, abi: claim.abi, functionName: "claimSigner" }),
  publicClient.readContract({ address: claimAddress, abi: claim.abi, functionName: "MAX_CLAIMABLE_SUPPLY" }),
  publicClient.readContract({ address: claimAddress, abi: claim.abi, functionName: "totalClaimed" }),
  publicClient.readContract({ address: claimAddress, abi: claim.abi, functionName: "emojiToken" }),
  publicClient.readContract({ address: claimAddress, abi: claim.abi, functionName: "owner" }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "balanceOf", args: [reserveAddress] }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "hasRole", args: [defaultAdminRole, ownerAddress] }),
  publicClient.readContract({ address: tokenAddress, abi: token.abi, functionName: "hasRole", args: [minterRole, ownerAddress] }),
  publicClient.getBalance({ address: tokenAddress }),
  publicClient.getBalance({ address: claimAddress })
]);

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
  const [stakingToken, stakingOwner, stakingTotal, stakingBalance] = await Promise.all([
    publicClient.readContract({ address: stakingAddress, abi: staking.abi, functionName: "emojiToken" }),
    publicClient.readContract({ address: stakingAddress, abi: staking.abi, functionName: "owner" }),
    publicClient.readContract({ address: stakingAddress, abi: staking.abi, functionName: "totalStaked" }),
    publicClient.getBalance({ address: stakingAddress })
  ]);
  stakingOk = stakingToken.toLowerCase() === tokenAddress.toLowerCase();
  process.stdout.write(`Staking token link OK: ${stakingOk}\n`);
  process.stdout.write(`Staking owner: ${stakingOwner}\n`);
  process.stdout.write(`Total staked: ${formatEther(stakingTotal)} ${symbol}\n`);
  process.stdout.write(`Staking contract ETH balance: ${formatEther(stakingBalance)} ETH\n`);
}

if (isConfiguredAddress(dumpVaultAddress)) {
  const [dumpToken, dumpStaking, currentEpochId, epochDuration, dumpBalance] = await Promise.all([
    publicClient.readContract({ address: dumpVaultAddress, abi: dump.abi, functionName: "emojiToken" }),
    publicClient.readContract({ address: dumpVaultAddress, abi: dump.abi, functionName: "stakingVault" }),
    publicClient.readContract({ address: dumpVaultAddress, abi: dump.abi, functionName: "currentEpochId" }),
    publicClient.readContract({ address: dumpVaultAddress, abi: dump.abi, functionName: "EPOCH_DURATION" }),
    publicClient.getBalance({ address: dumpVaultAddress })
  ]);
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

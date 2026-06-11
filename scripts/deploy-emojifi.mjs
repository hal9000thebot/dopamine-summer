import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  keccak256,
  toBytes
} from "viem";
import nextEnv from "@next/env";
import { privateKeyToAccount } from "viem/accounts";
import { compileContracts, getCompiledContract } from "./contract-utils.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const rpcUrl = process.env.BASE_RPC_URL;
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const claimSignerAddress = process.env.EMOJI_CLAIM_SIGNER_ADDRESS;
const ownerAddress = process.env.EMOJI_OWNER_ADDRESS;
const ownerPrivateKey = process.env.EMOJI_OWNER_PRIVATE_KEY;
const reserveAddress = process.env.EMOJI_RESERVE_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_EMOJI_CHAIN_ID ?? 84532);

if (!rpcUrl || !deployerPrivateKey || !claimSignerAddress || !ownerAddress || !reserveAddress) {
  throw new Error(
    "Missing BASE_RPC_URL, DEPLOYER_PRIVATE_KEY, EMOJI_CLAIM_SIGNER_ADDRESS, EMOJI_OWNER_ADDRESS, or EMOJI_RESERVE_ADDRESS."
  );
}

const deployer = privateKeyToAccount(deployerPrivateKey);
const ownerAccount = ownerPrivateKey ? privateKeyToAccount(ownerPrivateKey) : deployer;
if (ownerAddress.toLowerCase() !== ownerAccount.address.toLowerCase()) {
  throw new Error(
    "EMOJI_OWNER_ADDRESS must match DEPLOYER_PRIVATE_KEY or EMOJI_OWNER_PRIVATE_KEY so the script can grant MINTER_ROLE."
  );
}

const transport = http(rpcUrl);
const publicClient = createPublicClient({ transport });
const walletClient = createWalletClient({ account: deployer, transport });
const ownerClient = createWalletClient({ account: ownerAccount, transport });
const contracts = compileContracts();
const token = getCompiledContract(contracts, "contracts/EmojiToken.sol", "EmojiToken");
const claim = getCompiledContract(contracts, "contracts/EmojiClaim.sol", "EmojiClaim");
const staking = getCompiledContract(contracts, "contracts/EmojiStakingVault.sol", "EmojiStakingVault");
const dump = getCompiledContract(contracts, "contracts/EmojiDumpVault.sol", "EmojiDumpVault");
const minterRole = keccak256(toBytes("MINTER_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}`;

async function waitFor(hash, label) {
  process.stdout.write(`${label}: ${hash}\n`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} failed`);
  }
  return receipt;
}

const tokenHash = await walletClient.deployContract({
  abi: token.abi,
  bytecode: token.bytecode,
  args: [ownerAddress, reserveAddress]
});
const tokenReceipt = await waitFor(tokenHash, "EmojiToken deploy");
const tokenAddress = tokenReceipt.contractAddress;

const claimHash = await walletClient.deployContract({
  abi: claim.abi,
  bytecode: claim.bytecode,
  args: [tokenAddress, claimSignerAddress, ownerAddress]
});
const claimReceipt = await waitFor(claimHash, "EmojiClaim deploy");
const claimAddress = claimReceipt.contractAddress;

const stakingHash = await walletClient.deployContract({
  abi: staking.abi,
  bytecode: staking.bytecode,
  args: [tokenAddress, ownerAddress]
});
const stakingReceipt = await waitFor(stakingHash, "EmojiStakingVault deploy");
const stakingAddress = stakingReceipt.contractAddress;

const dumpHash = await walletClient.deployContract({
  abi: dump.abi,
  bytecode: dump.bytecode,
  args: [tokenAddress, stakingAddress]
});
const dumpReceipt = await waitFor(dumpHash, "EmojiDumpVault deploy");
const dumpAddress = dumpReceipt.contractAddress;

const ownerBalance = await publicClient.getBalance({ address: ownerAccount.address });

if (ownerBalance === 0n) {
  throw new Error(
    `Owner wallet ${ownerAccount.address} has 0 ETH on Base Sepolia. Fund it with Base Sepolia ETH, then grant MINTER_ROLE with npm run contracts:grant-minter.`
  );
}

process.stdout.write(`Owner ${ownerAccount.address} balance: ${formatEther(ownerBalance)} ETH\n`);

await waitFor(
  await ownerClient.writeContract({
    address: tokenAddress,
    abi: token.abi,
    functionName: "grantRole",
    args: [minterRole, claimAddress]
  }),
  "Grant MINTER_ROLE"
);

await waitFor(
  await ownerClient.writeContract({
    address: tokenAddress,
    abi: token.abi,
    functionName: "renounceRole",
    args: [defaultAdminRole, ownerAddress]
  }),
  "Renounce token DEFAULT_ADMIN_ROLE"
);

process.stdout.write("\nDeployment complete\n");
process.stdout.write(`NEXT_PUBLIC_EMOJI_CHAIN_ID=${chainId}\n`);
process.stdout.write(`NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS=${claimAddress}\n`);
process.stdout.write(`NEXT_PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS=${stakingAddress}\n`);
process.stdout.write(`NEXT_PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS=${dumpAddress}\n`);
process.stdout.write(`EMOJI_TOKEN_ADDRESS=${tokenAddress}\n`);
process.stdout.write(`NEXT_PUBLIC_EMOJI_TOKEN_ADDRESS=${tokenAddress}\n`);
process.stdout.write(`EMOJI_CLAIM_SIGNER_ADDRESS=${claimSignerAddress}\n`);
process.stdout.write(`EMOJI_RESERVE_ADDRESS=${reserveAddress}\n`);

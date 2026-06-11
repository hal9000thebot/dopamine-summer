import nextEnv from "@next/env";
import { createPublicClient, createWalletClient, formatEther, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { compileContracts, getCompiledContract } from "./contract-utils.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const rpcUrl = process.env.BASE_RPC_URL;
const ownerPrivateKey = process.env.EMOJI_OWNER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
const tokenAddress = process.env.EMOJI_TOKEN_ADDRESS;
const claimAddress = process.env.NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS;

if (!rpcUrl || !ownerPrivateKey || !tokenAddress || !claimAddress) {
  throw new Error(
    "Missing BASE_RPC_URL, EMOJI_OWNER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, EMOJI_TOKEN_ADDRESS, or NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS."
  );
}

const owner = privateKeyToAccount(ownerPrivateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ transport });
const ownerClient = createWalletClient({ account: owner, transport });
const contracts = compileContracts();
const token = getCompiledContract(contracts, "contracts/EmojiToken.sol", "EmojiToken");
const minterRole = keccak256(toBytes("MINTER_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}`;

const [balance, hasAdminRole] = await Promise.all([
  publicClient.getBalance({ address: owner.address }),
  publicClient.readContract({
    address: tokenAddress,
    abi: token.abi,
    functionName: "hasRole",
    args: [defaultAdminRole, owner.address]
  })
]);

if (balance === 0n) {
  throw new Error(
    `Owner wallet ${owner.address} has 0 ETH on Base Sepolia. Fund it with Base Sepolia ETH, then rerun npm run contracts:grant-minter.`
  );
}

if (!hasAdminRole) {
  throw new Error(
    `Owner wallet ${owner.address} does not have DEFAULT_ADMIN_ROLE on ${tokenAddress}. Check EMOJI_OWNER_PRIVATE_KEY and EMOJI_TOKEN_ADDRESS.`
  );
}

process.stdout.write(`Owner ${owner.address} balance: ${formatEther(balance)} ETH\n`);

const hash = await ownerClient.writeContract({
  address: tokenAddress,
  abi: token.abi,
  functionName: "grantRole",
  args: [minterRole, claimAddress]
});

process.stdout.write(`Grant MINTER_ROLE: ${hash}\n`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error("Grant MINTER_ROLE failed");
}

process.stdout.write("\nGrant complete\n");
process.stdout.write(`EMOJI_TOKEN_ADDRESS=${tokenAddress}\n`);
process.stdout.write(`NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS=${claimAddress}\n`);

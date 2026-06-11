import nextEnv from "@next/env";
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const rpcUrl = process.env.BASE_RPC_URL;
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const ownerPrivateKey = process.env.EMOJI_OWNER_PRIVATE_KEY;
const ownerAddress = process.env.EMOJI_OWNER_ADDRESS;
const reserveAddress = process.env.EMOJI_RESERVE_ADDRESS;
const claimSignerAddress = process.env.EMOJI_CLAIM_SIGNER_ADDRESS;

if (!rpcUrl || !deployerPrivateKey || !ownerAddress || !reserveAddress || !claimSignerAddress) {
  throw new Error(
    "Missing BASE_RPC_URL, DEPLOYER_PRIVATE_KEY, EMOJI_OWNER_ADDRESS, EMOJI_RESERVE_ADDRESS, or EMOJI_CLAIM_SIGNER_ADDRESS."
  );
}

const deployer = privateKeyToAccount(deployerPrivateKey);
const owner = ownerPrivateKey ? privateKeyToAccount(ownerPrivateKey) : deployer;
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const [deployerBalance, ownerBalance] = await Promise.all([
  publicClient.getBalance({ address: deployer.address }),
  publicClient.getBalance({ address: owner.address })
]);

process.stdout.write("EmojiFi deployment preflight\n");
process.stdout.write(`Deployer: ${deployer.address} (${formatEther(deployerBalance)} ETH)\n`);
process.stdout.write(`Owner env: ${ownerAddress}\n`);
process.stdout.write(`Owner signer: ${owner.address} (${formatEther(ownerBalance)} ETH)\n`);
process.stdout.write(`Reserve: ${reserveAddress}\n`);
process.stdout.write(`Claim signer: ${claimSignerAddress}\n`);

if (ownerAddress.toLowerCase() !== owner.address.toLowerCase()) {
  throw new Error("EMOJI_OWNER_ADDRESS does not match DEPLOYER_PRIVATE_KEY or EMOJI_OWNER_PRIVATE_KEY.");
}

if (deployerBalance === 0n) {
  throw new Error("Deployer has 0 ETH on the target chain.");
}

if (ownerBalance === 0n) {
  throw new Error("Owner signer has 0 ETH on the target chain.");
}

process.stdout.write("Preflight OK\n");

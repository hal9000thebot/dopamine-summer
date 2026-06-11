import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, keccak256, parseEther, toBytes } from "viem";

const minterRole = keccak256(toBytes("MINTER_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}`;
const claimTypes = {
  Claim: [
    { name: "wallet", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
} as const;

describe("EmojiFi contracts", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [adminClient, signerClient, farmerClient, attackerClient, reserveClient] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  async function deployFixture() {
    const token = await viem.deployContract("EmojiToken", [adminClient.account.address, reserveClient.account.address], {
      client: { public: publicClient, wallet: adminClient },
      gas: 5_000_000n
    });
    const claim = await viem.deployContract(
      "EmojiClaim",
      [token.address, signerClient.account.address, adminClient.account.address],
      {
        client: { public: publicClient, wallet: adminClient },
        gas: 3_500_000n
      }
    );
    const staking = await viem.deployContract("EmojiStakingVault", [token.address, adminClient.account.address], {
      client: { public: publicClient, wallet: adminClient },
      gas: 2_500_000n
    });
    const dump = await viem.deployContract(
      "EmojiDumpVault",
      [token.address, staking.address],
      {
        client: { public: publicClient, wallet: adminClient },
        gas: 3_500_000n
      }
    );

    await token.write.grantRole([minterRole, claim.address], { gas: 200_000n });
    await token.write.renounceRole([defaultAdminRole, adminClient.account.address], { gas: 200_000n });

    const tokenAsFarmer = await viem.getContractAt("EmojiToken", token.address, {
      client: { public: publicClient, wallet: farmerClient }
    });
    const claimAsFarmer = await viem.getContractAt("EmojiClaim", claim.address, {
      client: { public: publicClient, wallet: farmerClient }
    });
    const claimAsAttacker = await viem.getContractAt("EmojiClaim", claim.address, {
      client: { public: publicClient, wallet: attackerClient }
    });
    const stakingAsFarmer = await viem.getContractAt("EmojiStakingVault", staking.address, {
      client: { public: publicClient, wallet: farmerClient }
    });
    const dumpAsFarmer = await viem.getContractAt("EmojiDumpVault", dump.address, {
      client: { public: publicClient, wallet: farmerClient }
    });

    return { token, tokenAsFarmer, claim, claimAsFarmer, claimAsAttacker, staking, stakingAsFarmer, dump, dumpAsFarmer };
  }

  async function futureDeadline() {
    const block = await publicClient.getBlock();
    return block.timestamp + 3_600n;
  }

  async function signClaim({
    claimAddress,
    wallet = farmerClient.account.address,
    amount = parseEther("18"),
    nonce = 1n,
    deadline
  }: {
    claimAddress: `0x${string}`;
    wallet?: `0x${string}`;
    amount?: bigint;
    nonce?: bigint;
    deadline: bigint;
  }) {
    return signerClient.signTypedData({
      account: signerClient.account,
      domain: {
        name: "DOPAMINE Claim",
        version: "1",
        chainId,
        verifyingContract: claimAddress
      },
      types: claimTypes,
      primaryType: "Claim",
      message: { wallet, amount, nonce, deadline }
    });
  }

  async function claimToFarmer({
    claim,
    claimAsFarmer,
    amount,
    nonce
  }: {
    claim: { address: `0x${string}` };
    claimAsFarmer: { write: { claim: (args: readonly [unknown, `0x${string}`], options: { gas: bigint }) => Promise<`0x${string}`> } };
    amount: bigint;
    nonce: bigint;
  }) {
    const claimData = {
      wallet: farmerClient.account.address,
      amount,
      nonce,
      deadline: await futureDeadline()
    };
    await claimAsFarmer.write.claim([claimData, await signClaim({ ...claimData, claimAddress: claim.address })], {
      gas: 350_000n
    });
  }

  it("deploys production tokenomics and leaves no token admin", async () => {
    const { token, claim } = await deployFixture();

    assert.equal(await token.read.name(), "DOPAMINE");
    assert.equal(await token.read.symbol(), "DOPAMINE");
    assert.equal(await token.read.MAX_SUPPLY(), parseEther("10000000000"));
    assert.equal(await token.read.DEV_RESERVE_SUPPLY(), parseEther("100000000"));
    assert.equal(await token.read.totalSupply(), parseEther("100000000"));
    assert.equal(await token.read.balanceOf([reserveClient.account.address]), parseEther("100000000"));
    assert.equal(await claim.read.MAX_CLAIMABLE_SUPPLY(), parseEther("9900000000"));
    assert.equal(await token.read.hasRole([minterRole, claim.address]), true);
    assert.equal(await token.read.hasRole([minterRole, adminClient.account.address]), false);
    assert.equal(await token.read.hasRole([defaultAdminRole, adminClient.account.address]), false);
  });

  it("rejects direct minting from owner and non-minters", async () => {
    const { token, tokenAsFarmer } = await deployFixture();

    await assert.rejects(
      token.write.mint([adminClient.account.address, parseEther("1")], { gas: 150_000n }),
      /AccessControlUnauthorizedAccount|revert/
    );

    await assert.rejects(
      tokenAsFarmer.write.mint([farmerClient.account.address, parseEther("1")], { gas: 150_000n }),
      /AccessControlUnauthorizedAccount|revert/
    );
  });

  it("mints a valid signed claim", async () => {
    const { token, claim, claimAsFarmer } = await deployFixture();
    const claimData = {
      wallet: farmerClient.account.address,
      amount: parseEther("18"),
      nonce: 1n,
      deadline: await futureDeadline()
    };

    await claimAsFarmer.write.claim([claimData, await signClaim({ ...claimData, claimAddress: claim.address })], {
      gas: 250_000n
    });

    assert.equal(await token.read.balanceOf([farmerClient.account.address]), parseEther("18"));
    assert.equal(await claim.read.totalClaimed(), parseEther("18"));
  });

  it("rejects claims above the 9.9B public cap", async () => {
    const { token, claim, claimAsFarmer } = await deployFixture();

    await claimToFarmer({ claim, claimAsFarmer, amount: parseEther("9900000000"), nonce: 20n });

    assert.equal(await claim.read.totalClaimed(), parseEther("9900000000"));
    assert.equal(await token.read.totalSupply(), parseEther("10000000000"));

    const claimData = {
      wallet: farmerClient.account.address,
      amount: parseEther("1"),
      nonce: 21n,
      deadline: await futureDeadline()
    };
    await assert.rejects(
      claimAsFarmer.write.claim([claimData, await signClaim({ ...claimData, claimAddress: claim.address })], {
        gas: 350_000n
      }),
      /claim cap exceeded|revert/
    );
  });

  it("rejects replayed, wrong-wallet, bad-signer, and expired claims", async () => {
    const { claim, claimAsFarmer, claimAsAttacker } = await deployFixture();
    const replayClaim = {
      wallet: farmerClient.account.address,
      amount: parseEther("5"),
      nonce: 2n,
      deadline: await futureDeadline()
    };
    const replaySignature = await signClaim({ ...replayClaim, claimAddress: claim.address });

    await claimAsFarmer.write.claim([replayClaim, replaySignature], { gas: 250_000n });
    await assert.rejects(
      claimAsFarmer.write.claim([replayClaim, replaySignature], { gas: 250_000n }),
      /claim already used|revert/
    );

    const wrongWalletClaim = {
      wallet: farmerClient.account.address,
      amount: parseEther("7"),
      nonce: 3n,
      deadline: await futureDeadline()
    };
    await assert.rejects(
      claimAsAttacker.write.claim(
        [wrongWalletClaim, await signClaim({ ...wrongWalletClaim, claimAddress: claim.address })],
        { gas: 250_000n }
      ),
      /wrong wallet|revert/
    );

    const badSignerClaim = {
      wallet: farmerClient.account.address,
      amount: parseEther("7"),
      nonce: 4n,
      deadline: await futureDeadline()
    };
    const badSignature = await attackerClient.signTypedData({
      account: attackerClient.account,
      domain: {
        name: "DOPAMINE Claim",
        version: "1",
        chainId,
        verifyingContract: claim.address
      },
      types: claimTypes,
      primaryType: "Claim",
      message: badSignerClaim
    });
    await assert.rejects(
      claimAsFarmer.write.claim([badSignerClaim, badSignature], { gas: 250_000n }),
      /bad signature|revert/
    );

    const expiredClaim = {
      wallet: farmerClient.account.address,
      amount: parseEther("7"),
      nonce: 5n,
      deadline: 1n
    };
    await assert.rejects(
      claimAsFarmer.write.claim(
        [expiredClaim, await signClaim({ ...expiredClaim, claimAddress: claim.address })],
        { gas: 250_000n }
      ),
      /claim expired|revert/
    );
  });

  it("encodes claim calldata for the frontend wallet transaction path", async () => {
    const { claim } = await deployFixture();
    const claimData = {
      wallet: farmerClient.account.address,
      amount: parseEther("1"),
      nonce: 6n,
      deadline: await futureDeadline()
    };
    const calldata = encodeFunctionData({
      abi: claim.abi,
      functionName: "claim",
      args: [claimData, await signClaim({ ...claimData, claimAddress: claim.address })]
    });

    assert.match(calldata, /^0x[0-9a-f]+$/i);
    assert.ok(calldata.length > 200);
  });

  it("stakes and withdraws real DOPAMINE", async () => {
    const { token, tokenAsFarmer, claim, claimAsFarmer, staking, stakingAsFarmer } = await deployFixture();

    await claimToFarmer({ claim, claimAsFarmer, amount: parseEther("25"), nonce: 30n });
    await tokenAsFarmer.write.approve([staking.address, parseEther("20")], { gas: 150_000n });
    await stakingAsFarmer.write.stake([parseEther("20")], { gas: 180_000n });

    assert.equal(await staking.read.totalStaked(), parseEther("20"));
    assert.equal(await staking.read.stakedBalanceOf([farmerClient.account.address]), parseEther("20"));

    await stakingAsFarmer.write.withdraw([parseEther("7")], { gas: 180_000n });

    assert.equal(await staking.read.totalStaked(), parseEther("13"));
    assert.equal(await staking.read.stakedBalanceOf([farmerClient.account.address]), parseEther("13"));
  });

  it("runs dump vault lottery epochs for staked wallets", async () => {
    const { token, tokenAsFarmer, claim, claimAsFarmer, staking, stakingAsFarmer, dump, dumpAsFarmer } =
      await deployFixture();

    await claimToFarmer({ claim, claimAsFarmer, amount: parseEther("100"), nonce: 40n });
    await tokenAsFarmer.write.approve([staking.address, parseEther("10")], { gas: 150_000n });
    await stakingAsFarmer.write.stake([parseEther("10")], { gas: 180_000n });

    await assert.rejects(
      dumpAsFarmer.write.depositTickets([parseEther("11")], { gas: 220_000n }),
      /tickets exceed stake|revert/
    );
    await dumpAsFarmer.write.depositTickets([parseEther("10")], { gas: 220_000n });
    await tokenAsFarmer.write.approve([dump.address, parseEther("40")], { gas: 150_000n });
    await dumpAsFarmer.write.dump([parseEther("40")], { gas: 200_000n });

    assert.equal(await dump.read.currentEpochId(), 1n);
    const activeEpoch = await dump.read.epochs([1n]);
    assert.equal(activeEpoch[2], parseEther("40"));
    assert.equal(activeEpoch[6], parseEther("10"));

    await testClient.increaseTime({ seconds: 10_801 });
    await testClient.mine({ blocks: 1 });

    const balanceBefore = await token.read.balanceOf([farmerClient.account.address]);
    await dumpAsFarmer.write.rollover({ gas: 350_000n });
    const settledEpoch = await dump.read.epochs([1n]);

    assert.equal(settledEpoch[4].toLowerCase(), farmerClient.account.address.toLowerCase());
    assert.equal(settledEpoch[3], parseEther("40"));
    assert.equal(settledEpoch[5], true);
    assert.equal(await dump.read.currentEpochId(), 2n);
    assert.equal(await token.read.balanceOf([farmerClient.account.address]), balanceBefore + parseEther("40"));
  });
});

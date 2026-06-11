# DOPAMINE Contracts

Production contract boundary for Dopamine Summer:

- `EmojiToken.sol`: OpenZeppelin ERC-20 named `DOPAMINE` with a hard `10,000,000,000 DOPAMINE` cap.
- `EmojiToken.sol` mints exactly `100,000,000 DOPAMINE` to `EMOJI_RESERVE_ADDRESS` at deploy time. That is the 1% dev reserve.
- `EmojiClaim.sol`: EIP-712 signed claim verifier with a hard `9,900,000,000 DOPAMINE` public claim cap.
- `EmojiStakingVault.sol`: Simple onchain DOPAMINE staking.
- `EmojiDumpVault.sol`: Permissionless fixed 3-hour lottery epochs. Users deposit tickets up to their staked DOPAMINE amount, dump DOPAMINE through the vault, and anyone can call `rollover()` after an epoch ends. The contract picks the winner and emits `EpochSettled`.

The fake faucet assets and fake LP balances are intentionally offchain game state. They belong in the app database, not in these contracts, so users do not pay gas to mint fake prerequisites.

## Local Test

```bash
npm run contracts:test
```

This compiles with the local `solc` package and tests:

- token metadata is `DOPAMINE / DOPAMINE`
- max supply cannot exceed `10B`
- reserve mints exactly `1%`
- claim contract cannot mint above `9.9B`
- owner cannot mint directly
- token admin role is renounced after setup
- signed claims, replay protection, bad signatures, expired claims
- staking and withdrawals
- permissionless lottery ticket deposits, dumping, rollover, and winner settlement

## Deploy

Set deployment variables from `.env.example`, then run:

```bash
npm run contracts:preflight
npm run contracts:deploy
```

Important production addresses:

- `DEPLOYER_PRIVATE_KEY`: fresh burner with Base ETH for deployment gas.
- `EMOJI_OWNER_ADDRESS` / `EMOJI_OWNER_PRIVATE_KEY`: setup wallet. It grants the claim contract minter role and then renounces token admin.
- `EMOJI_CLAIM_SIGNER_ADDRESS`: backend signer address used by `EmojiClaim`.
- `EMOJI_CLAIM_SIGNER_PRIVATE_KEY`: backend-only private key used by the app to sign claim vouchers.
- `EMOJI_RESERVE_ADDRESS`: receives the one-time 1% reserve.

After deployment, copy the printed addresses into runtime env:

- `EMOJI_TOKEN_ADDRESS`
- `NEXT_PUBLIC_EMOJI_TOKEN_ADDRESS`
- `NEXT_PUBLIC_EMOJI_CLAIM_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_EMOJI_STAKING_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_EMOJI_DUMP_VAULT_CONTRACT_ADDRESS`

Then verify:

```bash
npm run contracts:verify
```

Verification checks metadata, cap, reserve balance, claim cap, claim signer, claim minter role, token links, and that the owner no longer has token admin or minter rights.

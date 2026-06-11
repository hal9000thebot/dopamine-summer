# Dopamine Summer

A joke DeFi Summer simulator for people who remember when fake APYs felt like real dopamine.

The app lets users connect a real wallet, mint fake offchain faucet assets, supply fake LP pools, click-harvest real DOPAMINE claims, stake, dump into a permissionless lottery vault, and discover a very ill-advised forbidden Uniswap pool door.

## Stack

- Next.js App Router
- React
- Prisma
- Postgres
- viem
- OpenZeppelin contracts
- Hardhat contract tests

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run dev -- -p 3000
```

Open `http://localhost:3000`.

## Contracts

```bash
npm run contracts:test
npm run contracts:preflight
npm run contracts:deploy
npm run contracts:verify
```

Production contract posture:

- token name/symbol: `DOPAMINE`
- max supply: `10,000,000,000`
- dev reserve: `1%`, minted once
- public claim cap: `9.9B`
- owner cannot mint directly
- token admin role is renounced after setup
- lottery epochs are fixed at 3 hours
- lottery rollover and winner settlement are permissionless

See [contracts/README.md](contracts/README.md) for deployment details.

## Production Notes

Use hosted Postgres, such as Neon, and run:

```bash
npm run db:deploy
npm run build
```

Keep real private keys out of git. Runtime secrets belong in your hosting provider environment variables.

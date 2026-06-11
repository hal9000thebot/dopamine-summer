import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solcPath = require.resolve("solc/soljson.js");

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.35",
        path: solcPath,
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    }
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1"
    }
  }
});

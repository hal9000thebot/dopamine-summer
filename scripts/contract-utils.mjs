import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const projectRoot = process.cwd();

function findImport(importPath) {
  const candidates = [
    path.join(projectRoot, importPath),
    path.join(projectRoot, "node_modules", importPath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `Unable to resolve ${importPath}` };
}

export function compileContracts(
  contractFiles = [
    "contracts/EmojiToken.sol",
    "contracts/EmojiClaim.sol",
    "contracts/EmojiStakingVault.sol",
    "contracts/EmojiDumpVault.sol"
  ]
) {
  const sources = Object.fromEntries(
    contractFiles.map((file) => [
      file,
      {
        content: fs.readFileSync(path.join(projectRoot, file), "utf8")
      }
    ])
  );

  const input = {
    language: "Solidity",
    sources,
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }

  return output.contracts;
}

export function getCompiledContract(contracts, file, name) {
  const contract = contracts[file]?.[name];
  if (!contract) {
    throw new Error(`Missing compiled contract ${file}:${name}`);
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`
  };
}

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Starting contract deployment using standard ethers...");

  // 1. Load env variables
  let zgPrivateKey = "";
  let zgEvmRpc = "https://evmrpc-testnet.0g.ai";

  const envPath = path.join(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const fileContent = fs.readFileSync(envPath, 'utf8');
    const lines = fileContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const parts = trimmed.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key === 'ZG_PRIVATE_KEY') {
          zgPrivateKey = val;
        } else if (key === 'ZG_EVM_RPC') {
          zgEvmRpc = val;
        }
      }
    }
  }

  if (!zgPrivateKey) {
    throw new Error("ZG_PRIVATE_KEY is missing from .env.local");
  }

  // 2. Read artifacts compiled by Hardhat
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/MemoryRegistry.sol/MemoryRegistry.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Compiled contract artifact not found. Please run 'npx hardhat compile' first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi, bytecode } = artifact;

  // 3. Connect to EVM provider and signer
  const provider = new ethers.JsonRpcProvider(zgEvmRpc);
  const signer = new ethers.Wallet(zgPrivateKey, provider);

  console.log("Deployer address:", signer.address);

  // 4. Deploy
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log("Submitting deployment transaction to 0G Testnet EVM...");
  const contract = await factory.deploy();
  
  console.log("Waiting for block confirmations...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("------------------------------------------------");
  console.log("MemoryRegistry deployed successfully!");
  console.log("Contract Address:", contractAddress);
  console.log("------------------------------------------------");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

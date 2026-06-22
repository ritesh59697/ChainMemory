import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load variables from .env.local to prevent extra package dependencies
let zgPrivateKey = "";
let zgEvmRpc = "https://evmrpc-testnet.0g.ai";

const envPath = path.join(__dirname, '.env.local');
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

const accounts = [];
if (zgPrivateKey && zgPrivateKey.match(/^[0-9a-fA-F]{64}$/)) {
  accounts.push(`0x${zgPrivateKey}`);
} else if (zgPrivateKey && zgPrivateKey.startsWith('0x') && zgPrivateKey.length === 66) {
  accounts.push(zgPrivateKey);
}

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.20",
  networks: {
    zgTestnet: {
      url: zgEvmRpc,
      accounts: accounts,
    }
  }
};

export default config;

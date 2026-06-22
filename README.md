# ChainMemory 🧠⛓️

> **Decentralized, sovereign memory for AI agents — every conversation turn Merkle-proved and permanently anchored on 0G Storage.**

Built for the **[0G Zero Cup 2026](https://0g.ai/arena/zero-cup)**.

**[Live Demo](https://chain-memory.vercel.app)** · **[Video](https://youtu.be/vfhJZoIVvHk)** · **[0G Testnet](https://evmrpc-testnet.0g.ai)**

---

## The Problem

Every AI chat application today stores your conversation history in a centralized database. If the company shuts down, your history disappears. There is no way to verify what the AI was told. You don't own your data.

## The Solution

ChainMemory anchors every conversation turn directly onto **0G Storage nodes** — not a centralized server. Each message is Merkle-compiled into a content-addressed memory block and permanently indexed on the 0G EVM. The AI agent loads past memory on session start, giving it true cross-session recall. Your memory is yours. Forever. On-chain.

---

## How 0G Powers This

| Layer | Role |
|---|---|
| **0G Storage** | Every message uploaded as a `MemData` blob, content-addressed by Merkle root hash |
| **0G EVM RPC** | Signs and confirms each storage transaction on-chain |
| **0G Indexer (Turbo)** | Fast writes during live sessions via the turbo indexer |

### Memory Write Flow

```
User message / AI reply
        ↓
Serialize → { sessionId, role, content, timestamp }
        ↓
MemData blob → Merkle Tree → Root Hash
        ↓
Sign with ZG_PRIVATE_KEY via EVM RPC
        ↓
Upload to 0G Storage Nodes
        ↓
Root Hash returned → stored in Memory Index
```

Anyone with a root hash can retrieve and verify the exact memory block from any 0G storage node — no centralized intermediary required.

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Styling** | Tailwind CSS — minimal premium dark theme |
| **AI** | Groq SDK · `llama-3.3-70b-versatile` |
| **Decentralized Storage** | `@0gfoundation/0g-storage-ts-sdk` |
| **Web3** | ethers v6 — server-side signing only |
| **Deployment** | Vercel |

---

## Key Features

- **Real-time memory writing** — every message (user + AI) is uploaded to 0G Storage immediately after generation
- **Cross-session recall** — agent loads past memory on session start and injects it into context
- **Memory Timeline** — sidebar showing all past memory blocks with copyable Merkle root hashes
- **Atomic upload queue** — sequential uploads prevent EVM nonce collisions
- **Verifiable by anyone** — any root hash can be independently verified on 0G storage nodes
- **Server-side only SDK** — 0G Storage SDK runs exclusively in Next.js API routes (Node.js runtime) to avoid browser polyfill issues

---

## Architecture

```
/app
├── page.tsx                    # Chat UI + Memory Timeline sidebar
└── api/
    ├── chat/route.ts           # Groq AI completions endpoint
    └── memory/
        ├── save/route.ts       # Upload message to 0G Storage (Node runtime)
        ├── fetch/route.ts      # Fetch memory block by root hash
        └── index/route.ts      # GET/POST memory index registry
/data
└── memory-index.json           # Local index of { sessionId, rootHash, timestamp, preview }
```

> **Note:** The memory index uses a local JSON file as a fallback if the smart contract registry address is not set.

---

## Smart Contract Registry Deployment

To deploy your own instance of the `MemoryRegistry` contract:

1. **Compile**:
   ```bash
   npx hardhat compile
   ```
2. **Deploy**:
   ```bash
   node scripts/deploy.js
   ```

The `MemoryRegistry` contract is deployed and verified on **0G Testnet EVM**:

`0x5fA47420C8792142cAc5dbc608e709b68A0f0f4D`

3. Update `ZG_REGISTRY_CONTRACT_ADDRESS` in `.env.local` with the deployed address.

---

## Local Setup

### Prerequisites

- Node.js 18+
- Groq API key → [console.groq.com](https://console.groq.com)
- EVM wallet private key funded with 0G testnet tokens → [faucet.0g.ai](https://faucet.0g.ai)

### Install

```bash
git clone https://github.com/ritesh59697/ChainMemory
cd ChainMemory
npm install
```

### Configure

```bash
cp .env.example .env.local
```

```env
GROQ_API_KEY=your_groq_api_key
ZG_PRIVATE_KEY=your_funded_wallet_private_key
ZG_EVM_RPC=https://evmrpc-testnet.0g.ai
ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai

# Optional: on-chain memory index contract (omit to use local JSON fallback)
ZG_REGISTRY_CONTRACT_ADDRESS=0x5fA47420C8792142cAc5dbc608e709b68A0f0f4D
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Built for 0G Zero Cup 2026

ChainMemory demonstrates how decentralized storage networks can power sovereign, permanent memory layers for autonomous AI agents — a foundational primitive for the agentic web.

---

*Built by [@Ritesh5969](https://x.com/Ritesh5969)*

# ChainMemory 🧠⛓️

**ChainMemory** is a premium decentralized AI chat agent with persistent, secure memory anchored onto **0G Storage**. Every conversation turn is compiled into a Merkle tree, content-addressed, and permanently stored on-chain. This ensures that the agent's context and memories are sovereign, owned by the user, and verifiable by anyone.

Built for the **0G Zero Cup**.

---

## Technical Architecture & How 0G Storage is Used

In standard AI chat systems, conversation history is stored in centralized databases. **ChainMemory** shifts this paradigm by utilizing **0G Storage** to store all historical logs:

1. **Content-Addressed Storage**: When a user sends a message or when the AI generates a reply, the payload `{ sessionId, role, content, timestamp }` is serialized as a JSON string.
2. **On-Chain Merkle Validation**: The serialized string is converted into a byte array and wrapped in a `MemData` class using `@0gfoundation/0g-storage-ts-sdk`. This automatically constructs a Merkle Tree where the root hash represents a cryptographic digest of the memory.
3. **Decentralized Anchoring**: The server-side API signs the storage submission using the user's wallet private key (`ZG_PRIVATE_KEY`) and publishes the data directly to 0G storage nodes through the EVM RPC node (`ZG_EVM_RPC`) and the indexer (`ZG_INDEXER_RPC`).
4. **Verifiable Retrieval**: Anyone with the Merkle `rootHash` can query the 0G storage nodes to retrieve the exact memory segment, fully validating its integrity without relying on a centralized intermediary.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 (Minimal Premium Dark Theme)
- **AI Core**: Groq SDK (`groq-sdk` with `llama-3.3-70b-versatile` model)
- **Decentralized Storage**: `@0gfoundation/0g-storage-ts-sdk`
- **Web3 Engine**: `ethers` v6 (for signing storage transactions server-side)

---

## Project Structure

- `/app/page.tsx` - Main chat UI and memory timeline sidebar dashboard.
- `/app/api/chat/route.ts` - REST endpoint for Groq AI completions.
- `/app/api/memory/save/route.ts` - Server-side only endpoint that uploads conversation messages to 0G Storage. Runs on the Node.js runtime to bypass edge polyfill restrictions.
- `/app/api/memory/fetch/route.ts` - Server-side only endpoint that fetches memory details using the 0G Storage Indexer.
- `/app/api/memory/index/route.ts` - GET/POST registry endpoint storing metadata at `/data/memory-index.json`.

---

## Setup & Local Installation

### Prerequisites
- Node.js 18+ and npm.
- A Groq API Key (get one from [Groq Console](https://console.groq.com/)).
- An EVM private key funded with 0G testnet tokens. Refer to the [0G Faucet](https://faucet.0g.ai/) to request testnet tokens.

### Step 1: Clone and Install
```bash
# Install dependencies
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values inside `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key_here
ZG_PRIVATE_KEY=your_funded_wallet_private_key_here
ZG_EVM_RPC=https://evmrpc-testnet.0g.ai
ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai

# (Optional) Deploy contract address for On-Chain Memory Indexing
# If this is omitted, the app operates in "Local Fallback Mode" saving indexing metadata
# to `/data/memory-index.json` while still writing actual blocks to 0G storage nodes.
ZG_REGISTRY_CONTRACT_ADDRESS=your_deployed_contract_address_here
```

### Step 3: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start chatting.

---

## Built for 0G Zero Cup 🏆
This project was constructed as a submission for the **0G Zero Cup**, showcasing how decentralized storage networks can provide secure, permanent, and sovereign memory layers for autonomous AI agents.

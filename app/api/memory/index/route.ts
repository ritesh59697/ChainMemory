import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getIndexPath = () => path.join(process.cwd(), 'data', 'memory-index.json');

// Human-readable ABI for our MemoryRegistry contract
const REGISTRY_ABI = [
  "function registerMemory(string sessionId, string rootHash, uint256 timestamp, string preview) external",
  "function getAllRecords() external view returns (tuple(string sessionId, string rootHash, uint256 timestamp, string preview)[])"
];

/**
 * GET: Retrieves the full index of all saved conversation memories.
 * Queries the smart contract on 0G Testnet if configured, otherwise falls back to local JSON index.
 */
export async function GET() {
  const contractAddress = process.env.ZG_REGISTRY_CONTRACT_ADDRESS;
  const evmRpc = process.env.ZG_EVM_RPC;

  if (contractAddress && evmRpc) {
    try {
      console.log(`[Memory Index API] Fetching index from smart contract: ${contractAddress}`);
      const provider = new ethers.JsonRpcProvider(evmRpc);
      const contract = new ethers.Contract(contractAddress, REGISTRY_ABI, provider);
      
      const records = await contract.getAllRecords();
      
      const formattedRecords = records.map((r: any) => ({
        sessionId: r.sessionId,
        rootHash: r.rootHash,
        timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
        preview: r.preview,
      }));

      console.log(`[Memory Index API] Retrieved ${formattedRecords.length} records from contract.`);
      return NextResponse.json(formattedRecords);
    } catch (contractErr: any) {
      console.error('[Memory Index API] Contract call failed, falling back to local file:', contractErr);
    }
  }

  // Fallback to local JSON index file
  try {
    const indexPath = getIndexPath();
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, '[]', 'utf8');
    }
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const indexData = JSON.parse(indexContent);
    return NextResponse.json(indexData);
  } catch (error: any) {
    console.error('[Memory Index API] Error getting memory index from file:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to read memory index' },
      { status: 500 }
    );
  }
}

/**
 * POST: Appends a new conversation memory reference.
 * Saves to the deployed smart contract on 0G Testnet if configured, otherwise falls back to local JSON index.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, rootHash, timestamp, preview } = await req.json();
    
    if (!sessionId || !rootHash || !timestamp || !preview) {
      return NextResponse.json(
        { error: 'Missing parameters. Required: sessionId, rootHash, timestamp, preview' },
        { status: 400 }
      );
    }

    const contractAddress = process.env.ZG_REGISTRY_CONTRACT_ADDRESS;
    const evmRpc = process.env.ZG_EVM_RPC;
    const privateKey = process.env.ZG_PRIVATE_KEY;

    if (contractAddress && evmRpc && privateKey) {
      try {
        console.log(`[Memory Index API] Indexing memory on smart contract: ${contractAddress}`);
        const provider = new ethers.JsonRpcProvider(evmRpc);
        const signer = new ethers.Wallet(privateKey, provider);
        const contract = new ethers.Contract(contractAddress, REGISTRY_ABI, signer);

        // Convert ISO string to unix timestamp in seconds
        const unixTimestamp = Math.floor(new Date(timestamp).getTime() / 1000);

        // Submit registration transaction
        console.log(`[Memory Index API] Submitting registry transaction...`);
        const tx = await contract.registerMemory(sessionId, rootHash, unixTimestamp, preview);
        
        console.log(`[Memory Index API] Registry tx submitted: ${tx.hash}. Waiting for block confirmation...`);
        await tx.wait();
        
        console.log(`[Memory Index API] Registry transaction confirmed successfully!`);
        return NextResponse.json({ success: true, contractAddress, txHash: tx.hash });
      } catch (contractErr: any) {
        console.error('[Memory Index API] Contract transaction failed, falling back to local file:', contractErr);
      }
    }

    // Fallback to local JSON index file
    const indexPath = getIndexPath();
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, '[]', 'utf8');
    }
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const indexData = JSON.parse(indexContent);
    
    indexData.push({ sessionId, rootHash, timestamp, preview });
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, fallback: true, count: indexData.length });
  } catch (error: any) {
    console.error('[Memory Index API] Error updating memory index:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update memory index' },
      { status: 500 }
    );
  }
}

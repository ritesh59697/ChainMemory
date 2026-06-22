import { NextRequest, NextResponse } from 'next/server';
import { MemData, Indexer } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { sessionId, role, content, timestamp } = payload;

    if (!sessionId || !role || !content || !timestamp) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId, role, content, timestamp' },
        { status: 400 }
      );
    }

    if (!process.env.ZG_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'ZG_PRIVATE_KEY is not set in server environment.' },
        { status: 500 }
      );
    }

    if (!process.env.ZG_EVM_RPC) {
      return NextResponse.json(
        { error: 'ZG_EVM_RPC is not set in server environment.' },
        { status: 500 }
      );
    }

    if (!process.env.ZG_INDEXER_RPC) {
      return NextResponse.json(
        { error: 'ZG_INDEXER_RPC is not set in server environment.' },
        { status: 500 }
      );
    }

    console.log(`[Memory Save] Initializing 0G upload for session: ${sessionId}, role: ${role}`);

    const provider = new ethers.JsonRpcProvider(process.env.ZG_EVM_RPC);
    const signer = new ethers.Wallet(process.env.ZG_PRIVATE_KEY, provider);
    const indexer = new Indexer(process.env.ZG_INDEXER_RPC);

    // Serialize payload as a JSON string
    const jsonString = JSON.stringify(payload);
    const encodedData = new TextEncoder().encode(jsonString);
    const memData = new MemData(encodedData);

    console.log(`[Memory Save] Data size: ${encodedData.length} bytes. Initiating upload...`);
    
    // Upload utilizing 0G Indexer
    const [tx, err] = await indexer.upload(memData, process.env.ZG_EVM_RPC, signer);

    if (err) {
      console.error('[Memory Save] 0G Indexer upload returned an error:', err);
      return NextResponse.json(
        { error: `0G Storage upload failed: ${err.message || err}` },
        { status: 500 }
      );
    }

    let rootHash = '';
    let txHash = '';

    if (tx) {
      if ('rootHash' in tx) {
        rootHash = tx.rootHash;
        txHash = tx.txHash;
      } else if ('rootHashes' in tx && tx.rootHashes.length > 0) {
        rootHash = tx.rootHashes[0];
        txHash = tx.txHashes[0];
      }
    }

    if (!rootHash) {
      console.error('[Memory Save] No transaction or rootHash returned from upload:', tx);
      return NextResponse.json(
        { error: '0G Storage upload succeeded but did not return a valid rootHash.' },
        { status: 500 }
      );
    }

    console.log(`[Memory Save] Upload successful. rootHash: ${rootHash}, txHash: ${txHash}`);

    return NextResponse.json({
      rootHash,
      txHash,
    });
  } catch (error: any) {
    console.error('[Memory Save] Exception in save route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while saving memory' },
      { status: 500 }
    );
  }
}

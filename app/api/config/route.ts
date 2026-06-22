import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    contractAddress: process.env.ZG_REGISTRY_CONTRACT_ADDRESS || '',
    evmRpc: process.env.ZG_EVM_RPC || 'https://evmrpc-testnet.0g.ai',
    indexerRpc: process.env.ZG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai',
  });
}

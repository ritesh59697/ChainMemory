import { NextRequest, NextResponse } from 'next/server';
import { Indexer } from '@0gfoundation/0g-storage-ts-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let tempPath = '';
  try {
    const { rootHash } = await req.json();

    if (!rootHash) {
      return NextResponse.json(
        { error: 'Missing rootHash parameter' },
        { status: 400 }
      );
    }

    if (!process.env.ZG_INDEXER_RPC) {
      return NextResponse.json(
        { error: 'ZG_INDEXER_RPC is not configured in server environment.' },
        { status: 500 }
      );
    }

    console.log(`[Memory Fetch] Initializing download for rootHash: ${rootHash}`);

    const indexer = new Indexer(process.env.ZG_INDEXER_RPC);

    // Create a temporary path
    const randomHex = crypto.randomBytes(8).toString('hex');
    const tempDir = os.tmpdir() || '/tmp';
    tempPath = path.join(tempDir, `zg-memory-${randomHex}.json`);

    console.log(`[Memory Fetch] Target temp file path: ${tempPath}`);

    // Download file from 0G storage indexer
    const err = await indexer.download(rootHash, tempPath, true);

    if (err instanceof Error) {
      console.error('[Memory Fetch] Downloader returned an Error:', err);
      return NextResponse.json(
        { error: `Failed to download memory from 0G storage: ${err.message}` },
        { status: 500 }
      );
    }

    // Read file contents back as string
    if (!fs.existsSync(tempPath)) {
      console.error('[Memory Fetch] Download succeeded but destination file does not exist');
      return NextResponse.json(
        { error: 'Downloaded file was not created on local disk.' },
        { status: 500 }
      );
    }

    const fileContent = fs.readFileSync(tempPath, 'utf8');
    console.log(`[Memory Fetch] Successfully read ${fileContent.length} bytes from temp file.`);

    let parsedMemory;
    try {
      parsedMemory = JSON.parse(fileContent);
    } catch (parseErr: any) {
      console.error('[Memory Fetch] Failed to parse JSON content:', fileContent);
      return NextResponse.json(
        { error: `Failed to parse downloaded memory JSON: ${parseErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ memory: parsedMemory });
  } catch (error: any) {
    console.error('[Memory Fetch] Exception in fetch route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while fetching memory' },
      { status: 500 }
    );
  } finally {
    // Delete the temp file if it exists
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
        console.log(`[Memory Fetch] Successfully cleaned up temp file: ${tempPath}`);
      } catch (unlinkErr) {
        console.error(`[Memory Fetch] Warning: failed to delete temp file ${tempPath}:`, unlinkErr);
      }
    }
  }
}

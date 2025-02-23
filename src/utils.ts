import { Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

export function errorResponse(id: string, code: number, message: string, data?: any): unknown {
	return {
      jsonrpc: "2.0",
      error: { code, message, data },
      id,
	}
}

export async function getIdl(
  owner: PublicKey,
  provider: Provider,
  env: Env,
  ctx: ExecutionContext,
  cache?: Map<string, any>
): Promise<any> {
  const ownerStr = owner.toString();
  if (cache && cache.has(ownerStr)) return cache.get(ownerStr);
  const cacheKey = `idl:${ownerStr}`;
  let idl = env.IDL_CACHE ? await env.IDL_CACHE.get(cacheKey, 'json') : null;
  if (!idl) {
    idl = await Program.fetchIdl(owner, provider);
    if (env.IDL_CACHE && idl) {
      ctx.waitUntil(env.IDL_CACHE.put(cacheKey, JSON.stringify(idl), { expirationTtl: 3600 }));
    }
  }
  if (idl && cache) cache.set(ownerStr, idl);
  return idl;
}

export function decodeAccount(dataBuffer: Buffer, program: Program): any {
  const discriminator = dataBuffer.subarray(0, 8);
  const accountType = program.idl.accounts?.find(acc =>
    Buffer.compare(Buffer.from(acc.discriminator), discriminator) === 0
  );
  if (!accountType) {
    throw new Error("Account type not found for discriminator");
  }
  return program.coder.accounts.decode(accountType.name, dataBuffer);
}

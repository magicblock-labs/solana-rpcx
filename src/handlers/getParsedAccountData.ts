import { Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { errorResponse, getIdl, decodeAccount } from '../utils';

export async function handleGetParsedAccountData(
  body: { id: string; params?: any },
  provider: Provider,
  rpcEndpoint: string,
  env: Env,
  ctx: ExecutionContext
) {
  const req = new Request(rpcEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      ...body,
      method: 'getAccountInfo',
      params: [
        body.params?.[0],
        { encoding: 'base64' }
      ]
    })
  });

  const accountRes = await fetch(req);
  const accountInfo = await accountRes.json() as { result: { value: { data: any, owner: string } } };

  if (accountInfo.result.value) {
    const dataBuffer = Buffer.from(accountInfo.result.value.data[0], 'base64');
    const owner = new PublicKey(accountInfo.result.value.owner);
    const idl = await getIdl(owner, provider, env, ctx);

    if (!idl) {
      return errorResponse(body.id, -32602, "IDL not found for program", { programId: owner.toString() });
    }


    try {
      const program = new Program(idl as Idl, provider);
      accountInfo.result.value.data = decodeAccount(dataBuffer, program);
			console.log("Decoded account data:", accountInfo.result.value.data);
    } catch (error: unknown) {
			console.error("Failed to decode account data:", error);
      return errorResponse(body.id, -32602, "Failed to decode account data", {
        error: error instanceof Error ? error.message : String(error),
        account: body.params?.[0]
      });
    }
  }

  return accountInfo;
}

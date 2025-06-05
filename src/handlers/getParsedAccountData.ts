import { Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { errorResponse, getIdl, decodeAccount } from '../utils/utils';

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
			Accept: 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: body.id,
      method: 'getAccountInfo',
      params: [
        body.params?.[0],
        {
					encoding: 'base64',
					commitment: body.params.commitment || 'processed',
				}
      ]
    })
  });
  const accountRes = await fetch(req);
	let accountInfo;
	try {
		accountInfo = (await accountRes.json()) as { result: { value: { data: any; owner: string } } };
	} catch (error: unknown) {
		// @ts-ignore
		return errorResponse(body.id, -32602, 'Error parsing response', {
			error: error.message,
			account: body.params?.[0],
			statusCode: accountRes.status,
		});
	}
	if (accountInfo.result.value) {
		const dataBuffer = Buffer.from(accountInfo.result.value.data[0], 'base64');
		const owner = new PublicKey(accountInfo.result.value.owner);
		const idl = await getIdl(owner, provider, env, ctx);

		if (!idl) {
			return errorResponse(body.id, -32602, 'IDL not found for program', { programId: owner.toString() });
		}

    try {
      const program = new Program(idl as Idl, provider);
      const decodedAccount = decodeAccount(dataBuffer, program);
			accountInfo.result.value.data = decodedAccount.data;
			// @ts-ignore
			accountInfo.result.value.name = decodedAccount.name;
			// @ts-ignore
			accountInfo.result.value.parsed = true;
			// @ts-ignore
			accountInfo.result.value.key = body.params?.[0];
    } catch (error: unknown) {
      return errorResponse(body.id, -32602, "Failed to decode account data", {
        error: error instanceof Error ? error.message : String(error),
        account: body.params?.[0]
      });
    }
  }

	return accountInfo;
}

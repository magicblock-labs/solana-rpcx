import { Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { errorResponse, getIdl, decodeAccount } from '../utils/utils';

export async function handleGetParsedAccountsData(body: {
	id: string,
	params?: any
}, provider: Provider, rpcEndpoint: string, env: Env, ctx: ExecutionContext) {
	if (!body.params || !body.params.pubkeys || !Array.isArray(body.params.pubkeys)) {
		return errorResponse(body.id, -32602, 'Invalid parameters. Expected \'pubkeys\' array.');
	}

	const pubkeys = body.params.pubkeys;
	const onlyParsed = body.params.onlyParsed;
	const req = new Request(rpcEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: body.id,
			method: 'getMultipleAccounts',
			params: [
				pubkeys,
				{
					encoding: 'base64',
					commitment: body.params.commitment || 'processed',
				}
			]
		})
	});

	const multiRes = await fetch(req);
	const accountsResponse: AccountsResponse = await multiRes.json();

	if (!accountsResponse.result || !Array.isArray(accountsResponse.result.value)) {
		return errorResponse(body.id, -32603, 'Invalid response from getMultipleAccounts');
	}

	const idlCache = new Map<string, any>();

	try {
		// Prepare an array of promises for fetching IDLs
		const idlPromises = accountsResponse.result.value.map(async (account, _) => {
			if (account) {
				const owner = new PublicKey(account.owner);
				return getIdl(owner, provider, env, ctx, idlCache);
			}
			return null;
		});

		// Resolve all IDL promises in parallel
		const idls = await Promise.all(idlPromises);

		// Process each account with its corresponding IDL
		for (let i = 0; i < accountsResponse.result.value.length; i++) {
			const account = accountsResponse.result.value[i];
			if (account) {
				const dataBuffer = Buffer.from(account.data[0], 'base64');
				const idl = idls[i];
				if (idl) {
					const program = new Program(idl as Idl, provider);
					try {
						let decodedAccount = decodeAccount(dataBuffer, program);
						account.name = decodedAccount.name;
						account.data = decodedAccount.data;
						account.parsed = true;
						account.key = pubkeys[i].toString();
					} catch {
						console.warn('Account type not found for discriminator', {
							accountIndex: i,
							pubkey: pubkeys[i]
						});
					}
				}
				if (onlyParsed && account.parsed !== true) {
					account.data = null;
				}
			}
		}
	} catch (error: unknown) {
		return errorResponse(body.id, -32602, 'Failed to decode account data', { error: error instanceof Error ? error.message : String(error) });
	}

	return accountsResponse;
}

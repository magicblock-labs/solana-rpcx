import { Provider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { handleGetParsedAccountData } from './handlers/getParsedAccountData';
import { handleGetParsedAccountsData } from './handlers/getParsedAccountsData';
import { handleWebSocketConnection } from './websocketHandler';
import { Buffer } from 'buffer';
import { BN } from 'bn.js';
(globalThis as any).Buffer = Buffer;
(globalThis as any).BN = BN;

export class SimpleProvider implements Provider {
	readonly connection: Connection;
	readonly publicKey?: PublicKey;
	constructor(connection: Connection, publicKey?: PublicKey) {
		this.connection = connection;
		this.publicKey = publicKey;
	}
}

const JSON_HEADERS = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
};

// Add type for the RPC response
type RpcResponse = {
	result: {
		context: { slot: number };
		value: {
			data: any;
			executable: boolean;
			lamports: number;
			owner: string;
			rentEpoch: number;
			space: number;
		} | null;
	};
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		let rpcEndpoint = request?.headers?.get('Rpc')?.trim();
		console.log(env);
		if (!rpcEndpoint) {
			rpcEndpoint = env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com/';
		}
		console.log('Endpoint used:' + rpcEndpoint);

		const provider = new SimpleProvider(new Connection(rpcEndpoint));

		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);
			const wsEndpoint = rpcEndpoint.replace('https://', 'wss://');
			await handleWebSocketConnection(provider, server, wsEndpoint, env, ctx);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		// Handle HTTP requests
		let body;
		try {
			body = (await request.json()) as { method: string; id: string; params?: any };
		} catch (error: any) {
			return new Response(
				JSON.stringify({
					jsonrpc: '2.0',
					error: { code: -32700, message: 'Parse error', data: error.message },
					id: null,
				}),
				{
					status: 400,
					headers: JSON_HEADERS,
				}
			);
		}

		if (body.method === 'getAccountInfo') {
			// Check if params contains jsonParsed encoding
			const hasJsonParsed = body.params?.[1]?.encoding === 'jsonParsed';

			if (hasJsonParsed) {
				const result = (await handleGetParsedAccountData(body, provider, rpcEndpoint, env, ctx)) as RpcResponse;
				console.log(result);
				const formattedResponse = {
					context: {
						slot: result.result.context.slot,
					},
					value: result.result.value
						? {
								data: {
									parsed: result.result.value.data,
									program: result.result.value.owner,
									space: result.result.value.space,
								},
								executable: result.result.value.executable,
								lamports: result.result.value.lamports,
								owner: result.result.value.owner,
								rentEpoch: result.result.value.rentEpoch,
						  }
						: null,
				};

				return new Response(
					JSON.stringify({
						jsonrpc: '2.0',
						id: body.id,
						result: formattedResponse,
					}),
					{ headers: JSON_HEADERS }
				);
			}
		}

		if (body.method === 'getParsedAccountData') {
			const result = await handleGetParsedAccountData(body, provider, rpcEndpoint, env, ctx);
			return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
		}

		if (body.method === 'getParsedAccountsData') {
			const result = await handleGetParsedAccountsData(body, provider, rpcEndpoint, env, ctx);
			return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
		}

		// Proxy all other HTTP requests
		const proxyReq = new Request(rpcEndpoint, {
			method: request.method,
			headers: { ...request.headers, 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(body),
		});
		const proxyRes = await fetch(proxyReq);
		return new Response(proxyRes.body, { status: proxyRes.status, headers: JSON_HEADERS });
	},
} satisfies ExportedHandler<Env>;

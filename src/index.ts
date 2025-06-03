import { Provider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { handleGetParsedAccountData } from './handlers/getParsedAccountData';
import { handleGetParsedAccountsData } from './handlers/getParsedAccountsData';
import { handleWebSocketConnection } from './websocketHandler';
import { Buffer } from 'buffer';
import { BN } from 'bn.js';
import { handleGetParsedTransaction } from './handlers/getParsedTransaction';
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
	'Access-Control-Allow-Origin': '*'
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		let rpcEndpoint = request?.headers?.get("Rpc")?.trim();

		if (rpcEndpoint === "devnet"){
			rpcEndpoint = env?.RPC_ENDPOINT_DEVNET?.trim();
		}

		if (!rpcEndpoint) {
			rpcEndpoint = env?.RPC_ENDPOINT?.trim() || 'https://api.mainnet-beta.solana.com/';
		}

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
			body = await request.json() as { method: string; id: string; params?: any };
		} catch (error: any) {
			return new Response(JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32700, message: "Parse error", data: error.message },
				id: null
			}), {
				status: 400,
				headers: JSON_HEADERS
			});
		}

		if (body.method === 'getParsedAccountData') {
      const result = await handleGetParsedAccountData(body, provider, rpcEndpoint, env, ctx);
      return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
    }

		if (body.method === 'getParsedAccountsData') {
      const result = await handleGetParsedAccountsData(body, provider, rpcEndpoint, env, ctx);
      return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
		}

		if (body.method === 'getParsedTransaction') {
			const result = await handleGetParsedTransaction(body, provider, rpcEndpoint, env, ctx);
			return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
		}

    // Proxy all other HTTP requests
		const proxyReq = new Request(rpcEndpoint, {
			method: request.method,
			headers: { ...request.headers, 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify(body)
		});
		const proxyRes = await fetch(proxyReq);
		return new Response(proxyRes.body, { status: proxyRes.status, headers: JSON_HEADERS });
  },
} satisfies ExportedHandler<Env>;

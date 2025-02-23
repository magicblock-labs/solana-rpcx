import { Provider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { handleGetParsedAccountData } from './handlers/getParsedAccountData';
import { handleGetParsedAccountsData } from './handlers/getParsedAccountsData';

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

		const rpcEndpoint = request.headers.get("Rpc") || env.RPC_ENDPOINT || 'https://rpc.magicblock.app/mainnet/';
    if (request.headers.get('Upgrade') === 'websocket') {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();

      server.addEventListener('message', async (event) => {
        try {
          const wsEndpoint = rpcEndpoint.replace('https://', 'wss://');
          const provider = new SimpleProvider(new Connection(rpcEndpoint));

          const message = JSON.parse(event.data as string);


          if (message.method === 'getParsedAccountData') {
            const result = await handleGetParsedAccountData(message, provider, rpcEndpoint, env, ctx);
            server.send(JSON.stringify(result));
          } else if (message.method === 'getParsedAccountsData') {
            const result = await handleGetParsedAccountsData(message, provider, rpcEndpoint, env, ctx);
            server.send(JSON.stringify(result));
          } else {
            // Proxy other WebSocket messages
            const ws = new WebSocket(wsEndpoint);
            ws.send(JSON.stringify(message));
            ws.addEventListener('message', (wsEvent) => {
              server.send(wsEvent.data);
            });
          }
        } catch (error: unknown) {
					console.log("Error");
          if (error instanceof Error) {
            server.send(JSON.stringify({ error: error.message }));
          } else {
            server.send(JSON.stringify({ error: 'An unknown error occurred' }));
          }
        }
      });
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle HTTP requests
		const body = await request.json() as { method: string; id: string; params?: any };
		const provider = new SimpleProvider(new Connection(rpcEndpoint));

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
			headers: { ...request.headers, 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify(body)
		});
		const proxyRes = await fetch(proxyReq);
		return new Response(proxyRes.body, { status: proxyRes.status, headers: JSON_HEADERS });
  },
} satisfies ExportedHandler<Env>;

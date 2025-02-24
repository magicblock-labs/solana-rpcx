import { SimpleProvider } from './index';
import { handleGetParsedAccountData } from './handlers/getParsedAccountData';
import { handleGetParsedAccountsData } from './handlers/getParsedAccountsData';
import { Connection } from '@solana/web3.js';

export async function handleWebSocketConnection(
	server: WebSocket,
	rpcEndpoint: string,
) {
	server.accept();

	const backendSocket = new WebSocket(rpcEndpoint);

	server.addEventListener('message', event => {
		backendSocket.send(event.data);
	});

	backendSocket.addEventListener('message', event => {
		server.send(event.data);
	});

	server.addEventListener('close', () => backendSocket.close());
	backendSocket.addEventListener('close', () => server.close());
}

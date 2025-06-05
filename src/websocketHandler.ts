import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Program, Provider } from '@coral-xyz/anchor';
import { decodeAccount, getIdl } from './utils/utils';

export async function handleWebSocketConnection(
	provider: Provider,
	server: WebSocket,
	rpcEndpoint: string,
	env: Env,
	ctx: ExecutionContext
) {
	server.accept();
	const backendSocket = new WebSocket(rpcEndpoint);
	const subscriptionMap = new Map<number, PublicKey>();

	server.addEventListener('message', async (event) => {
		const message = JSON.parse(event.data as string);

		if (message.method === 'subscribeParsedAccount') {
			const accountPubkey = new PublicKey(message.params[0]);
			// Extract commitment from params if available
			const configParam = message.params[1] || {};
			const commitment = configParam.commitment || 'processed';

			const subscribeMessage = {
				jsonrpc: '2.0',
				id: message.id,
				method: 'accountSubscribe',
				params: [
					message.params[0],
					{
						encoding: 'base64',
						commitment: commitment
					}
				]
			};
			backendSocket.send(JSON.stringify(subscribeMessage));

			// Store subscription ID when we get the response
			backendSocket.addEventListener('message', function handler(event) {
				const response = JSON.parse(event.data as string);
				if (response.id === message.id) {
					subscriptionMap.set(response.result, accountPubkey);
					backendSocket.removeEventListener('message', handler);
				}
			});
		} else {
			backendSocket.send(event.data as string);
		}
	});

	backendSocket.addEventListener('message', async (event) => {
		const message = JSON.parse(event.data as string);

		if (message.method === 'accountNotification') {
			const subscription = message.params.subscription;
			const accountPubkey = subscriptionMap.get(subscription);

			if (accountPubkey) {
				const accountData = message.params.result.value;
				const dataBuffer = Buffer.from(accountData.data[0], 'base64');
				const owner = new PublicKey(accountData.owner);

				const idl = await getIdl(owner, provider, env, ctx);

				if (idl) {
					try {
						const program = new Program(idl, provider);
						let decodedAccount = decodeAccount(dataBuffer, program);
						message.params.result.value.data = decodedAccount.data;
						message.params.result.value.name = decodedAccount.name;
						message.params.result.value.parsed = true;
					} catch (error) {
						console.error('Failed to decode account data:', error);
					}
				}
			}
		}
		server.send(JSON.stringify(message));
	});

	server.addEventListener('close', () => backendSocket.close());
	backendSocket.addEventListener('close', () => server.close());
}

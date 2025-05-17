interface Env {
	RPC_ENDPOINT: string;
	RPC_ENDPOINT_DEVNET: string;
	IDL_CACHE: KVNamespace;
}

interface AccountsResponse {
	jsonrpc: string;
	result: {
		value: (AccountInfo | null)[];
	};
	id: string;
}

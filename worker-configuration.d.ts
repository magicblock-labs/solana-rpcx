interface Env {
	RPC_ENDPOINT: string;
	IDL_CACHE: KVNamespace;
}

interface AccountsResponse {
	jsonrpc: string;
	result: {
		value: (AccountInfo | null)[];
	};
	id: string;
}

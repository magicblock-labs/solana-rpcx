## Solana RpcX

A Cloudflare worker that extends Solana RPC with account parsing capabilities through rpcX methods. It enables automatic parsing for any accounts with an on-chain IDL (accounts that Solana Explorer can parse).

### Available Methods

- `getParsedAccountData` - Parse a single account
- `getParsedAccountsData` - Parse multiple accounts in batch
- `getParsedTransaction` - Parse transaction
- `subscribeParsedAccount` - Subscribe to parsed account updates

### Development

Start local development server:

```bash
npx wrangler dev
```

You can start it with a custom rpc endpoint by setting the `RPC_ENDPOINT` environment variable.

```bash
npx wrangler dev --var RPC_ENDPOINT:"https://api.devnet.solana.com"
```

### Deploy

Deploy to Cloudflare to parse on the edge:

```bash
npx wrangler deploy
```

Set the `RPC_ENDPOINT` environment variable to the URL of the base rpc endpoint.

## Usage Examples

### 1. Fetch a Single Parsed Account

```bash
curl "https://rpcx.magicblock.app" \
	-X POST \
	-H "Content-Type: application/json" \
	-d '{"jsonrpc":"2.0","id":1,"method":"getParsedAccountData","params":["FPxc7bcafdCQqHS8S1KX4ENCPP3vncxsKK3yRZ3mMzGn", {"encoding": "base64"}]}'
```

Example response:

```json
{
	"jsonrpc": "2.0",
	"id": 1,
	"result": {
		"context": {
			"slot": 322677507,
			"apiVersion": "2.1.9"
		},
		"value": {
			"lamports": 6876480,
			"data": {
				"text": "You are an AI agent ..."
			},
			"owner": "LLMrieZMpbJFwN52WgmBNMxYojrpRVYXdC1RCweEbab",
			"executable": false,
			"rentEpoch": 18446744073709552000,
			"space": 860
		}
	}
}
```

or for running locally:

```bash
curl "http://localhost:8787" \
	-X POST \
	-H "Content-Type: application/json" \
	-d '{"jsonrpc":"2.0","id":1,"method":"getParsedAccountData","params":["FPxc7bcafdCQqHS8S1KX4ENCPP3vncxsKK3yRZ3mMzGn", {"encoding": "base64"}]}'
```

### 2. Fetch Multiple Parsed Accounts

```bash
curl -s "https://rpcx.magicblock.app" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"0","method":"getParsedAccountsData","params":{"pubkeys":["GFg67j2Yq7wcW8ikRgtiRpVCEmYUw9BjteRehjNwnQrt","FPxc7bcafdCQqHS8S1KX4ENCPP3vncxsKK3yRZ3mMzGn"]}}' | jq .
```

### 3. Use Custom RPC Endpoint

Add the Rpc header to specify a custom RPC endpoint:

```bash
curl -s "https://rpcx.magicblock.app" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Rpc: https://api.mainnet-beta.solana.com/" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getParsedAccountData","params":["5RgeA5P8bRaynJovch3zQURfJxXL3QK2JYg1YamSvyLb"]}' | jq .
```

### 4. Subscribe to Parsed Account Updates

Connect:

```bash
npx wscat -c "wss://rpcx.magicblock.app"
```

or for devnet:

```bash
npx wscat -c "wss://rpcx.magicblock.app" -H "Rpc: https://api.devnet.solana.com"
```

of for running locally:

```bash
npx wscat -c "ws://localhost:8787" -H "Rpc: https://api.devnet.solana.com"
```

Subscribe to updates:

```bash
{"jsonrpc":"2.0","id":1,"method":"subscribeParsedAccount","params":["F9xLoh5xxLFNb4wYnhAPm73VWyxgBTL1HiPFVEz6uW8X",{"encoding":"jsonParsed","commitment":"confirmed"}]}
```

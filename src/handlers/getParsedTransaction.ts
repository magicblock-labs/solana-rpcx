import { Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { errorResponse, getIdl, decodeAccount, decodeTransaction, extractEventsFromLogs } from '../utils/utils';

export async function handleGetParsedTransaction(
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
      'Accept': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
			id: body.id,
      method: 'getTransaction',
      params: [
        body.params?.[0],
        {
					encoding: 'json',
					commitment: body.params.commitment || 'confirmed',
					maxSupportedTransactionVersion: 0,
				}
      ]
    })
  });
  const transactionRes = await fetch(req);
	let transactionInfo;
	try{
		transactionInfo = await transactionRes.json() as { result: { meta: any, slot: number, transaction: any } };
	}catch (error: unknown) {
		// @ts-ignore
		return errorResponse(body.id, -32602, "Error parsing response", { error: error.message, account: body.params?.[0], statusCode: accountRes.status});
	}
  if (transactionInfo.result.transaction) {
    try {
			const events: any[] = [];
			await Promise.all(transactionInfo.result.transaction.message.instructions.map(async (instruction: any, index: number) => {
					try {
						const programIdIndex = instruction.programIdIndex;
						const programId = new PublicKey(transactionInfo.result.transaction.message.accountKeys[programIdIndex]);

						const idl = await getIdl(programId, provider, env, ctx);
						if (!idl) return;

						const program = new Program(idl as Idl, provider);
						const decodedTransaction = decodeTransaction(transactionInfo.result.transaction, program);
						events.push(...extractEventsFromLogs(program, transactionInfo.result?.meta?.logMessages || []));

						const name = decodedTransaction[index]?.name;
						const data = decodedTransaction[index]?.data;

						if (name && data) {
							instruction.name = name;
							instruction.parsedData = data;
							instruction.programId = programId.toString();
							instruction.programName = program.idl.metadata?.name;
						}
					} catch (err) {
						console.error(`Error processing instruction ${index}:`, err);
					}
				})
			);
			transactionInfo.result.transaction.events = events;

    } catch (error: unknown) {
      return errorResponse(body.id, -32602, "Failed to decode account data", {
        error: error instanceof Error ? error.message : String(error),
        account: body.params?.[0]
      });
    }
  }
  return transactionInfo;
}

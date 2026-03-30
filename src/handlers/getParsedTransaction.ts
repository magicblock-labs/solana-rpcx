import { Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { errorResponse, getIdl, decodeTransaction, extractEventsFromLogs } from '../utils/utils';

export async function handleGetParsedTransaction(
  body: { id: string; params?: any },
  provider: Provider,
  rpcEndpoint: string,
  env: Env,
  ctx: ExecutionContext
) {
	const signature = body.params?.[0];
	const options = body.params?.[1] || {};

	if (!signature) {
		return errorResponse(body.id, -32602, 'Invalid parameters. Expected transaction signature.');
	}

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
        signature,
        {
					encoding: 'json',
					commitment: options.commitment || 'confirmed',
					maxSupportedTransactionVersion: options.maxSupportedTransactionVersion ?? 0,
				}
      ]
    })
  });
  const transactionRes = await fetch(req);
	const rawBody = await transactionRes.text();
	let transactionInfo;
	try{
		transactionInfo = JSON.parse(rawBody) as {
			error?: any;
			result?: { meta: any, slot: number, transaction: any } | null;
		};
	}catch (error: unknown) {
		return errorResponse(body.id, -32602, "Error parsing response", {
			error: error instanceof Error ? error.message : String(error),
			account: signature,
			statusCode: transactionRes.status,
			body: rawBody
		});
	}

	if (!transactionRes.ok) {
		return errorResponse(body.id, -32603, 'Upstream getTransaction failed', {
			account: signature,
			statusCode: transactionRes.status,
			body: rawBody
		});
	}

	if (transactionInfo.error) {
		return transactionInfo;
	}

	if (!('result' in transactionInfo)) {
		return errorResponse(body.id, -32603, 'Invalid response from getTransaction', {
			account: signature
		});
	}

	if (transactionInfo.result?.transaction) {
		try {
			const idlCache = new Map<string, any>();
			const parserCache = new Map<string, { program: Program; decodedTransaction: { name?: string; data?: any }[]; events: any[] } | null>();
			const instructions = transactionInfo.result.transaction.message?.instructions || [];
			const accountKeys = transactionInfo.result.transaction.message?.accountKeys || [];

			for (let index = 0; index < instructions.length; index++) {
				const instruction = instructions[index];

				try {
					const rawProgramId = typeof instruction?.programId === 'string'
						? instruction.programId
						: accountKeys[instruction.programIdIndex];
					const programId = typeof rawProgramId === 'string' ? rawProgramId : rawProgramId?.pubkey;
					if (!programId) continue;

					let parserState = parserCache.get(programId);
					if (parserState === undefined) {
						const idl = await getIdl(new PublicKey(programId), provider, env, ctx, idlCache);
						if (!idl) {
							parserCache.set(programId, null);
							continue;
						}

						const program = new Program(idl as Idl, provider);
						parserState = {
							program,
							decodedTransaction: decodeTransaction(transactionInfo.result.transaction, program),
							events: extractEventsFromLogs(program, transactionInfo.result?.meta?.logMessages || [])
						};
						parserCache.set(programId, parserState);
					}

					if (!parserState) continue;

					const name = parserState.decodedTransaction[index]?.name;
					const data = parserState.decodedTransaction[index]?.data;

					if (name && data) {
						instruction.name = name;
						instruction.parsedData = data;
						instruction.programId = programId;
						instruction.programName = parserState.program.idl.metadata?.name;
					}
				} catch (err) {
					console.error(`Error processing instruction ${index}:`, err);
				}
			}

			transactionInfo.result.transaction.events = Array.from(parserCache.values()).flatMap(parserState => parserState?.events || []);
		} catch (error: unknown) {
			return errorResponse(body.id, -32602, "Failed to decode transaction data", {
				error: error instanceof Error ? error.message : String(error),
				account: signature
			});
		}
	}

  return transactionInfo;
}

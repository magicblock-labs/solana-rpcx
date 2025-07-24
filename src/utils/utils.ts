import { Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { formatIdl } from './convertLegacyIdl';
import BN from "bn.js";

export function errorResponse(id: string, code: number, message: string, data?: any): unknown {
	return {
      jsonrpc: "2.0",
      error: { code, message, data },
      id,
	}
}

export async function getIdl(
  owner: PublicKey,
  provider: Provider,
  env: Env,
  ctx: ExecutionContext,
  cache?: Map<string, any>
): Promise<any> {
  const ownerStr = owner.toString();
  if (cache && cache.has(ownerStr)) return cache.get(ownerStr);
  const cacheKey = `idl:${ownerStr}`;
  let idl = env.IDL_CACHE ? await env.IDL_CACHE.get(cacheKey, 'json') : null;
  if (!idl) {
    idl = await Program.fetchIdl(owner, provider);
		try {
			idl = formatIdl(idl, ownerStr);
			if (env.IDL_CACHE && idl) {
				ctx.waitUntil(env.IDL_CACHE.put(cacheKey, JSON.stringify(idl), { expirationTtl: 3600 }));
			}
		}catch (error) {
			console.error("Error formatting IDL:", error);
		}
  }
  if (idl && cache) cache.set(ownerStr, idl);
  return idl;
}

function formatData(obj: any): any {
	if (obj instanceof BN) {
		return obj.toString(10);
	} else if (obj instanceof PublicKey) {
		return obj.toString();
	} else if (Array.isArray(obj)) {
		return obj.map(formatData);
	} else if (obj && typeof obj === "object") {
		const result: any = {};
		for (const key in obj) {
			result[key] = formatData(obj[key]);
		}
		return result;
	}
	return obj;
}

export function decodeAccount(dataBuffer: Buffer, program: Program): any {
  const discriminator = dataBuffer.subarray(0, 8);
  const accountType = program.idl.accounts?.find(acc =>
    Buffer.compare(Buffer.from(acc.discriminator), discriminator) === 0
  );
  if (!accountType) {
    throw new Error("Account type not found for discriminator");
  }
	const decoded = program.coder.accounts.decode(accountType.name, dataBuffer);
	return {
		name: accountType.name,
		data: formatData(decoded)
	};
}

export function decodeTransaction(transaction: any, program: Program): {name?: string, data?: any}[] {
	const message = transaction?.message;
	if (!message || !message.instructions) {
		console.error("Invalid transaction format");
		return [];
	}
	const decodedInstructions: any[] = [];

	for (const ix of message.instructions) {
		// Only decode if the instruction belongs to our program
		const programId = message.accountKeys[ix.programIdIndex];
		if (programId !== program.programId.toString()) {
			decodedInstructions.push({});
		}else{
			try {
				// @ts-ignore
				const decoded = program.coder.instruction.decode(ix.data, 'base64');
				decodedInstructions.push({
					name: decoded?.name,
					data: formatData(decoded?.data),
				});
			} catch (err) {
				decodedInstructions.push({});
			}
		}
	}
	return decodedInstructions;
}

export function extractEventsFromLogs(program: Program, logs: string[]): any[] {
	console.log("Parsing log");
	const events: any[] = [];

	if (!logs || logs.length === 0) return events;

	for (const log of logs) {
		console.log(log)
		const prefix = "Program data: ";
		if (log.startsWith(prefix)) {
			const base64 = log.slice(prefix.length).trim();
			try {
				const decoded = program.coder.events.decode(base64);
				if (decoded) events.push(formatData(decoded));
			} catch (err) {
				console.warn("Failed to decode event:", err);
			}
		}
	}

	return events;
}

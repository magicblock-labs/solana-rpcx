import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleGetParsedTransaction } from '../src/handlers/getParsedTransaction';
import { decodeTransaction } from '../src/utils/utils';

vi.mock('../src/utils/utils', async () => {
	const actual = await vi.importActual<typeof import('../src/utils/utils')>('../src/utils/utils');
	return {
		...actual,
		getIdl: vi.fn()
	};
});

describe('decodeTransaction', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('decodes base58 instruction data and supports object account keys', () => {
		const decode = vi.fn().mockReturnValue({
			name: 'delegate',
			data: { amount: 1 }
		});

		const result = decodeTransaction({
			message: {
				accountKeys: [{ pubkey: 'Program111' }],
				instructions: [{
					programIdIndex: 0,
					data: '3Bxs4J'
				}]
			}
		}, {
			programId: { toString: () => 'Program111' },
			coder: {
				instruction: { decode }
			}
		} as any);

		expect(decode).toHaveBeenCalledWith('3Bxs4J', 'base58');
		expect(result).toEqual([{
			name: 'delegate',
			data: { amount: 1 }
		}]);
	});
});

describe('handleGetParsedTransaction', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('uses the JSON-RPC options object and returns null results unchanged', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			jsonrpc: '2.0',
			id: '1',
			result: null
		}), { status: 200 }));

		const result = await handleGetParsedTransaction(
			{ id: '1', params: ['signature', { commitment: 'finalized', maxSupportedTransactionVersion: 3 }] },
			{} as any,
			'https://rpc.example',
			{} as any,
			{} as any
		) as any;

		const request = fetchMock.mock.calls[0][0] as Request;
		const body = JSON.parse(await request.text());

		expect(body.params[1]).toEqual({
			encoding: 'json',
			commitment: 'finalized',
			maxSupportedTransactionVersion: 3
		});
		expect(result.result).toBeNull();
	});

	it('returns a JSON-RPC error when upstream responds with non-JSON', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 502 }));

		const result = await handleGetParsedTransaction(
			{ id: '1', params: ['signature', { commitment: 'confirmed' }] },
			{} as any,
			'https://rpc.example',
			{} as any,
			{} as any
		) as any;

		expect(result.error.code).toBe(-32602);
		expect(result.error.data.statusCode).toBe(502);
		expect(result.error.data.account).toBe('signature');
	});
});

import { Connection, PublicKey } from '@solana/web3.js';

async function getParsedAccountData() {
	console.log('Connecting to RPC...');
	const connection = new Connection('http://localhost:8787', 'confirmed');

	// Account we want to fetch
	const accountPubkey = new PublicKey('F9xLoh5xxLFNb4wYnhAPm73VWyxgBTL1HiPFVEz6uW8X');
	console.log('Fetching account:', accountPubkey.toString());

	try {
		// Fetch the raw account data
		const accountInfo = await connection.getParsedAccountInfo(accountPubkey, 'confirmed');
		console.log(JSON.stringify(accountInfo, null, 2));
	} catch (error) {
		console.error('Error fetching account data:', error);
	}
}

getParsedAccountData().catch(console.error);

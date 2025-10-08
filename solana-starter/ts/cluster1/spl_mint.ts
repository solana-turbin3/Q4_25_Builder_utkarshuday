import { Keypair, PublicKey, Connection, Commitment } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  mintToChecked,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import wallet from '../turbin3-wallet.json';

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = 'confirmed';
const connection = new Connection('https://api.devnet.solana.com', commitment);

const decimals = 6;
const token_decimals = 10n ** BigInt(decimals);
const mintAmount = 100n * token_decimals;
// Mint address
const mint = new PublicKey('HrbX2x56CPEUAQdJAp4abhSZS6nTWLCr6Ctj9g6kKpbX');

try {
  // Create an ATA
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    keypair.publicKey,
    undefined,
    commitment,
    undefined,
    TOKEN_PROGRAM_ID
  );

  console.log(`Your ata is: ${ata.address.toBase58()}`);
  // Mint to ATA
  const mintTx = await mintToChecked(
    connection,
    keypair,
    mint,
    ata.address,
    keypair,
    mintAmount,
    decimals
  );
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${mintTx}?cluster=devnet`
  );
} catch (error) {
  console.log(`Oops, something went wrong: ${error}`);
}

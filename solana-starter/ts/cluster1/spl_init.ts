import {
  Keypair,
  Connection,
  Commitment,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import wallet from '../turbin3-wallet.json';

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));
//Create a Solana devnet connection
const commitment: Commitment = 'confirmed';
const connection = new Connection('https://api.devnet.solana.com', commitment);
const DECIMALS = 6;

try {
  const mint = Keypair.generate();
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: keypair.publicKey,
    newAccountPubkey: mint.publicKey,
    lamports: await getMinimumBalanceForRentExemptMint(connection),
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });

  const initializeMintIx = createInitializeMint2Instruction(
    mint.publicKey,
    DECIMALS,
    keypair.publicKey,
    keypair.publicKey,
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(createAccountIx, initializeMintIx);

  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair, mint]
  );

  console.log(`Mint ID: ${mint.publicKey.toBase58()}`);
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  );
} catch (error) {
  console.log(`Oops, something went wrong: ${error}`);
}
// Mint ID: HrbX2x56CPEUAQdJAp4abhSZS6nTWLCr6Ctj9g6kKpbX
// Success! Check out your TX here: https://explorer.solana.com/tx/2vY4GR5HWKUs4h8KVAZw1N42eJn3uMJ8RZyrzKoBPbVRiUXDEQBGYGjNpZt1HgX2g1cAmpbnS6ypbx9STxbt8cpq?cluster=devnet

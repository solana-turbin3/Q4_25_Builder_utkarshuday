import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import wallet from '../turbin3-wallet.json';
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  transfer,
  transferChecked,
} from '@solana/spl-token';

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = 'confirmed';
const connection = new Connection('https://api.devnet.solana.com', commitment);

// Mint address
const mint = new PublicKey('HrbX2x56CPEUAQdJAp4abhSZS6nTWLCr6Ctj9g6kKpbX');
const decimals = 6;
const token_decimals = 10n ** BigInt(decimals);
// Recipient address
const from = new PublicKey('BpG1zEBLGfpdoAodsQcpsuCwhnBmQRbPa6UaLmVWfZh5');

const to = new PublicKey('HwrjaPLqsq3YuR6cuK93oNtpGSsXoUtQ4oY9GwuYf2Vy');
const transferAmount = 50n * token_decimals;

try {
  // Get the token account of the fromWallet address, and if it does not exist, create it
  const fromWallet = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    from,
    undefined,
    commitment,
    undefined,
    TOKEN_PROGRAM_ID
  );
  // Get the token account of the toWallet address, and if it does not exist, create it
  const toWallet = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    to,
    undefined,
    commitment,
    undefined,
    TOKEN_PROGRAM_ID
  );
  // Transfer the new token to the "toTokenAccount" we just created
  const txSignature = await transferChecked(
    connection,
    keypair,
    fromWallet.address,
    mint,
    toWallet.address,
    keypair,
    transferAmount,
    decimals
  );

  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
  );
} catch (e) {
  console.error(`Oops, something went wrong: ${e}`);
}

import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getMintToCheckedInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import wallet from '../turbin3-wallet.json';
import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  devnet,
  createSolanaRpcSubscriptions,
  address,
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

// Import our keypair from the wallet file
const user = await createKeyPairSignerFromBytes(new Uint8Array(wallet));

//Create a Solana devnet connection
const rpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const rpcSubscriptions = createSolanaRpcSubscriptions(
  devnet('ws://api.devnet.solana.com')
);

const DECIMALS = 6;
const TOKEN_DECIMALS = 10 ** 6;

// Mint address
const mint = address('FJfKmkAACzZuQtvRWqHPePxFfWzHoiopXsZMxBSd7nN3');

try {
  // Create an ATA
  const [ata] = await findAssociatedTokenPda({
    mint,
    owner: user.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer: user,
    ata,
    owner: user.address,
    mint,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  console.log(`Your ata is: ${ata}`);

  const mintToIx = getMintToCheckedInstruction({
    mint,
    mintAuthority: user,
    decimals: DECIMALS,
    amount: 1 * TOKEN_DECIMALS,
    token: ata,
  });

  const instructions = [createAtaIx, mintToIx];

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayerSigner(user, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstructions(instructions, tx)
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage
  );
  assertIsSendableTransaction(signedTransaction);

  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
    signedTransaction,
    { commitment: 'confirmed' }
  );
  const transactionSignature = getSignatureFromTransaction(signedTransaction);
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  );
} catch (error) {
  console.log(`Oops, something went wrong: ${error}`);
}

// Your ata is: GWwq2XS2CcF212Z71v56Ukpoy439RAm8P4vttCXm5q2G
// Success! Check out your TX here: https://explorer.solana.com/tx/5XVvmkaNZYfs2KaFJFxHnZamg5Ud32D8v4RubAfXpPyQnRuaowvfwrAQxsdrBcQEewGAXc22MmbMktLK2AULDMob?cluster=devnet

import {
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithinSizeLimit,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';
import wallet from '../turbin3-wallet.json';
import { getCreateAccountInstruction } from '@solana-program/system';
import {
  getInitializeMint2Instruction,
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';

// Import our keypair from the wallet file
const user = await createKeyPairSignerFromBytes(new Uint8Array(wallet));

//Create a Solana devnet connection
const rpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const rpcSubscriptions = createSolanaRpcSubscriptions(
  devnet('ws://api.devnet.solana.com')
);

const DECIMALS = 6;

try {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(space).send();

  const createAccountIx = getCreateAccountInstruction({
    payer: user,
    newAccount: mint,
    lamports: rent,
    space,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const initMintIx = getInitializeMint2Instruction({
    mint: mint.address,
    decimals: DECIMALS,
    mintAuthority: user.address,
  });
  const instructions = [createAccountIx, initMintIx];

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
  console.log('Mint Address:', mint.address);
} catch (error) {
  console.log(`Oops, something went wrong: ${error}`);
}

// Success! Check out your TX here: https://explorer.solana.com/tx/ePbonoV9bdG6fXrjgPbchshfm4hcuVMdsdgr6nuwdP3H1BSojXGZtzrofDtpx4bM27yi668a9pBr7pfgoXfVCuz?cluster=devnet
// Mint Address: FJfKmkAACzZuQtvRWqHPePxFfWzHoiopXsZMxBSd7nN3

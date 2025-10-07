import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithinSizeLimit,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionMessageBytesBase64,
} from "@solana/kit";

import { getTransferSolInstruction } from "@solana-program/system";

import wallet from "./dev-wallet.json";
const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const keypair = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
// Define our Turbin3 wallet to send to
const turbin3Wallet = address("BpG1zEBLGfpdoAodsQcpsuCwhnBmQRbPa6UaLmVWfZh5");

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const rpcSubscriptions = createSolanaRpcSubscriptions(
  devnet("ws://api.devnet.solana.com")
);

let transferInstruction = getTransferSolInstruction({
  source: keypair,
  destination: turbin3Wallet,
  amount: lamports(1n * LAMPORTS_PER_SOL),
});
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
let transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(keypair, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([transferInstruction], tx)
);
let signedTransaction = await signTransactionMessageWithSigners(
  transactionMessage
);

assertIsTransactionWithinSizeLimit(signedTransaction);

let sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

try {
  await sendAndConfirmTransaction(signedTransaction, {
    commitment: "confirmed",
  });
  const signature = getSignatureFromTransaction(signedTransaction);
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );
} catch (e) {
  console.error("Transfer failed:", e);
}

const { value: balance } = await rpc.getBalance(keypair.address).send();

const dummyTransferInstruction = getTransferSolInstruction({
  source: keypair,
  destination: turbin3Wallet,
  amount: lamports(0n),
});

const dummyTransactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(keypair, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([dummyTransferInstruction], tx)
);

const compiledDummy = compileTransaction(dummyTransactionMessage);
const dummyMessageBase64 = Buffer.from(compiledDummy.messageBytes).toString(
  "base64"
) as TransactionMessageBytesBase64;

const { value: fee } =
  (await rpc.getFeeForMessage(dummyMessageBase64).send()) || 0n;
if (fee === null) {
  throw new Error("Unable to calculate transaction fee");
}
if (balance < fee) {
  throw new Error(
    `Insufficient balance to cover the transaction fee. Balance: ${balance}, Fee: ${fee}`
  );
}
// Calculate the exact amount to send (balance minus fee)
const sendAmount = balance - fee;
transferInstruction = getTransferSolInstruction({
  source: keypair,
  destination: turbin3Wallet,
  amount: lamports(sendAmount),
});
transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(keypair, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([transferInstruction], tx)
);

signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
assertIsTransactionWithinSizeLimit(signedTransaction);

sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

try {
  await sendAndConfirmTransaction(signedTransaction, {
    commitment: "confirmed",
  });
  const signature = getSignatureFromTransaction(signedTransaction);
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );
} catch (e) {
  console.error("Transfer failed:", e);
}

// Output:
// Success! Check out your TX here: https://explorer.solana.com/tx/25DEcUAQVj4ZJG7JsjVFe6TFkcqgF9RbEjjhpmttqiTvXMT7FYprWueHTKkLAeEN7xi7fqKbBHTh9rxf2DpZQwE5?cluster=devnet
// Success! Check out your TX here: https://explorer.solana.com/tx/3CwkFGSaCFqXc94sn7xp2hY6EbAcfo3wjiJHeQVnGmzRSAoAwVeNiGdZ953Ri8zg2hKE4DMyR3keNw6ktQFX3L6C?cluster=devnet

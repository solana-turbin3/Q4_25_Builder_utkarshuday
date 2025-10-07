import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithinSizeLimit,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  addSignersToTransactionMessage,
  getProgramDerivedAddress,
  generateKeyPairSigner,
  getAddressEncoder,
} from "@solana/kit";
import {
  getInitializeInstruction,
  getSubmitTsInstruction,
} from "./clients/js/src/generated";
import wallet from "./Turbin3-wallet.json";

const MPL_CORE_PROGRAM = address(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);
const PROGRAM_ADDRESS = address("TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

const user = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
console.log(`Your Solana wallet address: ${user.address}`);

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const rpcSubscriptions = createSolanaRpcSubscriptions(
  devnet("ws://api.devnet.solana.com"),
);

const addressEncoder = getAddressEncoder();
const accountSeeds = [
  Buffer.from("prereqs"),
  addressEncoder.encode(user.address),
];

const [account] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ADDRESS,
  seeds: accountSeeds,
});

const COLLECTION = address("5ebsp5RChCGK7ssRZMVMufgVZhd2kFbNaotcZ5UvytN2");

// const githubHandle = "utkarshuday";

// const initializeIx = getInitializeInstruction({
//   user,
//   account,
//   github: githubHandle,
//   systemProgram: SYSTEM_PROGRAM,
// });

// const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
// const transactionMessageInit = pipe(
//   createTransactionMessage({ version: 0 }),
//   (tx) => setTransactionMessageFeePayerSigner(user, tx),
//   (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
//   (tx) => appendTransactionMessageInstructions([initializeIx], tx),
// );

// const signedTxInit = await signTransactionMessageWithSigners(
//   transactionMessageInit,
// );
// assertIsTransactionWithinSizeLimit(signedTxInit);
// const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
//   rpc,
//   rpcSubscriptions,
// });
// try {
//   const result = await sendAndConfirmTransaction(signedTxInit, {
//     commitment: "confirmed",
//     skipPreflight: false,
//   });
//   console.log(result);
//   const signatureInit = getSignatureFromTransaction(signedTxInit);
//   console.log(
//     `Success! Check out your TX here: https://explorer.solana.com/tx/${signatureInit}?cluster=devnet`,
//   );
// } catch (e) {
//   console.log(e);
//   console.error(`Oops, something went wrong: ${e}`);
// }

// Output:
// Your Solana wallet address: BpG1zEBLGfpdoAodsQcpsuCwhnBmQRbPa6UaLmVWfZh5
// Success! Check out your TX here: https://explorer.solana.com/tx/54z8z76XBJ24pYEV8NUSG7mhq4McWSjgrTeNvcvub265Ms43djyGwN89wBXGXz1UY4n52qVDsBWVNsR8ScopgoLy?cluster=devnet

const mintKeyPair = await generateKeyPairSigner();
const collectionSeeds = [
  Buffer.from("collection"),
  addressEncoder.encode(COLLECTION),
];

const [authority] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ADDRESS,
  seeds: collectionSeeds,
});

const submitIx = getSubmitTsInstruction({
  user,
  account,
  mint: mintKeyPair,
  collection: COLLECTION,
  mplCoreProgram: MPL_CORE_PROGRAM,
  systemProgram: SYSTEM_PROGRAM,
  authority,
});

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const transactionMessageSubmit = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(user, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([submitIx], tx),
  (tx) => addSignersToTransactionMessage([mintKeyPair], tx),
);

const signedTxSubmit = await signTransactionMessageWithSigners(
  transactionMessageSubmit,
);
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});
assertIsTransactionWithinSizeLimit(signedTxSubmit);
try {
  await sendAndConfirmTransaction(signedTxSubmit, {
    commitment: "confirmed",
    skipPreflight: false,
  });
  const signatureSubmit = getSignatureFromTransaction(signedTxSubmit);
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${signatureSubmit}?cluster=devnet`,
  );
} catch (e) {
  console.error(`Oops, something went wrong: ${e}`);
}

// Output:
// Your Solana wallet address: BpG1zEBLGfpdoAodsQcpsuCwhnBmQRbPa6UaLmVWfZh5
// Success! Check out your TX here: https://explorer.solana.com/tx/3UueUqCChqTKwTg9tC77fyq57jcwfMWMmKtvqVXCaLeR6hdAR43XAQDr7rRJW7rdjR1E5Qd5AbPgeGxzEZ2xDa9d?cluster=devnet

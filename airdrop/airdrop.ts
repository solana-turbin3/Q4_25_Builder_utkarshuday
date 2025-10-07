import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  devnet,
  airdropFactory,
  lamports,
} from "@solana/kit";
import wallet from "./dev-wallet.json";

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const keypair = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
console.log(`Your Solana wallet address: ${keypair.address}`);

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const rpcSubscriptions = createSolanaRpcSubscriptions(
  devnet("ws://api.devnet.solana.com")
);

const airdrop = airdropFactory({ rpc, rpcSubscriptions });
try {
  const sig = await airdrop({
    commitment: "confirmed",
    recipientAddress: keypair.address,
    lamports: lamports(2n * LAMPORTS_PER_SOL),
  });
  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );
} catch (error) {
  console.error(`Oops, something went wrong: ${error}`);
}

// Output
// Your Solana wallet address: 2cuVJ8S3ca36do22fWffSS9w5MBXtUoAM5xm8ZjTvmxV
// Success! Check out your TX here:
// https://explorer.solana.com/tx/55AX1KuzuUqViSA8mD91WNUMHGedtNfrGYVR3BQCEKvJhyLgiBoTbXgR5Y3hm9mqjT7R9UxjKnLE6j1ZU33GoJhu?cluster=devnet

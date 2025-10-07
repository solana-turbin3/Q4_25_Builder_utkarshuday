import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { readFileSync, writeFileSync } from "fs";
import { Keypair } from "@solana/web3.js";

const keypairFile = readFileSync("dev-wallet.json", "utf-8");
const keypairBytes = new Uint8Array(JSON.parse(keypairFile));
const keypair = Keypair.fromSecretKey(keypairBytes);
const wallet = new Wallet(keypair);

const connection = new Connection("https://api.devnet.solana.com");
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
const idl = await Program.fetchIdl(
  "TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM",
  provider,
);

if (idl) {
  writeFileSync(
    "./programs/Turbin3_preq.json",
    JSON.stringify(idl, null, 2),
    "utf-8",
  );
}

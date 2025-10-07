import { readFileSync } from "fs";
import bs58 from "bs58";
import promptSync from "prompt-sync";

const prompt = promptSync();

function base58ToWallet() {
  const base58 = prompt("Enter your Phantom private key (base58): ");
  const walletInBytes = bs58.decode(base58);
  console.log("Wallet bytes:", walletInBytes);
}

function walletToBase58(filePath: string) {
  const keypairFile = readFileSync(filePath, "utf-8");
  const keypairBytes = new Uint8Array(JSON.parse(keypairFile)).slice(32);
  const base58 = bs58.encode(Uint8Array.from(keypairBytes));
  console.log("Base58 Phantom Key:", base58);
}

base58ToWallet();
// walletToBase58("Turbin3-wallet.json");

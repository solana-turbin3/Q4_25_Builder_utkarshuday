import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
  percentAmount,
} from '@metaplex-foundation/umi';
import {
  createNft,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';

import wallet from '../turbin3-wallet.json';
import base58 from 'bs58';

const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata());

const mint = generateSigner(umi);

let metadataUri =
  'https://gateway.irys.xyz/FoSNuoGsLGfbq5HsxAMRLaUBdbfRMJ8EiWzK52pusZNq';
let tx = createNft(umi, {
  mint,
  sellerFeeBasisPoints: percentAmount(5),
  name: 'dRug',
  symbol: 'DRUG',
  uri: metadataUri,
});
let result = await tx.sendAndConfirm(umi);
const signature = base58.encode(result.signature);

console.log(
  `Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
);

console.log('Mint Address: ', mint.publicKey);
// Mint Address:  4kQs4Xkd4fwFuufnN5ptEcuy8nTtiMZSZ5eRBY5DN3cf

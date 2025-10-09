import wallet from '../turbin3-wallet.json';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from '@metaplex-foundation/umi';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { readFile } from 'fs/promises';
import path from 'path';

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader({ address: 'https://devnet.irys.xyz/' }));
umi.use(signerIdentity(signer));

// https://arweave.net/<hash>
// https://devnet.irys.xyz/<hash>

try {
  //1. Load image
  //3. Upload image
  const image = await readFile('../assets/generug.jpeg');
  //2. Convert image to generic file.
  const file = createGenericFile(image, 'generug.jpeg', {
    tags: [{ name: 'Conten-Type', value: 'image/jpeg' }],
  });
  const [myUri] = await umi.uploader.upload([file]);
  console.log('Your image URI: ', myUri);
} catch (error) {
  console.log('Oops.. Something went wrong', error);
}

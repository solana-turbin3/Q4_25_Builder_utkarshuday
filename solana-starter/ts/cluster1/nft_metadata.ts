import wallet from '../turbin3-wallet.json';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from '@metaplex-foundation/umi';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader({ address: 'https://devnet.irys.xyz/' }));
umi.use(signerIdentity(signer));

// https://gateway.irys.xyz/BC1NwkKxa6AvFG9rCe2RJU4Fi177Foj4fyCmAc9B6SiT

try {
  // Follow this JSON structure
  // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure
  const image =
    'https://gateway.irys.xyz/BC1NwkKxa6AvFG9rCe2RJU4Fi177Foj4fyCmAc9B6SiT';
  const metadata = {
    name: 'dRug',
    symbol: 'DRUG',
    description: 'Not a drug, but a decentralized rug',
    image,
    attributes: [
      { trait_type: 'Rarity', value: 'Common' },
      { trait_type: 'Creator', value: 'Utkarsh' },
    ],
    properties: {
      files: [
        {
          type: 'image/jpeg',
          uri: image,
        },
      ],
    },
    creators: [],
  };
  const metadataUri = await umi.uploader.uploadJson(metadata);
  console.log('Your metadata URI: ', metadataUri);
} catch (error) {
  console.log('Oops.. Something went wrong', error);
}

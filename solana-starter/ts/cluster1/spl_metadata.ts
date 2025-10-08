import wallet from '../turbin3-wallet.json';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createSignerFromKeypair,
  signerIdentity,
  publicKey,
} from '@metaplex-foundation/umi';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

// Define our Mint address
const mint = publicKey('HrbX2x56CPEUAQdJAp4abhSZS6nTWLCr6Ctj9g6kKpbX');

// Create a UMI connection
const umi = createUmi('https://api.devnet.solana.com', 'confirmed');
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));

try {
  // Start here
  let accounts: CreateMetadataAccountV3InstructionAccounts = {
    mint,
    mintAuthority: signer,
  };

  let data: DataV2Args = {
    name: 'Saitama OPM',
    symbol: 'OPM',
    uri: 'https://raw.githubusercontent.com/solana-turbin3/Q4_25_Builder_utkarshuday/main/solana-starter/assets/saitama.json',
    sellerFeeBasisPoints: 500, // 5%
    creators: null,
    collection: null,
    uses: null,
  };

  let args: CreateMetadataAccountV3InstructionArgs = {
    data,
    isMutable: true,
    collectionDetails: null,
  };

  let tx = createMetadataAccountV3(umi, {
    ...accounts,
    ...args,
  });

  let result = await tx.sendAndConfirm(umi);
  console.log(bs58.encode(result.signature));
} catch (e) {
  console.error(`Oops, something went wrong: ${e}`);
}

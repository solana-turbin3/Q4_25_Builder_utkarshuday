# Airdrop

1. Create a new keypair and displayed private bytes in JSON to copy
2. Created helper functions to convert between bs58 to bytes and vice-versa
3. Airdropped 2 SOL into the new dev wallet created
4. Transferred SOL to my Turbin3 dev wallet
5. Emptied the newly created dev wallet to not leave to free up resources and avoid wasted SOL
6. Called submit_rs instruction from Turbin3 dev wallet
   - Derived pda for account using 'prereqs' and my public key as seeds
   - Derived pda for authority using 'collection' and collection public key as seeds
   - Manually added accounts in the right order with right account meta
   - Added 8-bytes discriminator of submit_rs in data
   - Created the transaction with accounts, data, signers and latest blockhash
   - Sent and confirmed the transaction to mint the NFT

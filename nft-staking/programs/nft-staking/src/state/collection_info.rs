use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CollectionInfo {
    pub collection: Pubkey, // collection address

    pub authority: Pubkey,

    #[max_len(32)]
    pub name: String, // collection name

    #[max_len(200)]
    pub uri: String, // collection uri

    #[max_len(32)]
    pub nft_name: String, // name template for NFTs in this collection

    #[max_len(200)]
    pub nft_uri: String, // base uri for NFTs in this collection

    pub bump: u8,
}

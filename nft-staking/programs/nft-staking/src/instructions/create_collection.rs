use anchor_lang::prelude::*;
use mpl_core::{instructions::CreateCollectionV2CpiBuilder, ID as CORE_PROGRAM_ID};

use crate::{error::StakeError, CollectionInfo};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateCollectionArgs {
    name: String,
    uri: String,
    nft_name: String,
    nft_uri: String,
}

#[derive(Accounts)]
pub struct CreateCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, constraint = collection.data_is_empty() @ StakeError::CollectionAlreadyInitialized)]
    pub collection: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = CollectionInfo::DISCRIMINATOR.len() + CollectionInfo::INIT_SPACE,
        seeds = [b"collection_info", collection.key().as_ref()],
        bump
    )]
    pub collection_info: Account<'info, CollectionInfo>,

    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: this account is checked by the address constraint
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateCollection<'info> {
    pub fn create_collection(
        &mut self,
        args: CreateCollectionArgs,
        bumps: &CreateCollectionBumps,
    ) -> Result<()> {
        let name = args.name.clone();
        let uri = args.uri.clone();

        self.initialize_collection_info(args, bumps.collection_info)?;

        let signers_seeds: &[&[&[u8]]] = &[&[
            b"collection_info",
            self.collection.key.as_ref(),
            &[bumps.collection_info],
        ]];

        CreateCollectionV2CpiBuilder::new(&self.core_program.to_account_info())
            .collection(&self.collection.to_account_info())
            .update_authority(Some(&self.collection_info.to_account_info()))
            .payer(&self.authority.to_account_info())
            .system_program(&self.system_program.to_account_info())
            .name(name)
            .uri(uri)
            .plugins(vec![])
            .external_plugin_adapters(vec![])
            .invoke_signed(signers_seeds)?;

        Ok(())
    }

    pub fn initialize_collection_info(
        &mut self,
        args: CreateCollectionArgs,
        bump: u8,
    ) -> Result<()> {
        self.collection_info.set_inner(CollectionInfo {
            collection: self.collection.key(),
            authority: self.authority.key(),
            name: args.name,
            uri: args.uri,
            nft_name: args.nft_name,
            nft_uri: args.nft_uri,
            bump,
        });
        Ok(())
    }
}

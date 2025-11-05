use crate::{program::Mplxcore, WhitelistedCreators};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct WhitelistCreator<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK should be a keypair
    pub creator: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = WhitelistedCreators::DISCRIMINATOR.len() + WhitelistedCreators::INIT_SPACE,
        seeds = [b"whitelist"],
        bump
    )]
    pub whitelisted_creators: Account<'info, WhitelistedCreators>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, Mplxcore>,

    #[account(constraint = program_data.upgrade_authority_address == Some(payer.key()))]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

impl<'info> WhitelistCreator<'info> {
    pub fn whitelist_creator(&mut self, bumps: &WhitelistCreatorBumps) -> Result<()> {
        self.whitelisted_creators.bump = bumps.whitelisted_creators;
        self.whitelisted_creators.whitelist_creator(&self.creator)
    }
}

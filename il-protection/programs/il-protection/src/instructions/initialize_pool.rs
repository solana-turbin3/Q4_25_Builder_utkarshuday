use crate::PoolConfig;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = signer,
        space = PoolConfig::DISCRIMINATOR.len() + PoolConfig::INIT_SPACE,
        seeds = [b"pool_config", pool_id.to_le_bytes().as_ref()],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = pool_config,
        associated_token::token_program = token_program
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializePool<'info> {
    pub fn initialize_pool(
        &mut self,
        pool_id: u64,
        premium_rate: u16,
        threshold_max: u16,
        bumps: &InitializePoolBumps,
    ) -> Result<()> {
        self.pool_config.set_inner(PoolConfig {
            pool_id,
            premium_rate,
            total_shares: 0,
            locked_shares: 0,
            threshold_max,
            pool_vault: self.pool_vault.key(),
            pool_mint: self.mint.key(),
            bump: bumps.pool_config,
        });
        Ok(())
    }
}

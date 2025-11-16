use crate::{error::ErrorCode, transfer_tokens, Policy, PoolConfig};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct ClaimProtection<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub lp_owner: Signer<'info>,

    #[account(
        mut,
        has_one = pool_vault,
        has_one = pool_mint,
        seeds = [b"pool_config", pool_config.pool_id.to_le_bytes().as_ref()],
        bump = pool_config.bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    #[account(
        mut,
        close = payer,
        seeds = [b"policy", pool_config.key().as_ref(), lp_owner.key().as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        associated_token::mint = pool_mint,
        associated_token::authority = pool_config,
        associated_token::token_program = token_program
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mint::token_program = token_program)]
    pub pool_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = pool_mint,
        associated_token::authority = lp_owner,
        associated_token::token_program = token_program
    )]
    pub lp_owner_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> ClaimProtection<'info> {
    pub fn claim_protection(&mut self, threshold: u16) -> Result<()> {
        require!(
            threshold > self.pool_config.threshold_max,
            ErrorCode::InvalidThreshold
        );

        self.pool_config.locked_shares = self
            .pool_config
            .locked_shares
            .saturating_sub(self.policy.locked_shares);

        self.transfer_amount(self.policy.coverage_amount)
    }

    pub fn transfer_amount(&mut self, amount: u64) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool_config",
            &self.pool_config.pool_id.to_le_bytes(),
            &[self.pool_config.bump],
        ]];
        transfer_tokens(
            &self.pool_vault,
            &self.lp_owner_ata,
            &self.pool_mint,
            &self.pool_config.to_account_info(),
            &self.token_program,
            amount,
            Some(signer_seeds),
        )
    }
}

use crate::error::ErrorCode;
use crate::{transfer_tokens, PoolConfig, UnderwriterStake};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct StakeCollateral<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        has_one = pool_vault,
        has_one = pool_mint,
        seeds = [b"pool_config", pool_config.pool_id.to_le_bytes().as_ref()],
        bump = pool_config.bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    #[account(
        init_if_needed,
        payer = payer,
        space = UnderwriterStake::DISCRIMINATOR.len() + UnderwriterStake::INIT_SPACE,
        seeds = [b"underwriter", pool_config.pool_id.to_le_bytes().as_ref(), underwriter.key().as_ref()],
        bump
    )]
    pub underwriter_stake: Account<'info, UnderwriterStake>,

    #[account(
        mut,
        associated_token::mint = pool_mint,
        associated_token::authority = pool_config,
        associated_token::token_program = token_program
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mint::token_program = token_program)]
    pub pool_mint: InterfaceAccount<'info, Mint>,

    pub underwriter: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = pool_mint,
        associated_token::authority = underwriter,
        associated_token::token_program = token_program
    )]
    pub underwriter_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> StakeCollateral<'info> {
    pub fn stake_collateral(&mut self, amount: u64, bumps: &StakeCollateralBumps) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let new_shares = if self.pool_config.total_shares == 0 {
            amount
        } else {
            (amount as u128)
                .checked_mul(self.pool_config.total_shares as u128)
                .unwrap()
                .checked_div(self.pool_vault.amount as u128)
                .unwrap() as u64
        };

        require!(new_shares > 0, ErrorCode::SharesZero);

        self.pool_config.total_shares = self
            .pool_config
            .total_shares
            .checked_add(new_shares)
            .ok_or(ErrorCode::Overflow)?;

        self.transfer_amount(amount)?;
        if self.underwriter_stake.shares == 0 {
            self.underwriter_stake.set_inner(UnderwriterStake {
                underwriter: self.underwriter.key(),
                pool_config: self.pool_config.key(),
                shares: new_shares,
                bump: bumps.underwriter_stake,
            });
        } else {
            self.underwriter_stake.shares = self
                .underwriter_stake
                .shares
                .checked_add(new_shares)
                .ok_or(ErrorCode::Overflow)?;
        }
        Ok(())
    }

    pub fn transfer_amount(&mut self, amount: u64) -> Result<()> {
        transfer_tokens(
            &self.underwriter_ata,
            &self.pool_vault,
            &self.pool_mint,
            &self.underwriter,
            &self.token_program,
            amount,
            None,
        )
    }
}

use crate::{error::ErrorCode, transfer_tokens, PoolConfig, UnderwriterStake};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
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
        has_one = pool_config,
        seeds = [b"underwriter", pool_config.pool_id.to_le_bytes().as_ref(), underwriter.key().as_ref()],
        bump = underwriter_stake.bump
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

    #[account(mut)]
    pub payer: Signer<'info>,

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

impl<'info> WithdrawCollateral<'info> {
    pub fn withdraw_collateral(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let withdraw_shares = (amount as u128)
            .checked_mul(self.pool_config.total_shares as u128)
            .unwrap()
            .checked_div(self.pool_vault.amount as u128)
            .unwrap() as u64;

        let underwriter_locked_shares = (self.pool_config.locked_shares as u128)
            .checked_mul(self.underwriter_stake.shares as u128)
            .unwrap()
            .checked_div(self.pool_config.total_shares as u128)
            .unwrap() as u64;

        let unlocked_shares = self
            .underwriter_stake
            .shares
            .saturating_sub(underwriter_locked_shares);

        require!(unlocked_shares > 0, ErrorCode::SharesZero);
        require!(
            withdraw_shares <= unlocked_shares,
            ErrorCode::NotEnoughShares
        );

        self.pool_config.total_shares = self
            .pool_config
            .total_shares
            .checked_sub(withdraw_shares)
            .ok_or(ErrorCode::Overflow)?;

        self.transfer_amount(amount)?;

        self.underwriter_stake.shares = self
            .underwriter_stake
            .shares
            .saturating_sub(withdraw_shares);

        Ok(())
    }

    pub fn transfer_amount(&mut self, amount: u64) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool_config",
            &self.pool_config.pool_id.to_le_bytes(),
            &[self.pool_config.bump],
        ]];

        transfer_tokens(
            &self.pool_vault,
            &self.underwriter_ata,
            &self.pool_mint,
            &self.pool_config.to_account_info(),
            &self.token_program,
            amount,
            Some(signer_seeds),
        )
    }
}

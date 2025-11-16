use crate::{error::ErrorCode, transfer_tokens, Policy, PoolConfig};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct BuyProtection<'info> {
    pub lp_owner: Signer<'info>,

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
        init,
        payer = payer,
        space = Policy::DISCRIMINATOR.len() + Policy::INIT_SPACE,
        seeds = [b"policy", pool_config.key().as_ref(), lp_owner.key().as_ref()],
        bump
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

impl<'info> BuyProtection<'info> {
    pub fn buy_protection(
        &mut self,
        threshold: u16,
        coverage_amount: u64,
        duration: i64,
        bumps: &BuyProtectionBumps,
    ) -> Result<()> {
        require!(
            threshold <= self.pool_config.threshold_max,
            ErrorCode::InvalidThreshold
        );
        require!(coverage_amount > 0, ErrorCode::InvalidAmount);

        let duration_order = 2_592_000u128;
        let premium_order = 10_000u128;

        let total_amount = (coverage_amount as u128)
            .checked_mul(self.pool_config.premium_rate as u128)
            .unwrap()
            .checked_div(premium_order)
            .unwrap()
            .checked_mul(duration as u128)
            .unwrap()
            .checked_div(duration_order)
            .unwrap() as u64;

        self.transfer_amount(total_amount)?;

        let locked_shares = (total_amount as u128)
            .checked_mul(self.pool_config.total_shares as u128)
            .unwrap()
            .checked_div(self.pool_vault.amount as u128)
            .unwrap() as u64;

        self.pool_config.locked_shares = self
            .pool_config
            .locked_shares
            .checked_add(locked_shares)
            .ok_or(ErrorCode::Overflow)?;

        self.initialize_policy(
            threshold,
            coverage_amount,
            locked_shares,
            duration,
            bumps.policy,
        )?;
        Ok(())
    }

    pub fn initialize_policy(
        &mut self,
        threshold: u16,
        coverage_amount: u64,
        locked_shares: u64,
        duration: i64,
        bump: u8,
    ) -> Result<()> {
        let start_time = Clock::get()?.unix_timestamp;
        let expiry_time = start_time
            .checked_add(duration)
            .ok_or(ErrorCode::Overflow)?;
        self.policy.set_inner(Policy {
            pool_config: self.pool_config.key(),
            policy_id: self.pool_config.pool_id,
            coverage_amount,
            threshold,
            locked_shares,
            start_time,
            expiry_time,
            bump,
        });
        Ok(())
    }

    pub fn transfer_amount(&mut self, amount: u64) -> Result<()> {
        transfer_tokens(
            &self.lp_owner_ata,
            &self.pool_vault,
            &self.pool_mint,
            &self.lp_owner,
            &self.token_program,
            amount,
            None,
        )
    }
}

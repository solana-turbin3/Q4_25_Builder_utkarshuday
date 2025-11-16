pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("pVdRxAaaKsbhhZoMpmZsBaUBxtGd3TZCsVzFbmwhioh");

#[program]
pub mod il_protection {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_id: u64,
        premium_rate: u16,
        threshold_max: u16,
    ) -> Result<()> {
        ctx.accounts
            .initialize_pool(pool_id, premium_rate, threshold_max, &ctx.bumps)
    }

    pub fn buy_protection(
        ctx: Context<BuyProtection>,
        threshold: u16,
        coverage_amount: u64,
        duration: i64,
    ) -> Result<()> {
        ctx.accounts
            .buy_protection(threshold, coverage_amount, duration, &ctx.bumps)
    }

    pub fn claim_protection(ctx: Context<ClaimProtection>, threshold: u16) -> Result<()> {
        ctx.accounts.claim_protection(threshold)
    }

    pub fn stake_collateral(ctx: Context<StakeCollateral>, amount: u64) -> Result<()> {
        ctx.accounts.stake_collateral(amount, &ctx.bumps)
    }

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_collateral(amount)
    }
}

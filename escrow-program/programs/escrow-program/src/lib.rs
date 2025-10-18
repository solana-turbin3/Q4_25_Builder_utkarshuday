pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2ZfeZLFy6V7Y7E4bczRPfYE2ihXYec7ZyTC2kSPGD7sU");

#[program]
pub mod escrow_program {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        ctx.accounts.handler(seed, deposit, receive, &ctx.bumps)
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.handler()
    }
}

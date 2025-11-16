use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UnderwriterStake {
    pub underwriter: Pubkey,
    pub pool_config: Pubkey,
    pub shares: u64, // shares of underwriter for the pool
    pub bump: u8,
}

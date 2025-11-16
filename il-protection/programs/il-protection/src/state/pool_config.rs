use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PoolConfig {
    pub pool_id: u64,       // unique pool identifier
    pub premium_rate: u16,  // premium rate in basis points (10_000)
    pub total_shares: u64,  // number of shares held by the pool
    pub locked_shares: u64, // number of shares locked
    pub threshold_max: u16, // maximum threshold in basis points (10_000)
    pub pool_vault: Pubkey, // token account storing the tokens
    pub pool_mint: Pubkey,  // stablecoin mint for pool
    pub bump: u8,           // bump for policy account
}

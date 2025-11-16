use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub pool_config: Pubkey,
    pub policy_id: u64,
    pub threshold: u16,
    pub locked_shares: u64,
    pub coverage_amount: u64,
    pub start_time: i64,
    pub expiry_time: i64,
    pub bump: u8,
}

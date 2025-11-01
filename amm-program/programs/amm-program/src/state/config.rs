use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub seed: u64,      // create different configs / pools
    pub mint_x: Pubkey, // token x
    pub mint_y: Pubkey, // token y
    pub fee: u16,       // fee in basis points
    pub locked: bool,   // pool is locked or not
    pub lp_bump: u8,    // bump for lp mint
    pub bump: u8,       // bump for config account
}

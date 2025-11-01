pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("6ayQJu8ZmfVfsincKddpZ34VGJHw98HSTBjNjDwrhrJ4");

#[program]
pub mod amm_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, seed: u64, fee: u16) -> Result<()> {
        ctx.accounts.init(seed, fee, &ctx.bumps)
    }
}

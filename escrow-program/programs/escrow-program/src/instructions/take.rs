use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Take<'info> {
    pub system_program: Program<'info, System>,
}

impl<'info> Take<'info> {
    pub fn handler(&mut self) -> Result<()> {
        Ok(())
    }
}

use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Refund<'info> {
    pub system_program: Program<'info, System>,
}

impl<'info> Refund<'info> {
    pub fn handler(&mut self) -> Result<()> {
        Ok(())
    }
}

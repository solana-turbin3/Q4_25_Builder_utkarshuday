use crate::Escrow;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        init,
        payer = maker,
        seeds = [b"escrow", maker.key().as_ref()],
        bump,
        space = Escrow::DISCRIMINATOR.len() + Escrow::INIT_SPACE 
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}
impl<'info> Make<'info> {
    pub fn handler(&mut self) -> Result<()> {
        Ok(())
    }
}

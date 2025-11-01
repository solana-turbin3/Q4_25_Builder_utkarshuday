use crate::Config;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint_x: InterfaceAccount<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        associated_token::mint = mint_x,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub vault_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = initializer,
        associated_token::mint = mint_y,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub vault_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = initializer,
        seeds = [b"lp", config.key.as_ref()],
        bump, 
        mint::decimals = 6,
        mint::authority = config
    )]
    pub mint_lp: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        space = Config::DISCRIMINATOR.len() + Config::INIT_SPACE,
        seeds = [b"config", seed.to_le_bytes().as_ref()],
        bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn init(&mut self, seed: u64, fee: u16, bumps: &InitializeBumps) -> Result<()> {
        self.config.set_inner(Config {
            seed,
            mint_x: self.mint_x.key(),
            mint_y: self.mint_y.key(),
            fee,
            locked: false,
            lp_bump: bumps.mint_lp,
            bump: bumps.config,
        });
        Ok(())
    }
}

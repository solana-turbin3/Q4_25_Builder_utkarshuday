use crate::error::AmmError;
use crate::{transfer_tokens, Config};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to_checked, Mint, MintToChecked, TokenAccount, TokenInterface},
};
use constant_product_curve::ConstantProduct;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint_x: InterfaceAccount<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub mint_y: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub vault_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub vault_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_x: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_y: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut, 
        seeds = [b"lp", config.key().as_ref()],
        bump = config.lp_bump, 
        mint::decimals = 6,
        mint::authority = config
    )]
    pub mint_lp: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_lp,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_lp: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64, max_x: u64, max_y: u64) -> Result<()> {
        require!(!self.config.locked, AmmError::PoolLocked);
        require_eq!(amount, 0, AmmError::InvalidAmount);

        let first_deposit =
            self.mint_lp.supply == 0 && self.vault_x.amount == 0 && self.vault_y.amount == 0;
        let (x, y) = if first_deposit {
            (max_x, max_y)
        } else {
            let amounts = ConstantProduct::xy_deposit_amounts_from_l(
                self.vault_x.amount,
                self.vault_y.amount,
                self.mint_lp.supply,
                amount,
                6,
            )
            .unwrap();
            (amounts.x, amounts.y)
        };

        require!(x <= max_x && y <= max_y, AmmError::SlippageExceeded);

        transfer_tokens(
            &self.user_x,
            &self.vault_x,
            &self.mint_x,
            &self.user.to_account_info(),
            &self.token_program,
            x,
            None,
        )?;

        transfer_tokens(
            &self.user_y,
            &self.vault_y,
            &self.mint_y,
            &self.user.to_account_info(),
            &self.token_program,
            y,
            None,
        )?;

        self.mint_lp_tokens(amount)
    }
    pub fn mint_lp_tokens(&mut self, amount: u64) -> Result<()> {
        let cpi_accounts = MintToChecked {
            mint: self.mint_lp.to_account_info(),
            to: self.user_lp.to_account_info(),
            authority: self.config.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"config",
            &self.config.seed.to_le_bytes(),
            &[self.config.bump],
        ]];
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds);
        mint_to_checked(cpi_ctx, amount, self.mint_lp.decimals)
    }
}

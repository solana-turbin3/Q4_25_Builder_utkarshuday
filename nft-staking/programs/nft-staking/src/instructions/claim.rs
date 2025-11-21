use crate::{error::StakeError, StakeConfig, UserAccount};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to_checked, Mint, MintToChecked, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = reward_mint,
        associated_token::authority = user,
    )]
    pub rewards_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"rewards".as_ref(), config.key().as_ref()],
        bump = config.reward_bump,
    )]
    pub reward_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"config".as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StakeConfig>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self) -> Result<()> {
        require!(self.user_account.points > 0, StakeError::NotEnoughPoints);

        let amount = self.user_account.points as u64;
        self.mint_token(amount)?;
        self.user_account.points = 0;
        Ok(())
    }

    pub fn mint_token(&mut self, amount: u64) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[b"config", &[self.config.bump]]];

        mint_to_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                MintToChecked {
                    mint: self.reward_mint.to_account_info(),
                    to: self.rewards_ata.to_account_info(),
                    authority: self.config.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
            self.reward_mint.decimals,
        )
    }
}

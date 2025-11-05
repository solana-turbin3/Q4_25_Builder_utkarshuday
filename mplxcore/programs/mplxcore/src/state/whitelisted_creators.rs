use crate::error::MplxCoreError;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WhitelistedCreators {
    pub creators: [Pubkey; 10],
    pub num_creators: u8,
    pub bump: u8,
}

impl WhitelistedCreators {
    pub fn contains(&self, creator: &AccountInfo) -> bool {
        self.creators[..self.num_creators as usize].contains(creator.key)
    }

    pub fn whitelist_creator(&mut self, creator: &AccountInfo) -> Result<()> {
        if self.creators.len() <= self.num_creators as usize {
            return err!(MplxCoreError::CreatorListFull);
        }

        if self.contains(creator) {
            return err!(MplxCoreError::CreatorAlreadyWhitelisted);
        }

        self.creators[self.num_creators as usize] = creator.key();
        self.num_creators += 1;
        Ok(())
    }
}

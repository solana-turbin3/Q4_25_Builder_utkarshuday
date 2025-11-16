use anchor_lang::prelude::error_code;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount provided")]
    InvalidAmount,

    #[msg("Calculated shares are zero")]
    SharesZero,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid Threshold")]
    InvalidThreshold,

    #[msg("Not enough shares to withdraw")]
    NotEnoughShares,
}

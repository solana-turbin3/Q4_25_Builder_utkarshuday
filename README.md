# IL Protection - Impermanent Loss Protection Protocol

A Solana-based decentralized protocol that provides impermanent loss (IL) protection for liquidity providers through a pool-based insurance mechanism.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Program Instructions](#program-instructions)
- [Account Structures](#account-structures)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [License](#license)

## Overview

The IL Protection protocol enables liquidity providers (LPs) to purchase insurance against impermanent loss while allowing underwriters to stake collateral and earn premiums. The protocol uses a share-based system to manage pooled collateral and locked funds efficiently.

## Key Features

### For Liquidity Providers
- **Purchase Protection**: Buy IL protection policies with customizable thresholds and coverage amounts
- **Claim Payouts**: Receive coverage when impermanent loss exceeds the defined threshold
- **Flexible Duration**: Choose protection periods based on individual needs

### For Underwriters
- **Stake Collateral**: Provide liquidity to the protection pool and earn premiums
- **Earn Premiums**: Generate yield from LP protection purchases
- **Withdraw Unlocked Funds**: Remove collateral that isn't backing active policies

### For Pool Administrators
- **Initialize Pools**: Create new protection pools with custom parameters
- **Set Premium Rates**: Configure premium rates in basis points
- **Define Thresholds**: Set maximum IL thresholds for the pool

## Architecture

The protocol is built on Solana using the Anchor framework and consists of five main instructions:
```
┌─────────────────────────────────────────────────────┐
│                  IL Protection Pool                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Pool Vault (Collateral Storage)                    │
│  ├── Total Shares                                   │
│  ├── Locked Shares (backing policies)               │
│  └── Available Shares (withdrawable)                │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Underwriters              Liquidity Providers       │
│  ├── Stake Collateral      ├── Buy Protection       │
│  ├── Earn Premiums         ├── Define Coverage      │
│  └── Withdraw Funds        └── Claim Payouts        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Program Instructions

### 1. `initialize_pool`

Creates a new protection pool with specified parameters.

**Parameters:**
- `pool_id`: Unique identifier for the pool (u64)
- `premium_rate`: Premium rate in basis points (u16, where 10000 = 100%)
- `threshold_max`: Maximum claimable threshold in basis points (u16)

**Accounts:**
- `pool_config`: PDA storing pool configuration
- `pool_vault`: Associated token account for holding collateral
- `mint`: Token mint for the pool (stablecoin)
- `signer`: Pool creator and fee payer

**Example:**
```typescript
await program.methods
  .initializePool(poolId, 500, 2000) // 5% premium, 20% max threshold
  .accounts({...})
  .rpc();
```

---

### 2. `stake_collateral`

Allows underwriters to deposit collateral into the pool and receive shares.

**Parameters:**
- `amount`: Amount of tokens to stake (u64)

**Accounts:**
- `pool_config`: Pool configuration account
- `underwriter_stake`: PDA tracking underwriter's shares
- `pool_vault`: Pool's token vault
- `underwriter`: Signer providing collateral
- `underwriter_ata`: Underwriter's token account

**Share Calculation:**
```
new_shares = (amount × total_shares) / vault_balance

For first deposit:
new_shares = amount
```

**Example:**
```typescript
await program.methods
  .stakeCollateral(new BN(100_000_000)) // 100 tokens
  .accounts({...})
  .rpc();
```

---

### 3. `buy_protection`

Enables LPs to purchase IL protection policies.

**Parameters:**
- `threshold`: IL threshold for claims in basis points (u16)
- `coverage_amount`: Amount of coverage to purchase (u64)
- `duration`: Policy duration in seconds (i64)

**Accounts:**
- `lp_owner`: LP purchasing protection
- `pool_config`: Pool configuration
- `policy`: PDA storing policy details
- `pool_vault`: Pool's collateral vault
- `lp_owner_ata`: LP's token account for premium payment

**Premium Calculation:**
```
premium = (coverage_amount × premium_rate) / 10000 × duration / 30 days
locked_shares = (premium × total_shares) / vault_balance
```

**Example:**
```typescript
await program.methods
  .buyProtection(
    1000,              // 10% threshold
    new BN(50_000_000), // 50 tokens coverage
    new BN(2592000)    // 30 days
  )
  .accounts({...})
  .rpc();
```

---

### 4. `claim_protection`

Allows LPs to claim coverage when IL exceeds their threshold.

**Parameters:**
- `threshold`: Current IL threshold to verify claim eligibility (u16)

**Accounts:**
- `lp_owner`: Policy owner claiming coverage
- `pool_config`: Pool configuration
- `policy`: Policy account (will be closed)
- `pool_vault`: Pool's collateral vault
- `lp_owner_ata`: LP's token account to receive payout

**Claim Requirements:**
```
threshold > pool_config.threshold_max
```

**On Success:**
- LP receives `coverage_amount` tokens
- `locked_shares` are released back to the pool
- Policy account is closed and rent returned to LP

**Example:**
```typescript
await program.methods
  .claimProtection(2500) // 25% IL occurred
  .accounts({...})
  .rpc();
```

---

### 5. `withdraw_collateral`

Enables underwriters to withdraw unlocked collateral from the pool.

**Parameters:**
- `amount`: Amount of tokens to withdraw (u64)

**Accounts:**
- `pool_config`: Pool configuration
- `underwriter_stake`: Underwriter's stake account
- `pool_vault`: Pool's token vault
- `underwriter`: Signer withdrawing collateral
- `underwriter_ata`: Underwriter's token account

**Withdrawal Calculation:**
```
withdraw_shares = (amount × total_shares) / vault_balance
underwriter_locked = (locked_shares × underwriter_shares) / total_shares
unlocked_shares = underwriter_shares - underwriter_locked

require: withdraw_shares <= unlocked_shares
```

**Example:**
```typescript
await program.methods
  .withdrawCollateral(new BN(50_000_000)) // 50 tokens
  .accounts({...})
  .rpc();
```

## Account Structures

### PoolConfig
```rust
pub struct PoolConfig {
    pub pool_id: u64,          // Unique pool identifier
    pub premium_rate: u16,     // Premium rate in basis points
    pub total_shares: u64,     // Total shares in the pool
    pub locked_shares: u64,    // Shares locked by active policies
    pub threshold_max: u16,    // Maximum claimable threshold
    pub pool_vault: Pubkey,    // Token account storing collateral
    pub pool_mint: Pubkey,     // Stablecoin mint
    pub bump: u8,              // PDA bump seed
}
```

**PDA Derivation:**
```
seeds = [b"pool_config", pool_id.to_le_bytes()]
```

---

### UnderwriterStake
```rust
pub struct UnderwriterStake {
    pub underwriter: Pubkey,   // Underwriter's public key
    pub pool_config: Pubkey,   // Associated pool
    pub shares: u64,           // Number of shares owned
    pub bump: u8,              // PDA bump seed
}
```

**PDA Derivation:**
```
seeds = [b"underwriter", pool_id.to_le_bytes(), underwriter.key()]
```

---

### Policy
```rust
pub struct Policy {
    pub pool_config: Pubkey,   // Associated pool
    pub policy_id: u64,        // Policy identifier
    pub threshold: u16,        // IL threshold for claims
    pub locked_shares: u64,    // Shares locked for this policy
    pub coverage_amount: u64,  // Coverage amount
    pub start_time: i64,       // Policy start timestamp
    pub expiry_time: i64,      // Policy expiry timestamp
    pub bump: u8,              // PDA bump seed
}
```

**PDA Derivation:**
```
seeds = [b"policy", pool_config.key(), lp_owner.key()]
```

## How It Works

### 1. Pool Initialization
An administrator creates a pool with:
- Premium rate (e.g., 5% = 500 basis points)
- Maximum threshold (e.g., 20% = 2000 basis points)
- Token mint (usually a stablecoin like USDC)

### 2. Underwriters Provide Liquidity
Underwriters stake tokens to the pool:
- Receive shares proportional to their contribution
- Shares represent ownership of pool assets
- Earn premiums from LP protection purchases

### 3. LPs Buy Protection
Liquidity providers purchase policies:
- Pay premiums based on coverage amount and duration
- Premiums are added to the pool vault
- Corresponding shares are locked to back the policy

### 4. Claiming Protection
When IL exceeds the threshold:
- LP calls `claim_protection` with current IL percentage
- If `threshold > threshold_max`, claim succeeds
- LP receives coverage amount
- Locked shares are released
- Policy account is closed

### 5. Underwriter Withdrawals
Underwriters can withdraw unlocked collateral:
- System calculates their locked shares from active policies
- Can only withdraw from unlocked portion
- Maintains pool solvency for active claims

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd il-protection
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the program:
```bash
anchor build
```

## Testing

The project includes comprehensive tests for all instructions.

### Run All Tests
```bash
surfpool start
anchor test --skip-local-validator --skip-deploy --provider.cluster localnet
```

### Test Coverage

- ✅ Pool initialization with various parameters
- ✅ Staking collateral (single and multiple underwriters)
- ✅ Buying protection with different thresholds and durations
- ✅ Claiming protection when eligible
- ✅ Withdrawing unlocked collateral
- ❌ Error cases (invalid amounts, unauthorized access, insufficient funds)

## Security Considerations

### Access Control
- Only pool creators can initialize pools
- Underwriters can only withdraw their own collateral
- LPs can only claim their own policies

### Validation
- All amounts must be greater than zero
- Thresholds must not exceed pool maximum
- Withdrawals cannot exceed unlocked shares
- Claims require threshold breach validation

### Economic Security
- Share-based system prevents dilution attacks
- Locked shares ensure pool solvency
- Premium calculations prevent arbitrage
- Withdrawal restrictions protect active policies

### Known Limitations
- Single policy per LP per pool (one policy PDA per LP)
- No policy expiration enforcement (LPs don't get refunds)
- No oracle integration (threshold verification is manual)
- No governance mechanism for parameter updates

## Error Codes
```rust
pub enum ErrorCode {
    #[msg("Invalid amount provided")]
    InvalidAmount,
    
    #[msg("Invalid threshold")]
    InvalidThreshold,
    
    #[msg("Shares calculation resulted in zero")]
    SharesZero,
    
    #[msg("Not enough shares available")]
    NotEnoughShares,
    
    #[msg("Arithmetic overflow")]
    Overflow,
    
    #[msg("Not authorized")]
    NotAuthorized,
    
    #[msg("Invalid collection")]
    InvalidCollection,
}
```

## Future Enhancements

- [ ] Oracle integration for automated IL calculation
- [ ] Policy expiration and refund mechanism
- [ ] Multi-policy support per LP
- [ ] Governance for parameter adjustments
- [ ] Dynamic premium pricing based on utilization
- [ ] Emergency pause mechanism

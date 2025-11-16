import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IlProtection } from "../target/types/il_protection";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

describe("il-protection", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.IlProtection as Program<IlProtection>;
  const connection = provider.connection;

  // Accounts
  const payer = provider.wallet;
  let mint: PublicKey;
  const underwriter1 = Keypair.generate();
  const underwriter2 = Keypair.generate();
  const lpOwner1 = Keypair.generate();
  const lpOwner2 = Keypair.generate();
  const lpOwner3 = Keypair.generate();
  const claimant1 = Keypair.generate();
  const claimant2 = Keypair.generate();
  // Test parameters
  const poolId = new anchor.BN(1);
  const premiumRate = 500; // 5% (500 basis points)
  const thresholdMax = 2000; // 20% (2000 basis points)
  let lpOwner1Ata: PublicKey;
  let lpOwner2Ata: PublicKey;
  let lpOwner3Ata: PublicKey;
  let policy1Pda: PublicKey;
  let policy2Pda: PublicKey;
  let claimant1Ata: PublicKey;
  let claimant2Ata: PublicKey;
  let claimPolicy1Pda: PublicKey;
  let claimPolicy2Pda: PublicKey;

  // PDAs
  let poolConfigPda: PublicKey;
  let poolVaultPda: PublicKey;
  let underwriter1StakePda: PublicKey;
  let underwriter2StakePda: PublicKey;
  let underwriter1Ata: PublicKey;
  let underwriter2Ata: PublicKey;

  console.log(`payer ${payer.publicKey.toString()}`);

  before(async () => {
    // Fund underwriter accounts
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for airdrops

    // Create a mint for the pool (stablecoin)
    const mintKeypair = Keypair.generate();

    await createMint(
      connection,
      payer.payer,
      payer.publicKey,
      payer.publicKey,
      6, // decimals
      mintKeypair,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    mint = mintKeypair.publicKey;
    console.log(`mint ${mint.toString()}`);

    // Derive PDAs
    poolConfigPda = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_config"), poolId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
    console.log(`poolConfigPda ${poolConfigPda.toString()}`);

    // Derive the associated token account for the pool vault
    poolVaultPda = getAssociatedTokenAddressSync(
      mint,
      poolConfigPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`poolVaultPda ${poolVaultPda.toString()}`);
  });

  describe("InitializePool", () => {
    it("Successfully initializes a pool", async () => {
      try {
        const initializePoolIx = await program.methods
          .initializePool(poolId, premiumRate, thresholdMax)
          .accountsStrict({
            poolConfig: poolConfigPda,
            poolVault: poolVaultPda,
            mint: mint,
            signer: payer.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        await createAndSendV0Tx([initializePoolIx]);
      } catch (error: any) {
        console.error(`Error initializing pool: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Fetch and verify the pool config account
      const poolConfig = await program.account.poolConfig.fetch(poolConfigPda);

      console.log(`Pool Config:`);
      console.log(`  pool_id: ${poolConfig.poolId.toString()}`);
      console.log(`  premium_rate: ${poolConfig.premiumRate}`);
      console.log(`  total_shares: ${poolConfig.totalShares.toString()}`);
      console.log(`  locked_shares: ${poolConfig.lockedShares.toString()}`);
      console.log(`  threshold_max: ${poolConfig.thresholdMax}`);
      console.log(`  pool_vault: ${poolConfig.poolVault.toString()}`);
      console.log(`  pool_mint: ${poolConfig.poolMint.toString()}`);
      console.log(`  bump: ${poolConfig.bump}`);

      // Assertions
      assert.equal(
        poolConfig.poolId.toString(),
        poolId.toString(),
        "Pool ID should match"
      );
      assert.equal(
        poolConfig.premiumRate,
        premiumRate,
        "Premium rate should match"
      );
      assert.equal(
        poolConfig.totalShares.toString(),
        "0",
        "Total shares should be initialized to 0"
      );
      assert.equal(
        poolConfig.lockedShares.toString(),
        "0",
        "Locked shares should be initialized to 0"
      );
      assert.equal(
        poolConfig.thresholdMax,
        thresholdMax,
        "Threshold max should match"
      );
      assert.equal(
        poolConfig.poolVault.toString(),
        poolVaultPda.toString(),
        "Pool vault should match the derived PDA"
      );
      assert.equal(
        poolConfig.poolMint.toString(),
        mint.toString(),
        "Pool mint should match the provided mint"
      );

      // Verify the pool vault token account was created
      const poolVaultAccount = await connection.getAccountInfo(poolVaultPda);
      assert.ok(poolVaultAccount, "Pool vault account should exist");
    });

    it("Fails to initialize the same pool twice", async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const initializePoolIx = await program.methods
          .initializePool(poolId, premiumRate, thresholdMax)
          .accountsStrict({
            poolConfig: poolConfigPda,
            poolVault: poolVaultPda,
            mint: mint,
            signer: payer.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        await createAndSendV0Tx([initializePoolIx]);
        assert.fail("Should have failed with account already in use");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        // The error should indicate that the account already exists
        assert.ok(
          error.message.includes("already in use") ||
            error.message.includes("custom program error: 0x0"),
          "Should fail with account already in use error"
        );
      }
    });

    it("Initializes a different pool with a different pool_id", async () => {
      const newPoolId = new anchor.BN(2);
      const newPremiumRate = 300; // 3%
      const newThresholdMax = 1500; // 15%

      // Derive new PDAs for the second pool
      const newPoolConfigPda = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_config"), newPoolId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )[0];

      const newPoolVaultPda = getAssociatedTokenAddressSync(
        mint,
        newPoolConfigPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        const initializePoolIx = await program.methods
          .initializePool(newPoolId, newPremiumRate, newThresholdMax)
          .accountsStrict({
            poolConfig: newPoolConfigPda,
            poolVault: newPoolVaultPda,
            mint: mint,
            signer: payer.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        await createAndSendV0Tx([initializePoolIx]);
      } catch (error: any) {
        console.error(`Error initializing second pool: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Verify the second pool config
      const newPoolConfig = await program.account.poolConfig.fetch(
        newPoolConfigPda
      );

      assert.equal(
        newPoolConfig.poolId.toString(),
        newPoolId.toString(),
        "Second pool ID should match"
      );
      assert.equal(
        newPoolConfig.premiumRate,
        newPremiumRate,
        "Second pool premium rate should match"
      );
      assert.equal(
        newPoolConfig.thresholdMax,
        newThresholdMax,
        "Second pool threshold max should match"
      );
    });
  });

  describe("StakeCollateral", () => {
    before(async () => {
      // Derive underwriter stake PDAs
      underwriter1StakePda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("underwriter"),
          poolId.toArrayLike(Buffer, "le", 8),
          underwriter1.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`underwriter1StakePda ${underwriter1StakePda.toString()}`);

      underwriter2StakePda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("underwriter"),
          poolId.toArrayLike(Buffer, "le", 8),
          underwriter2.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`underwriter2StakePda ${underwriter2StakePda.toString()}`);

      // Create and fund underwriter ATAs
      underwriter1Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        underwriter1.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`underwriter1Ata ${underwriter1Ata.toString()}`);

      underwriter2Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        underwriter2.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`underwriter2Ata ${underwriter2Ata.toString()}`);

      // Mint tokens to underwriters
      await mintTo(
        connection,
        payer.payer,
        mint,
        underwriter1Ata,
        payer.publicKey,
        1_000_000_000, // 1000 tokens (6 decimals)
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      await mintTo(
        connection,
        payer.payer,
        mint,
        underwriter2Ata,
        payer.publicKey,
        2_000_000_000, // 2000 tokens (6 decimals)
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Underwriters funded with tokens");
    });

    it("Successfully stakes collateral for the first time", async () => {
      const stakeAmount = 100_000_000; // 100 tokens

      try {
        const stakeCollateralIx = await program.methods
          .stakeCollateral(new anchor.BN(stakeAmount))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();
        await createAndSendV0Tx([stakeCollateralIx], [underwriter1]);
      } catch (error: any) {
        console.error(`Error staking collateral: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Fetch and verify underwriter stake
      const underwriterStake = await program.account.underwriterStake.fetch(
        underwriter1StakePda
      );

      console.log(`Underwriter Stake:`);
      console.log(`  underwriter: ${underwriterStake.underwriter.toString()}`);
      console.log(`  pool_config: ${underwriterStake.poolConfig.toString()}`);
      console.log(`  shares: ${underwriterStake.shares.toString()}`);
      console.log(`  bump: ${underwriterStake.bump}`);

      // Verify pool config updated
      const poolConfig = await program.account.poolConfig.fetch(poolConfigPda);
      console.log(`Pool total_shares: ${poolConfig.totalShares.toString()}`);

      // Assertions
      assert.equal(
        underwriterStake.underwriter.toString(),
        underwriter1.publicKey.toString(),
        "Underwriter should match"
      );
      assert.equal(
        underwriterStake.poolConfig.toString(),
        poolConfigPda.toString(),
        "Pool config should match"
      );
      assert.equal(
        underwriterStake.shares.toString(),
        stakeAmount.toString(),
        "Shares should equal stake amount for first deposit"
      );
      assert.equal(
        poolConfig.totalShares.toString(),
        stakeAmount.toString(),
        "Total shares should equal first stake amount"
      );

      // Verify tokens transferred
      const poolVaultAccount = await connection.getTokenAccountBalance(
        poolVaultPda
      );
      assert.equal(
        poolVaultAccount.value.amount,
        stakeAmount.toString(),
        "Pool vault should have the staked amount"
      );
    });

    it("Successfully adds more collateral to existing stake", async () => {
      const additionalAmount = 50_000_000; // 50 tokens
      const previousStake = await program.account.underwriterStake.fetch(
        underwriter1StakePda
      );
      const previousShares = previousStake.shares;
      const previousPoolConfig = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      const previousTotalShares = previousPoolConfig.totalShares;

      try {
        const stakeCollateralIx = await program.methods
          .stakeCollateral(new anchor.BN(additionalAmount))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();

        await createAndSendV0Tx([stakeCollateralIx], [underwriter1]);
      } catch (error: any) {
        console.error(`Error adding collateral: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Fetch updated stake
      const updatedStake = await program.account.underwriterStake.fetch(
        underwriter1StakePda
      );
      const updatedPoolConfig = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      console.log(`Updated shares: ${updatedStake.shares.toString()}`);
      console.log(
        `Updated total shares: ${updatedPoolConfig.totalShares.toString()}`
      );

      // Shares should increase proportionally
      assert.ok(
        updatedStake.shares.gt(previousShares),
        "Shares should increase"
      );
      assert.ok(
        updatedPoolConfig.totalShares.gt(previousTotalShares),
        "Total shares should increase"
      );
    });

    it("Second underwriter stakes collateral", async () => {
      const stakeAmount = 200_000_000; // 200 tokens
      const previousPoolConfig = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      const previousTotalShares = previousPoolConfig.totalShares;
      const poolVaultBalance = await connection.getTokenAccountBalance(
        poolVaultPda
      );
      const previousVaultAmount = BigInt(poolVaultBalance.value.amount);

      try {
        const stakeCollateralIx = await program.methods
          .stakeCollateral(new anchor.BN(stakeAmount))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter2StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter2.publicKey,
            underwriterAta: underwriter2Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter2, payer.payer])
          .instruction();
        await createAndSendV0Tx([stakeCollateralIx], [underwriter2]);
      } catch (error: any) {
        console.error(`Error staking collateral: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Fetch underwriter2 stake
      const underwriter2Stake = await program.account.underwriterStake.fetch(
        underwriter2StakePda
      );
      const updatedPoolConfig = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      console.log(
        `Underwriter2 shares: ${underwriter2Stake.shares.toString()}`
      );
      console.log(
        `Pool total shares: ${updatedPoolConfig.totalShares.toString()}`
      );

      // Calculate expected shares
      const expectedShares =
        (BigInt(stakeAmount) * BigInt(previousTotalShares.toString())) /
        previousVaultAmount;

      console.log(`Expected shares: ${expectedShares.toString()}`);

      assert.equal(
        underwriter2Stake.underwriter.toString(),
        underwriter2.publicKey.toString(),
        "Underwriter2 should match"
      );
      assert.ok(
        underwriter2Stake.shares.gt(new anchor.BN(0)),
        "Should have shares"
      );
      assert.ok(
        updatedPoolConfig.totalShares.gt(previousTotalShares),
        "Total shares should increase"
      );
    });

    it("Fails to stake with zero amount", async () => {
      try {
        const stakeCollateralIx = await program.methods
          .stakeCollateral(new anchor.BN(0))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();
        await createAndSendV0Tx([stakeCollateralIx], [underwriter1]);
        assert.fail("Should have failed with zero amount");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("InvalidAmount"),
          "Should fail with InvalidAmount error"
        );
      }
    });

    it("Fails to stake with insufficient balance", async () => {
      const excessiveAmount = new anchor.BN(10_000_000_000); // More than balance

      try {
        const stakeCollateralIx = await program.methods
          .stakeCollateral(excessiveAmount)
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();
        await createAndSendV0Tx([stakeCollateralIx], [underwriter1]);
        assert.fail("Should have failed with insufficient balance");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("insufficient funds") ||
            error.message.includes("Error Code: InsufficientFunds"),
          "Should fail with insufficient funds error"
        );
      }
    });
  });

  describe("BuyProtection", () => {
    before(async () => {
      // Fund LP owner accounts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create and fund LP owner ATAs
      lpOwner1Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        lpOwner1.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`lpOwner1Ata ${lpOwner1Ata.toString()}`);

      lpOwner2Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        lpOwner2.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`lpOwner2Ata ${lpOwner2Ata.toString()}`);

      lpOwner3Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        lpOwner3.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`lpOwner3Ata ${lpOwner3Ata.toString()}`);

      // Mint tokens to LP owners
      await mintTo(
        connection,
        payer.payer,
        mint,
        lpOwner1Ata,
        payer.publicKey,
        1_000_000_000, // 1000 tokens
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      await mintTo(
        connection,
        payer.payer,
        mint,
        lpOwner2Ata,
        payer.publicKey,
        500_000_000, // 500 tokens
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      await mintTo(
        connection,
        payer.payer,
        mint,
        lpOwner3Ata,
        payer.publicKey,
        500_000_000, // 500 tokens
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      // Derive policy PDAs
      policy1Pda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          lpOwner1.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`policy1Pda ${policy1Pda.toString()}`);

      policy2Pda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          lpOwner2.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`policy2Pda ${policy2Pda.toString()}`);

      console.log("LP owners funded with tokens");
    });

    it("Successfully buys protection", async () => {
      const threshold = 1000; // 10%
      const coverageAmount = 50_000_000; // 50 tokens
      const duration = 2592000; // 30 days in seconds

      const poolConfigBefore = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      const lockedSharesBefore = poolConfigBefore.lockedShares;

      try {
        const buyProtectionIx = await program.methods
          .buyProtection(
            threshold,
            new anchor.BN(coverageAmount),
            new anchor.BN(duration)
          )
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: lpOwner1.publicKey,
            poolConfig: poolConfigPda,
            policy: policy1Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: lpOwner1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([lpOwner1, payer.payer])
          .instruction();
        await createAndSendV0Tx([buyProtectionIx], [lpOwner1]);
      } catch (error: any) {
        console.error(`Error buying protection: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      // Fetch and verify policy
      const policy = await program.account.policy.fetch(policy1Pda);
      console.log(`Policy:`);
      console.log(`  pool_config: ${policy.poolConfig.toString()}`);
      console.log(`  policy_id: ${policy.policyId.toString()}`);
      console.log(`  threshold: ${policy.threshold}`);
      console.log(`  locked_shares: ${policy.lockedShares.toString()}`);
      console.log(`  coverage_amount: ${policy.coverageAmount.toString()}`);
      console.log(`  start_time: ${policy.startTime.toString()}`);
      console.log(`  expiry_time: ${policy.expiryTime.toString()}`);

      // Assertions
      assert.equal(
        policy.poolConfig.toString(),
        poolConfigPda.toString(),
        "Pool config should match"
      );
      assert.equal(
        policy.policyId.toString(),
        poolId.toString(),
        "Policy ID should match pool ID"
      );
      assert.equal(policy.threshold, threshold, "Threshold should match");
      assert.equal(
        policy.coverageAmount.toString(),
        coverageAmount.toString(),
        "Coverage amount should match"
      );
      assert.ok(
        policy.lockedShares.gt(new anchor.BN(0)),
        "Locked shares should be greater than 0"
      );

      // Verify expiry time
      const expectedExpiry = policy.startTime.add(new anchor.BN(duration));
      assert.equal(
        policy.expiryTime.toString(),
        expectedExpiry.toString(),
        "Expiry time should be start_time + duration"
      );

      // Verify pool config updated
      const poolConfigAfter = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      assert.ok(
        poolConfigAfter.lockedShares.gt(lockedSharesBefore),
        "Locked shares should increase"
      );
    });

    it("Second LP owner buys protection with different parameters", async () => {
      const threshold = 1500; // 15%
      const coverageAmount = 30_000_000; // 30 tokens
      const duration = 5184000; // 60 days

      try {
        const buyProtectionIx = await program.methods
          .buyProtection(
            threshold,
            new anchor.BN(coverageAmount),
            new anchor.BN(duration)
          )
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: lpOwner2.publicKey,
            poolConfig: poolConfigPda,
            policy: policy2Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: lpOwner2Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([lpOwner2, payer.payer])
          .instruction();
        await createAndSendV0Tx([buyProtectionIx], [lpOwner2]);
      } catch (error: any) {
        console.error(`Error buying protection: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      const policy2 = await program.account.policy.fetch(policy2Pda);
      assert.equal(policy2.threshold, threshold, "Threshold should match");
      assert.equal(
        policy2.coverageAmount.toString(),
        coverageAmount.toString(),
        "Coverage amount should match"
      );
    });

    it("Fails to buy protection with threshold exceeding maximum", async () => {
      const invalidThreshold = 3000; // 30%, exceeds threshold_max of 20%
      const coverageAmount = 50_000_000;
      const duration = 2592000;

      const invalidPolicyPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          lpOwner3.publicKey.toBuffer(),
        ],
        program.programId
      )[0];

      try {
        const buyProtectionIx = await program.methods
          .buyProtection(
            invalidThreshold,
            new anchor.BN(coverageAmount),
            new anchor.BN(duration)
          )
          .accountsPartial({
            lpOwner: lpOwner3.publicKey,
            poolConfig: poolConfigPda,
            policy: invalidPolicyPda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: lpOwner3Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([lpOwner3])
          .instruction();
        await createAndSendV0Tx([buyProtectionIx], [lpOwner3]);
        assert.fail("Should have failed with invalid threshold");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("InvalidThreshold"),
          "Should fail with InvalidThreshold error"
        );
      }
    });

    it("Fails to buy protection with zero coverage amount", async () => {
      const threshold = 1000;
      const coverageAmount = 0;
      const duration = 2592000;

      const invalidPolicyPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          lpOwner3.publicKey.toBuffer(),
        ],
        program.programId
      )[0];

      try {
        const buyProtectionIx = await program.methods
          .buyProtection(
            threshold,
            new anchor.BN(coverageAmount),
            new anchor.BN(duration)
          )
          .accountsPartial({
            lpOwner: lpOwner3.publicKey,
            poolConfig: poolConfigPda,
            policy: invalidPolicyPda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: lpOwner3Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([lpOwner3])
          .instruction();
        await createAndSendV0Tx([buyProtectionIx], [lpOwner3]);
        assert.fail("Should have failed with zero coverage amount");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("InvalidAmount"),
          "Should fail with InvalidAmount error"
        );
      }
    });

    it("Fails to buy same policy twice", async () => {
      const threshold = 1000;
      const coverageAmount = 1_000_000;
      const duration = 2592000;
      try {
        const buyProtectionIx = await program.methods
          .buyProtection(
            threshold,
            new anchor.BN(coverageAmount),
            new anchor.BN(duration)
          )
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: lpOwner1.publicKey,
            poolConfig: poolConfigPda,
            policy: policy1Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: lpOwner1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([lpOwner1])
          .instruction();
        await createAndSendV0Tx([buyProtectionIx], [lpOwner1]);
        assert.fail("Should have failed - policy already exists");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("already in use") ||
            error.message.includes("custom program error: 0x0"),
          "Should fail with account already exists error"
        );
      }
    });
  });

  describe("WithdrawCollateral", () => {
    it("Successfully withdraws collateral", async () => {
      const withdrawer = underwriter1;
      const withdrawerAta = underwriter1Ata;
      const withdrawerStakePda = underwriter1StakePda;

      const stakeBefore = await program.account.underwriterStake.fetch(
        withdrawerStakePda
      );
      const poolConfigBefore = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      // Now withdraw
      const withdrawAmount = 1_000_000; // 1 tokens

      try {
        const withdrawCollateralIx = await program.methods
          .withdrawCollateral(new anchor.BN(withdrawAmount))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: withdrawerStakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: withdrawer.publicKey,
            underwriterAta: withdrawerAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([withdrawer, payer.payer])
          .instruction();
        await createAndSendV0Tx([withdrawCollateralIx], [withdrawer]);
      } catch (error: any) {
        console.error(`Error withdrawing collateral: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      const stakeAfter = await program.account.underwriterStake.fetch(
        withdrawerStakePda
      );
      const poolConfigAfter = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      console.log(`Shares before: ${stakeBefore.shares.toString()}`);
      console.log(`Shares after: ${stakeAfter.shares.toString()}`);
      console.log(
        `Total shares before: ${poolConfigBefore.totalShares.toString()}`
      );
      console.log(
        `Total shares after: ${poolConfigAfter.totalShares.toString()}`
      );

      assert.ok(
        stakeAfter.shares.lt(stakeBefore.shares),
        "Shares should decrease"
      );
      assert.ok(
        poolConfigAfter.totalShares.lt(poolConfigBefore.totalShares),
        "Total shares should decrease"
      );
    });

    it("Fails to withdraw zero amount", async () => {
      try {
        const withdrawCollateralIx = await program.methods
          .withdrawCollateral(new anchor.BN(0))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();
        await createAndSendV0Tx([withdrawCollateralIx], [underwriter1]);
        assert.fail("Should have failed with zero amount");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("InvalidAmount"),
          "Should fail with InvalidAmount error"
        );
      }
    });

    it("Fails to withdraw more than unlocked shares", async () => {
      // underwriter1 has staked but also has locked shares from policies
      // Try to withdraw more than their unlocked shares
      const excessiveAmount = new anchor.BN(1_000_000_000); // Very large amount

      try {
        const withdrawCollateralIx = await program.methods
          .withdrawCollateral(excessiveAmount)
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: underwriter1StakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: underwriter1.publicKey,
            underwriterAta: underwriter1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([underwriter1, payer.payer])
          .instruction();
        await createAndSendV0Tx([withdrawCollateralIx], [underwriter1]);
        assert.fail("Should have failed with not enough shares");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("NotEnoughShares") ||
            error.message.includes("SharesZero"),
          "Should fail with NotEnoughShares or SharesZero error"
        );
      }
    });

    it("Fails to withdraw when underwriter has no stake", async () => {
      const noStaker = Keypair.generate();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const noStakerAta = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        noStaker.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );

      const noStakerStakePda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("underwriter"),
          poolId.toArrayLike(Buffer, "le", 8),
          noStaker.publicKey.toBuffer(),
        ],
        program.programId
      )[0];

      try {
        const withdrawCollateralIx = await program.methods
          .withdrawCollateral(new anchor.BN(10_000_000))
          .accountsStrict({
            payer: payer.publicKey,
            poolConfig: poolConfigPda,
            underwriterStake: noStakerStakePda,
            poolVault: poolVaultPda,
            poolMint: mint,
            underwriter: noStaker.publicKey,
            underwriterAta: noStakerAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([noStaker, payer.payer])
          .instruction();
        await createAndSendV0Tx([withdrawCollateralIx], [noStaker]);
        assert.fail("Should have failed with no shares");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("SharesZero") ||
            error.message.includes("AccountNotInitialized") ||
            error.message.includes("Account does not exist")
        );
      }
    });
  });

  describe("ClaimProtection", () => {
    before(async () => {
      // Fund claimant accounts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create and fund claimant ATAs
      claimant1Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        claimant1.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`claimant1Ata ${claimant1Ata.toString()}`);

      claimant2Ata = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        claimant2.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`claimant2Ata ${claimant2Ata.toString()}`);

      // Mint tokens to claimants
      await mintTo(
        connection,
        payer.payer,
        mint,
        claimant1Ata,
        payer.publicKey,
        500_000_000,
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      await mintTo(
        connection,
        payer.payer,
        mint,
        claimant2Ata,
        payer.publicKey,
        500_000_000,
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      // Derive policy PDAs
      claimPolicy1Pda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          claimant1.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`claimPolicy1Pda ${claimPolicy1Pda.toString()}`);

      claimPolicy2Pda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          claimant2.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log(`claimPolicy2Pda ${claimPolicy2Pda.toString()}`);

      // Buy protection policies for claimants
      const threshold = 1000; // 10%
      const coverageAmount = 100_000_000; // 100 tokens
      const duration = 2592000; // 30 days

      const ix1 = await program.methods
        .buyProtection(
          threshold,
          new anchor.BN(coverageAmount),
          new anchor.BN(duration)
        )
        .accountsStrict({
          payer: payer.publicKey,
          lpOwner: claimant1.publicKey,
          poolConfig: poolConfigPda,
          policy: claimPolicy1Pda,
          poolVault: poolVaultPda,
          poolMint: mint,
          lpOwnerAta: claimant1Ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimant1, payer.payer])
        .instruction();
      const ix2 = await program.methods
        .buyProtection(
          threshold,
          new anchor.BN(coverageAmount),
          new anchor.BN(duration)
        )
        .accountsStrict({
          payer: payer.publicKey,
          lpOwner: claimant2.publicKey,
          poolConfig: poolConfigPda,
          policy: claimPolicy2Pda,
          poolVault: poolVaultPda,
          poolMint: mint,
          lpOwnerAta: claimant2Ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimant2, payer.payer])
        .instruction();
      await createAndSendV0Tx([ix1, ix2], [claimant1, claimant2]);

      console.log("Claimants funded and policies purchased");
    });

    it("Successfully claims protection when threshold is exceeded", async () => {
      const thresholdExceeded = 2500; // 25%, exceeds threshold_max of 20%

      const poolConfigBefore = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      const policyBefore = await program.account.policy.fetch(claimPolicy1Pda);
      const balanceBefore = await connection.getTokenAccountBalance(
        claimant1Ata
      );

      console.log(
        `Locked shares before: ${poolConfigBefore.lockedShares.toString()}`
      );
      console.log(`Coverage amount: ${policyBefore.coverageAmount.toString()}`);
      console.log(`Balance before: ${balanceBefore.value.amount}`);

      try {
        const claimProtectionIx = await program.methods
          .claimProtection(thresholdExceeded)
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: claimant1.publicKey,
            poolConfig: poolConfigPda,
            policy: claimPolicy1Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: claimant1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([claimant1, payer.payer])
          .instruction();
        await createAndSendV0Tx([claimProtectionIx], [claimant1]);
      } catch (error: any) {
        console.error(`Error claiming protection: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      const poolConfigAfter = await program.account.poolConfig.fetch(
        poolConfigPda
      );
      const balanceAfter = await connection.getTokenAccountBalance(
        claimant1Ata
      );

      console.log(
        `Locked shares after: ${poolConfigAfter.lockedShares.toString()}`
      );
      console.log(`Balance after: ${balanceAfter.value.amount}`);

      // Assertions
      assert.ok(
        poolConfigAfter.lockedShares.lt(poolConfigBefore.lockedShares),
        "Locked shares should decrease"
      );

      const balanceIncrease =
        BigInt(balanceAfter.value.amount) - BigInt(balanceBefore.value.amount);
      assert.equal(
        balanceIncrease.toString(),
        policyBefore.coverageAmount.toString(),
        "Balance should increase by coverage amount"
      );

      // Verify policy account is closed
      try {
        await program.account.policy.fetch(claimPolicy1Pda);
        assert.fail("Policy account should be closed");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Account does not exist"),
          "Policy account should not exist after claim"
        );
      }
    });

    it("Second claimant successfully claims protection", async () => {
      const thresholdExceeded = 3000; // 30%

      const poolConfigBefore = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      try {
        const claimProtectionIx = await program.methods
          .claimProtection(thresholdExceeded)
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: claimant2.publicKey,
            poolConfig: poolConfigPda,
            policy: claimPolicy2Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: claimant2Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([claimant2, payer.payer])
          .instruction();
        await createAndSendV0Tx([claimProtectionIx], [claimant2]);
      } catch (error: any) {
        console.error(`Error claiming protection: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        }
        throw error;
      }

      const poolConfigAfter = await program.account.poolConfig.fetch(
        poolConfigPda
      );

      assert.ok(
        poolConfigAfter.lockedShares.lt(poolConfigBefore.lockedShares),
        "Locked shares should decrease after second claim"
      );
    });

    it("Fails to claim when threshold does not exceed maximum", async () => {
      // Create a new claimant with policy
      const newClaimant = Keypair.generate();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newClaimantAta = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        newClaimant.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );

      await mintTo(
        connection,
        payer.payer,
        mint,
        newClaimantAta,
        payer.publicKey,
        500_000_000,
        [],
        null,
        TOKEN_2022_PROGRAM_ID
      );

      const newPolicyPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          newClaimant.publicKey.toBuffer(),
        ],
        program.programId
      )[0];

      // Buy protection
      const buyProtectionIx = await program.methods
        .buyProtection(1000, new anchor.BN(50_000_000), new anchor.BN(2592000))
        .accountsStrict({
          payer: payer.publicKey,
          lpOwner: newClaimant.publicKey,
          poolConfig: poolConfigPda,
          policy: newPolicyPda,
          poolVault: poolVaultPda,
          poolMint: mint,
          lpOwnerAta: newClaimantAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([newClaimant, payer.payer])
        .instruction();

      // Try to claim with threshold that doesn't exceed maximum (20%)
      const invalidThreshold = 1500; // 15%, does not exceed 20%

      try {
        const claimProtectionIx = await program.methods
          .claimProtection(invalidThreshold)
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: newClaimant.publicKey,
            poolConfig: poolConfigPda,
            policy: newPolicyPda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: newClaimantAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([newClaimant, payer.payer])
          .instruction();
        await createAndSendV0Tx(
          [buyProtectionIx, claimProtectionIx],
          [newClaimant]
        );
        assert.fail("Should have failed with invalid threshold");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("InvalidThreshold"),
          "Should fail with InvalidThreshold error"
        );
      }
    });

    it("Fails to claim already claimed policy", async () => {
      const thresholdExceeded = 2500;

      try {
        const claimProtectionIx = await program.methods
          .claimProtection(thresholdExceeded)
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: claimant1.publicKey,
            poolConfig: poolConfigPda,
            policy: claimPolicy1Pda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: claimant1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([claimant1, payer.payer])
          .instruction();
        await createAndSendV0Tx([claimProtectionIx], [claimant1]);
        assert.fail("Should have failed - policy already claimed");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("Account does not exist") ||
            error.message.includes("AccountNotInitialized"),
          "Should fail with account not found error"
        );
      }
    });

    it("Fails to claim non-existent policy", async () => {
      const nonExistentClaimant = Keypair.generate();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const nonExistentAta = await createAssociatedTokenAccount(
        connection,
        payer.payer,
        mint,
        nonExistentClaimant.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      );

      const nonExistentPolicyPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("policy"),
          poolConfigPda.toBuffer(),
          nonExistentClaimant.publicKey.toBuffer(),
        ],
        program.programId
      )[0];

      try {
        const claimProtectionIx = await program.methods
          .claimProtection(2500)
          .accountsStrict({
            payer: payer.publicKey,
            lpOwner: nonExistentClaimant.publicKey,
            poolConfig: poolConfigPda,
            policy: nonExistentPolicyPda,
            poolVault: poolVaultPda,
            poolMint: mint,
            lpOwnerAta: nonExistentAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([nonExistentClaimant, payer.payer])
          .instruction();
        await createAndSendV0Tx([claimProtectionIx], [nonExistentClaimant]);
        assert.fail("Should have failed - policy does not exist");
      } catch (error: any) {
        console.log(`Expected error: ${error.message}`);
        assert.ok(
          error.message.includes("Account does not exist") ||
            error.message.includes("AccountNotInitialized"),
          "Should fail with account not found error"
        );
      }
    });
  });

  async function createAndSendV0Tx(
    txInstructions: anchor.web3.TransactionInstruction[],
    signers: anchor.web3.Signer[] = []
  ) {
    // Step 1 - Fetch the latest blockhash
    let latestBlockhash = await provider.connection.getLatestBlockhash(
      "confirmed"
    );
    console.log(
      "   ✅ - Fetched latest blockhash. Last Valid Height:",
      latestBlockhash.lastValidBlockHeight
    );

    // Step 2 - Generate Transaction Message
    const messageV0 = new anchor.web3.TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();
    console.log("   ✅ - Compiled Transaction Message");
    const transaction = new anchor.web3.VersionedTransaction(messageV0);

    // Step 3 - Sign your transaction with the required `Signers`
    transaction.sign(signers);
    provider.wallet.signTransaction(transaction);
    console.log("   ✅ - Transaction Signed");

    // Step 4 - Send our v0 transaction to the cluster
    const txid = await provider.connection.sendTransaction(transaction, {
      maxRetries: 5,
    });
    console.log("   ✅ - Transaction sent to network");

    // Step 5 - Confirm Transaction
    const confirmation = await provider.connection.confirmTransaction({
      signature: txid,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
    if (confirmation.value.err) {
      throw new Error(
        `   ❌ - Transaction not confirmed.\nReason: ${confirmation.value.err}`
      );
    }

    console.log("🎉 Transaction Successfully Confirmed!");
  }
});

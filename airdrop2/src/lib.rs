#[cfg(test)]
mod tests {
    use bs58;
    use solana_system_interface::{ instruction::transfer, program as system_program };
    use std::io::{ self, BufRead };
    use solana_sdk::{
        message::Message,
        pubkey::Pubkey,
        signature::{ read_keypair_file, Keypair, Signer },
        transaction::Transaction,
        instruction::{ Instruction, AccountMeta },
    };
    use solana_client::rpc_client::RpcClient;
    use std::str::FromStr;

    const RPC_URL: &str =
        "https://turbine-solanad-4cde.devnet.rpcpool.com/9a9da9cf-6db1-47dc-839a-55aca5c9c80a";

    #[test]
    fn keygen() {
        let kp = Keypair::new();
        println!("You've generated a new Solana wallet: {}\n", kp.pubkey());
        println!("To save your wallet, copy and paste the following into a JSON file:");
        println!("{:?}", kp.to_bytes());
    }

    #[test]
    fn base58_to_wallet() {
        println!("Input your private key as a base58 string:");
        let stdin = io::stdin();
        let base58 = stdin.lock().lines().next().unwrap().unwrap();
        println!("Your wallet file format is:");
        let wallet = bs58::decode(base58).into_vec().unwrap();
        println!("{:?}", wallet);
    }

    #[test]
    fn wallet_to_base58() {
        println!("Input your private key as a JSON byte array (e.g. [12,34,...]):");
        let stdin = io::stdin();
        let wallet = stdin
            .lock()
            .lines()
            .next()
            .unwrap()
            .unwrap()
            .trim_start_matches('[')
            .trim_end_matches(']')
            .split(',')
            .map(|s| s.trim().parse::<u8>().unwrap())
            .collect::<Vec<u8>>();
        println!("Your Base58-encoded private key is:");
        let base58 = bs58::encode(wallet).into_string();
        println!("{:?}", base58);
    }

    #[test]
    fn claim_airdrop() {
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");

        let client = RpcClient::new(RPC_URL);
        println!("{:?}", keypair.pubkey());
        match client.request_airdrop(&keypair.pubkey(), 2_000_000_000u64) {
            Ok(sig) => {
                println!("Success! Check your TX here:");
                println!("https://explorer.solana.com/tx/{}?cluster=devnet", sig);
            }
            Err(err) => {
                println!("Airdrop failed: {}", err);
            }
        }
    }
    #[test]
    fn transfer_sol() {
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");
        let pubkey = keypair.pubkey();
        let message_bytes = b"I verify my Solana Keypair!";
        let sig = keypair.sign_message(message_bytes);

        match sig.verify(&pubkey.as_ref(), message_bytes) {
            true => println!("Signature verified"),
            false => println!("Verification failed"),
        }

        let to_pubkey = Pubkey::from_str("BpG1zEBLGfpdoAodsQcpsuCwhnBmQRbPa6UaLmVWfZh5").unwrap();
        let rpc_client = RpcClient::new(RPC_URL);
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");
        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, 1_000_000)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");
        println!("Success! Check out your TX here: https://explorer.solana.com/tx/{}/?cluster=devnet", signature);

        let balance = rpc_client.get_balance(&keypair.pubkey()).expect("Failed to get balance");

        let message = Message::new_with_blockhash(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance)],
            Some(&keypair.pubkey()),
            &recent_blockhash
        );
        let fee = rpc_client.get_fee_for_message(&message).expect("Failed to get fee calculator");

        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance - fee)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send final transaction");
        println!("Success! Entire balance transferred: https://explorer.solana.com/tx/{}/?cluster=devnet", signature);
    }

    #[test]
    fn enroll() {
        let rpc_client = RpcClient::new(RPC_URL);
        let signer = read_keypair_file("Turbin3-wallet.json").expect("Couldn't find wallet file");
        let signer_pubkey = signer.pubkey();
        let message_bytes = b"I verify my Solana Keypair!";
        let sig = signer.sign_message(message_bytes);

        match sig.verify(&signer_pubkey.as_ref(), message_bytes) {
            true => println!("Signature verified"),
            false => println!("Verification failed"),
        }

        let mint = Keypair::new();
        let turbin3_prereq_program = Pubkey::from_str(
            "TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM"
        ).unwrap();
        let collection = Pubkey::from_str("5ebsp5RChCGK7ssRZMVMufgVZhd2kFbNaotcZ5UvytN2").unwrap();
        let mpl_core_program = Pubkey::from_str(
            "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        ).unwrap();
        let system_program = system_program::id();

        let seeds = &[b"prereqs", signer_pubkey.as_ref()];
        let (prereq_pda, _bump) = Pubkey::find_program_address(seeds, &turbin3_prereq_program);

        let seeds = &[b"collection", collection.as_ref()];
        let (authority_pda, _bump) = Pubkey::find_program_address(seeds, &turbin3_prereq_program);

        let data: Vec<u8> = vec![77, 124, 82, 163, 21, 133, 181, 206];

        let accounts = vec![
            AccountMeta::new(signer_pubkey, true), // user signer
            AccountMeta::new(prereq_pda, false), // PDA account
            AccountMeta::new(mint.pubkey(), true), // mint keypair
            AccountMeta::new(collection, false), // collection
            AccountMeta::new_readonly(authority_pda, false), // authority (PDA)
            AccountMeta::new_readonly(mpl_core_program, false), // mpl core program
            AccountMeta::new_readonly(system_program, false) // system program
        ];

        let blockhash = rpc_client.get_latest_blockhash().expect("Failed to get recent blockhash");

        let instruction = Instruction {
            program_id: turbin3_prereq_program,
            accounts,
            data,
        };

        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&signer_pubkey),
            &[&signer, &mint],
            blockhash
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");
        println!("Success! Check out your TX here:\nhttps://explorer.solana.com/tx/{}/?cluster=devnet", signature);
    }
}

// 2B7FP1ejxk4pZ6zPrpUdEEKSc2gNqkkQYwANEpiWPWMg

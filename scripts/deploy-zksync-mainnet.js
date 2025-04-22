// RESKA Token Mainnet Deployment Script for zkSync Era
const { Wallet, Provider } = require('zksync-ethers');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');
const hre = require('hardhat');
const fs = require('fs');
require('dotenv').config();

async function main() {
  console.log('=== RESKA TOKEN DEPLOYMENT TO ZKSYNC ERA MAINNET ===');

  // Initialize zkSync provider
  const provider = new Provider(process.env.ZKSYNC_MAINNET_URL || 'https://mainnet.era.zksync.io');
  console.log(`Connected to zkSync Era Mainnet`);

  // Initialize wallet
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deploying from address: ${wallet.address}`);

  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  const balanceInEth = Number(balance) / 1e18;
  console.log(`Wallet balance: ${balanceInEth.toFixed(4)} ETH`);

  // Verify sufficient balance (at least 0.05 ETH recommended for deployment)
  if (balanceInEth < 0.05) {
    console.error(
      `⚠️ WARNING: Wallet balance is low (${balanceInEth.toFixed(4)} ETH). Deployment may fail.`
    );
    console.error(`Please fund your wallet with at least 0.05 ETH before proceeding.`);

    // Ask for confirmation to continue
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise(resolve => {
      readline.question('Do you want to continue anyway? (y/N): ', resolve);
    });

    readline.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Deployment aborted.');
      process.exit(0);
    }
  }

  // Load allocation addresses from environment variables or use defaults
  const founderAddress = process.env.FOUNDER_ADDRESS || wallet.address;
  const advisorsAddress = process.env.ADVISORS_ADDRESS || wallet.address;
  const investorsAddress = process.env.INVESTORS_ADDRESS || wallet.address;
  const airdropAddress = process.env.AIRDROP_ADDRESS || wallet.address;
  const ecosystemAddress = process.env.ECOSYSTEM_ADDRESS || wallet.address;
  const treasuryAddress = process.env.TREASURY_ADDRESS || wallet.address;
  const publicSaleAddress = process.env.PUBLIC_SALE_ADDRESS || wallet.address;
  const escrowAddress = process.env.ESCROW_ADDRESS || wallet.address;

  console.log('\nToken Allocation Addresses:');
  console.log(`- Founder (10%): ${founderAddress}`);
  console.log(`- Advisors (5%): ${advisorsAddress}`);
  console.log(`- Investors (5%): ${investorsAddress}`);
  console.log(`- Airdrops (40%): ${airdropAddress}`);
  console.log(`- Ecosystem (10%): ${ecosystemAddress}`);
  console.log(`- Treasury (10%): ${treasuryAddress}`);
  console.log(`- Public Sale (10%): ${publicSaleAddress}`);
  console.log(`- Escrow (10%): ${escrowAddress}`);

  // Initialize the deployer
  const deployer = new Deployer(hre, wallet);

  // Load contract artifact
  console.log('\nLoading RESKA Token artifact...');
  const artifact = await deployer.loadArtifact('ReskaToken');

  // Deploy RESKA token with constructor arguments for allocations
  console.log('Deploying RESKA Token contract to zkSync Era Mainnet...');
  console.log('This may take a few minutes. Please wait...');

  const deploymentStartTime = Date.now();

  const token = await deployer.deploy(artifact, [
    founderAddress, // Founder - 10%
    advisorsAddress, // Advisors - 5%
    investorsAddress, // Investors - 5%
    airdropAddress, // Airdrops - 40%
    ecosystemAddress, // Ecosystem - 10%
    treasuryAddress, // Treasury - 10%
    publicSaleAddress, // Public Sale - 10%
    escrowAddress, // Escrow - 10%
  ]);

  const tokenAddress = await token.getAddress();
  const deploymentTime = ((Date.now() - deploymentStartTime) / 1000).toFixed(2);

  console.log(`\n✅ RESKA Token deployed successfully in ${deploymentTime} seconds!`);
  console.log(`Contract address: ${tokenAddress}`);

  // Save the address to a file
  const deploymentData = {
    ReskaToken: tokenAddress,
    network: 'zkSyncMainnet',
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    allocations: {
      founder: founderAddress,
      advisors: advisorsAddress,
      investors: investorsAddress,
      airdrop: airdropAddress,
      ecosystem: ecosystemAddress,
      treasury: treasuryAddress,
      publicSale: publicSaleAddress,
      escrow: escrowAddress,
    },
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync('./deployments')) {
    fs.mkdirSync('./deployments');
  }

  fs.writeFileSync('./deployments/zksync-mainnet.json', JSON.stringify(deploymentData, null, 2));
  console.log('Deployment data saved to deployments/zksync-mainnet.json');

  // Verify contract functionality
  try {
    console.log('\nVerifying contract functionality:');

    const name = await token.name();
    console.log(`- Token name: ${name}`);

    const symbol = await token.symbol();
    console.log(`- Token symbol: ${symbol}`);

    const decimals = await token.decimals();
    console.log(`- Decimals: ${decimals}`);

    const totalSupply = await token.totalSupply();
    console.log(`- Initial supply: ${Number(totalSupply) / 10 ** decimals} ${symbol}`);
  } catch (error) {
    console.log(`Error verifying token: ${error.message}`);
  }

  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log('Your RESKA token is now deployed on zkSync Era Mainnet!');
  console.log(`Add it to MetaMask with address: ${tokenAddress} and 6 decimals`);
  console.log('Token details:');
  console.log('- Name: RESKA');
  console.log('- Symbol: RESKA');
  console.log('- Decimals: 6');
  console.log('- Total Supply: 1,000,000,000 RESKA');
  console.log('\nToken allocations:');
  console.log('- Founder: 10% (100,000,000 RESKA)');
  console.log('- Advisors: 5% (50,000,000 RESKA)');
  console.log('- Investors: 5% (50,000,000 RESKA)');
  console.log('- Airdrops/Rewards: 40% (400,000,000 RESKA)');
  console.log('- Ecosystem Development: 10% (100,000,000 RESKA)');
  console.log('- Treasury Reserve: 10% (100,000,000 RESKA)');
  console.log('- Public Sale/DEX Liquidity: 10% (100,000,000 RESKA)');
  console.log('- Long-Term Escrow: 10% (100,000,000 RESKA)');
  console.log('\nNext steps:');
  console.log('1. Verify your contract on zkSync Explorer');
  console.log('2. Deploy vesting contracts for token allocations');
  console.log('3. Set up token distribution and vesting schedules');
  console.log('4. Add liquidity to DEXes');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Deployment failed:');
    console.error(error);
    process.exit(1);
  });

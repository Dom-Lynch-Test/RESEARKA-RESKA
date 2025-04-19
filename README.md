# RESEARKA Token

RESEARKA Token (symbol: RESKA) is an ERC-20 token with the following features:

- Role-based access control (PAUSER_ROLE, MINTER_ROLE)
- Pausable functionality to halt transfers in emergency situations
- Minting functionality with a cap on additional minting
- Token allocation percentages for various stakeholders
- Future zkSync integration for Layer 2 scaling

## Project Structure

```
reska-token/
├── contracts/
│   └── ReskaToken.sol       # Main token contract
├── scripts/
│   ├── deploy.js            # Main deployment script
│   ├── deploy-local.js      # Local deployment script
│   ├── direct-compile.js    # Direct compilation script
│   └── start-node.js        # Script to start local Hardhat node
├── test/
│   ├── ReskaToken.test.js   # Original test suite
│   └── reskatoken-local.test.js  # Improved test suite
├── artifacts/               # Compiled contract artifacts
├── deployments/             # Deployment information
├── .env.example             # Example environment variables
├── hardhat.config.js        # Hardhat configuration
└── package.json             # Project dependencies
```

## Token Specifications

- **Name**: RESEARKA
- **Symbol**: RESKA
- **Decimals**: 18
- **Initial Supply**: 1,000,000,000 tokens (1 billion)
- **Additional Minting Cap**: 500,000,000 tokens (500 million)

## Token Allocation

The token has the following allocation:
- Founder: 10%
- Advisors: 5%
- Investors: 5%
- Airdrops/Rewards: 40%
- Ecosystem Development: 10%
- Treasury Reserve: 10%
- Public Sale/DEX Liquidity: 10%
- Long-Term Escrow: 10%

## Development

### Prerequisites

- Node.js v18.x or higher
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Dom-Lynch-Test/RESEARKA-RESKA.git
   cd RESEARKA-RESKA
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your specific configuration
   ```bash
   cp .env.example .env
   # Edit .env with your specific values
   ```

### Local Development and Testing

1. Start a local Hardhat node:
   ```bash
   node scripts/start-node.js
   ```

2. Compile the contract:
   ```bash
   npm run compile
   ```

3. Deploy to local node:
   ```bash
   node scripts/deploy-local.js
   ```

4. Run tests:
   ```bash
   npx mocha test/reskatoken-local.test.js
   ```

### Deployment

1. Deploy to Goerli testnet:
   ```bash
   npx hardhat run scripts/deploy.js --network goerli
   ```

2. Deploy to Ethereum mainnet:
   ```bash
   npx hardhat run scripts/deploy.js --network mainnet
   ```

## Future Development

1. **zkSync Integration**:
   - Add zkSync network configurations
   - Adapt deployment scripts for zkSync
   - Test deployment on zkSync testnet

2. **Enhanced Features**:
   - Vesting mechanisms for specific allocations
   - Governance functionality
   - Staking capabilities

## License

MIT

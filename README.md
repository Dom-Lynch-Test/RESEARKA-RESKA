# RESEARKA Token (RESKA)

[![Build Status](https://github.com/Dom-Lynch-Test/RESEARKA-RESKA/actions/workflows/ci.yml/badge.svg)](https://github.com/Dom-Lynch-Test/RESEARKA-RESKA/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Dom-Lynch-Test/RESEARKA-RESKA/branch/main/graph/badge.svg?token=YOUR_CODECOV_TOKEN)](https://codecov.io/gh/Dom-Lynch-Test/RESEARKA-RESKA)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.17-blue.svg)](https://soliditylang.org/)
[![zkSync Ready](https://img.shields.io/badge/zkSync-Ready-brightgreen.svg)](https://zksync.io/)
[![NPM Version](https://img.shields.io/npm/v/your-package-name.svg)](https://www.npmjs.com/package/your-package-name)
[![ESLint](https://img.shields.io/badge/eslint-enabled-brightgreen.svg)](.eslintrc.js)
[![Prettier](https://img.shields.io/badge/prettier-enabled-brightgreen.svg)](.prettierrc)
[![Solhint](https://img.shields.io/badge/solhint-enabled-brightgreen.svg)](.solhint.json)

RESEARKA (RESKA) is an ERC-20 token designed for a decentralized academic publishing platform with future plans for zkSync integration. It aligns incentives across the entire research lifecycle—rewarding authors, reviewers, and the community—while ensuring transparency and efficiency.

## Features

- Standard ERC-20 functionality based on OpenZeppelin contracts.
- Role-based access control (PAUSER_ROLE, MINTER_ROLE) for secure administration.
- Pausable functionality to halt transfers in emergency situations.
- Minting capability with a defined cap on additional token creation.
- Detailed token allocation plan for various stakeholders.
- `ReskaTokenVesting.sol` contract for managing team/advisor token vesting schedules with cliff, gradual release, and revocation.
- Ready for deployment on zkSync Era for Layer 2 scalability.
- Comprehensive CI/CD pipeline using GitHub Actions (`.github/workflows/ci.yml`) for automated linting, testing, and coverage reporting.
- Integrated linting (ESLint, Solhint) and formatting (Prettier) tools.
- Pre-commit hooks (Husky & lint-staged) to enforce code quality standards.
- Standardized GitHub issue and pull request templates.

## Token Specifications

- **Name**: RESEARKA
- **Symbol**: RESKA
- **Decimals**: 18
- **Initial Supply**: 1,000,000,000 tokens (1 billion)
- **Additional Minting Cap**: 500,000,000 tokens (500 million)

## Token Allocation

| Allocation Category       | Percentage |
| ------------------------- | ---------: |
| Founder                   |       10 % |
| Advisors                  |        5 % |
| Investors                 |        5 % |
| Airdrops/Rewards          |       40 % |
| Ecosystem Development     |       10 % |
| Treasury Reserve          |       10 % |
| Public Sale/DEX Liquidity |       10 % |
| Long-Term Escrow          |       10 % |
| **Total**                 |  **100 %** |

## Project Structure

```
reska-token/
├── contracts/
│   ├── ReskaToken.sol           # Main ERC-20 token contract (OpenZeppelin based)
│   └── ReskaTokenVesting.sol    # Token vesting contract
├── scripts/
│   ├── deploy.js                # General deployment script (e.g., for Ethereum)
│   ├── deploy-local.js          # Local Hardhat network deployment script
│   ├── deploy-zksync.js         # zkSync Era deployment script
│   ├── cleanup.js               # Script to clean up artifacts and cache
│   └── start-node.js            # Script to start a local Hardhat node
├── test/
│   ├── reskatoken-local.test.js # Primary test suite for ReskaToken
│   └── reskatokenvesting.test.js # Test suite for ReskaTokenVesting
├── .github/
│   ├── ISSUE_TEMPLATE/          # Issue templates (bug_report.md, feature_request.md)
│   ├── workflows/
│   │   └── ci.yml               # GitHub Actions CI/CD workflow
│   ├── CODE_OF_CONDUCT.md       # Project Code of Conduct
│   ├── CONTRIBUTING.md          # Contributor guidelines
│   └── pull_request_template.md # Pull request template
├── artifacts/                   # Compiled contract artifacts (ignored by git)
├── cache/                     # Hardhat cache (ignored by git)
├── coverage/                  # Test coverage reports (ignored by git)
├── deployments/                 # Stores deployment addresses and info (track in git)
├── .env.example                 # Example environment variables file
├── .eslintrc.js                 # ESLint configuration
├── .gitignore                   # Specifies intentionally untracked files
├── .prettierrc                  # Prettier configuration
├── .solhint.json                # Solhint configuration
├── CHANGELOG.md                 # Record of changes per version
├── hardhat.config.js            # Hardhat configuration file
├── LICENSE                      # MIT License
└── package.json                 # Project metadata and dependencies
```

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
   - Copy `.env.example` to `.env`.
   - **Important**: Fill in your `PRIVATE_KEY`, `INFURA_API_KEY` (or other provider endpoint), and any other necessary variables.
   ```bash
   cp .env.example .env
   nano .env # Or use your preferred editor
   ```

### Local Development and Testing

The project uses Husky and lint-staged to automatically lint and format code before each commit. Ensure you have run `npm install` to set up the hooks.

1. Start a local Hardhat node (optional, for isolated testing):

   ```bash
   npm run node
   ```

2. Compile the contracts:

   ```bash
   npm run compile
   ```

3. Deploy to local node:

   ```bash
   npm run deploy:local
   ```

4. Run tests:

   ```bash
   npm test
   ```

5. Generate test coverage report:

   ```bash
   npm run test:coverage
   ```

6. Lint Solidity and JavaScript code:

   ```bash
   npm run lint
   ```

7. Format code using Prettier:

   ```bash
   npm run format
   ```

8. Clean up build artifacts and cache:
   ```bash
   npm run cleanup
   ```

### Deployment

Deployment scripts output contract addresses and other relevant information to the `deployments/` directory.

1. Deploy to a local Hardhat network:

   ```bash
   npm run deploy:local
   ```

2. Deploy to Goerli testnet (Example, ensure network is configured in `hardhat.config.js`):

   ```bash
   npm run deploy:goerli
   ```

3. Deploy to Ethereum mainnet (Ensure network is configured):

   ```bash
   npm run deploy:mainnet
   ```

4. Deploy to zkSync Testnet (using the dedicated script):

   ```bash
   # Ensure ZKSYNC_NETWORK=testnet and relevant keys are in .env
   npm run deploy:zksync
   ```

5. Deploy to zkSync Mainnet (using the dedicated script):
   ```bash
   # Ensure ZKSYNC_NETWORK=mainnet and relevant keys are in .env
   npm run deploy:zksync
   ```

### Using the Vesting Contract

The `ReskaTokenVesting.sol` contract allows creating time-locked token schedules for beneficiaries. It requires the main `ReskaToken` address during deployment.

**Example (using ethers.js within Hardhat environment):**

1. **Deploy ReskaToken first** (obtain its address, e.g., `reskaTokenAddress`).

2. Deploy the vesting contract, providing the token address:

   ```javascript
   const ReskaTokenVesting = await ethers.getContractFactory('ReskaTokenVesting');
   const vestingContract = await ReskaTokenVesting.deploy(reskaTokenAddress);
   await vestingContract.deployed();
   console.log('Vesting Contract deployed to:', vestingContract.address);
   ```

3. **Transfer tokens** from the ReskaToken deployer (or other holder) to the `vestingContract.address` that will be distributed via vesting schedules.

   ```javascript
   const totalVestingAmount = ethers.utils.parseEther('10000000'); // Example: 10M tokens
   const reskaToken = await ethers.getContractAt('ReskaToken', reskaTokenAddress);
   await reskaToken.transfer(vestingContract.address, totalVestingAmount);
   console.log(
     `Transferred ${ethers.utils.formatEther(totalVestingAmount)} RESKA to vesting contract.`
   );
   ```

4. Create a vesting schedule:

   ```javascript
   const beneficiaryAddress = '0xBeneficiaryAddress...';
   const now = Math.floor(Date.now() / 1000);
   const cliffDuration = 6 * 30 * 24 * 60 * 60; // 6 months
   const totalDuration = 24 * 30 * 24 * 60 * 60; // 24 months
   const slicePeriodSeconds = 30 * 24 * 60 * 60; // 1 month
   const isRevocable = true;
   const amountToVest = ethers.utils.parseEther('1000000'); // 1 million tokens

   await vestingContract.createVestingSchedule(
     beneficiaryAddress,
     now, // Start time (timestamp)
     cliffDuration, // Cliff duration (seconds)
     totalDuration, // Total vesting duration (seconds)
     slicePeriodSeconds, // How often tokens unlock (seconds)
     isRevocable,
     amountToVest
   );
   console.log(`Created vesting schedule for ${beneficiaryAddress}`);
   ```

5. Check releasable amount (can be called by anyone):

   ```javascript
   const scheduleId = await vestingContract.getVestingScheduleIdForHolderAndIndex(
     beneficiaryAddress,
     0
   ); // Assuming first schedule
   const releasableAmount = await vestingContract.computeReleasableAmount(scheduleId);
   console.log(
     `Releasable amount for schedule ${scheduleId}: ${ethers.utils.formatEther(releasableAmount)} RESKA`
   );
   ```

6. Release vested tokens (must be called by the beneficiary):

   ```javascript
   // Connect as the beneficiary
   const beneficiarySigner = await ethers.getSigner(beneficiaryAddress);
   const vestingContractAsBeneficiary = vestingContract.connect(beneficiarySigner);

   // Get the schedule ID (if not known)
   const scheduleId = await vestingContractAsBeneficiary.getVestingScheduleIdForHolderAndIndex(
     beneficiaryAddress,
     0
   );

   await vestingContractAsBeneficiary.release(scheduleId, releasableAmount); // Release the computed amount
   console.log(
     `Released ${ethers.utils.formatEther(releasableAmount)} RESKA for schedule ${scheduleId}`
   );
   ```

7. Revoke a vesting schedule (must be called by the owner/admin of the vesting contract):
   ```javascript
   const scheduleIdToRevoke = '0x...'; // The schedule ID
   await vestingContract.revoke(scheduleIdToRevoke);
   console.log(`Revoked vesting schedule ${scheduleIdToRevoke}`);
   ```

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](.github/CONTRIBUTING.md) and follow our [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

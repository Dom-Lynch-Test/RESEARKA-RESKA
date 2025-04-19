# Changelog

All notable changes to the RESEARKA Token project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- _Add future changes here_

### Changed

### Fixed

## [0.2.0] - 2025-04-20

### Added

- Initial implementation of RESEARKA (RESKA) ERC-20 token (`ReskaToken.sol`).
- Role-based access control with `PAUSER_ROLE` and `MINTER_ROLE`.
- Pausable functionality for emergency stops.
- Minting cap of 500 million additional tokens.
- Allocation tracking logic within the contract (though primarily documented off-chain).
- Comprehensive test suite for token functionality (`reskatoken-local.test.js`).
- Solidity optimizer enabled for gas efficiency.
- Linting and code style enforcement with Solhint, ESLint, and Prettier.
- Pre-commit hooks using Husky and lint-staged to enforce linting/formatting.
- Gas reporting configuration via `hardhat-gas-reporter`.
- Code coverage reporting via `solidity-coverage` and Codecov integration.
- CI/CD pipeline using GitHub Actions (`.github/workflows/ci.yml`) for build, lint, test, and coverage.
- `ReskaTokenVesting.sol` contract for team/advisor vesting with cliff, gradual release, and revocability.
- Test suite for vesting contract functionality (`reskatokenvesting.test.js`).
- Deployment script for zkSync Era (`scripts/deploy-zksync.js`) with deployment info saving.
- Script to clean up build artifacts and cache (`scripts/cleanup.js`).
- Standardized GitHub issue (`bug_report.md`, `feature_request.md`) and pull request (`pull_request_template.md`) templates.
- `CONTRIBUTING.md` outlining contribution guidelines.
- `CODE_OF_CONDUCT.md` to foster a positive community.
- Significantly updated `README.md` with badges, detailed structure, usage examples, and setup instructions.

### Changed

- Updated token name from "RESKA Token" to "RESEARKA".
- Updated token symbol from "RSKA" to "RESKA".
- Refined project structure documentation in README.

### Fixed

- Resolved intermittent EPIPE errors during testing and compilation on some systems.

## [0.1.0] - 2025-04-19

### Added

- Initial project setup with Hardhat.
- Basic ERC-20 contract structure (pre-refinement).

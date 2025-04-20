# RESKA Token Deployment Checklist

## Pre-deployment Requirements

- [ ] Fund deployment wallet (`0xC80a9173EF9562e16671179330351dA74569124B`) with sufficient ETH
  - Testnet: 0.1-0.2 zkSync Era Testnet ETH 
  - Mainnet: ~0.5-1.0 zkSync Era Mainnet ETH
- [ ] Update `.env` file with correct environment variables
  - Check `PRIVATE_KEY` is set correctly
  - Verify all allocation addresses are configured
- [ ] Ensure Multi-sig wallets are set up for:
  - Treasury management
  - Ecosystem fund
  - Long-term escrow

## Deployment Process

1. **Testnet Validation** (Recommended First)
   ```bash
   # Run complete deployment on testnet
   node scripts/deploy-all.js zkSyncTestnet
   ```

2. **Mainnet Deployment**
   ```bash
   # Only after successful testnet validation
   node scripts/deploy-all.js zkSyncMainnet
   ```

## Post-deployment Tasks

- [ ] Verify all contracts on zkSync Explorer
- [ ] Transfer necessary admin roles to the Timelock controller
- [ ] Secure all deployment keys and secrets
- [ ] Document deployed contract addresses

## Security Measures

- Regular monitoring of vesting contract events
- Weekly balance checks for treasury and ecosystem funds
- Implement on-chain alerts for large token movements

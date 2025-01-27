# Compound AgentKit Actions
These actions allow you to supply ETH or USDC to Compound V3 markets on Base.

## Actions
The actions in this package are intended to support agents that want to interact with Compound V3 markets on Base. It supports the following actions:

- `supply`: Supply ETH or USDC to Compound V3 markets on Base.
- `borrow`: Borrow ETH or USDC from Compound V3 markets on Base.
- `repay`: Repay ETH or USDC to Compound V3 markets on Base.
- `withdraw`: Withdraw ETH or USDC from Compound V3 markets on Base.
- `get_portfolio_details`: Get the portfolio details for the Compound V3 markets on Base.

## Supported Compound Markets (aka. Comets)

### Base
- USDC Comet 
  - Supply Assets: USDC, WETH, cbBTC, cbETH, wstETH
  - Borrow Asset: USDC

### Base Sepolia
- USDC Comet 
  - Supply Assets: USDC, WETH
  - Borrow Asset: USDC

## Limitations and Assumptions
- Only supports the default wallet (i.e., `wallet.default_address`).
- Only supports one Comet contract, the Base/Base Sepolia USDC Comet 
- The only borrowable asset is USDC as a result of the above.
- Native ETH is not supported, supply must be done with Wrapped ETH (WETH). 
- The `approve` transaction needed for `supply` and `repay` is included in the action.
- The amounts sent to these actions are _whole units_ of the asset (e.g., 0.01 ETH, 100 USDC).
- Token symbols are the `asset_id` (lowercase) rather than the symbol. There's currently no way to get the symbol from the cdp `Asset` model object.

## Funded by Compound Grants Program
Compound Actions for AgentKit is funded by the Compound Grants Program. Learn more about the Grant on Questbook [here](https://new.questbook.app/dashboard/?role=builder&chainId=10&proposalId=678c218180bdbe26619c3ae8&grantId=66f29bb58868f5130abc054d).

## Future Work
- [ ] Support for bulk actions that perform common operations like leverage, deleverage, swap collateral, etc.
- [ ] Add `symbol` to the `Asset` model in the Coinbase CDP SDK, a correctly cased version of the `asset_id`.
- [ ] Add Compound Base Sepolia cbETH Comet to support on Base Sepolia testnet CDP API.
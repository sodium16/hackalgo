# Algo-Mint Smart Contract ABI (ARC-4 / ARC-19)

## Global State (read-only)
- `creator`: address – the person who minted the NFTs
- `total_nfts`: uint64 – number of NFTs minted (e.g., 10)
- `total_pct_bps`: uint64 – total % of earnings offered, in basis points (e.g., 500 = 5%)
- `duration_years`: uint64 – contract active years (e.g., 3)
- `start_quarter`: uint64 – quarter index when contract started (e.g., 20261)

## Methods

### mint_future_nft(axfer: pay) -> void
- Called by creator only, once.
- Sends ALGO to cover minimum balance requirement.
- Mints the entire series of NFTs (ARC-19) with metadata URI.

### buy_nft(asset_id: uint64, axfer: pay) -> void
- Investor calls this to purchase a specific NFT.
- Payment is forwarded to the creator’s address.
- Transfers the NFT from creator to investor.

### report_income(quarter: uint64, income_amount: uint64) -> void
- Called by creator only, once per quarter.
- `income_amount` in microAlgos or stablecoin units (we’ll use microAlgos for demo).
- Computes `payout_per_nft = (income_amount * pct_per_nft_bps) / 10000`
- Stores the total pending payout for each NFT holder.

### claim_payout(asset_id: uint64) -> void
- Any NFT holder can call to claim their accumulated payouts.
- Transfers ALGO from contract account to caller.

### get_pending_payout(asset_id: uint64, address: address) -> uint64
- Read-only view method to check how much is claimable.
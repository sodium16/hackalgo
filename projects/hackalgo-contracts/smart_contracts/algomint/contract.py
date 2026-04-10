from algopy import Account, ARC4Contract, Asset, BoxMap, Global, GlobalState, Txn, UInt64, arc4, gtxn, itxn, op, urange


class Algomint(ARC4Contract):
    def __init__(self) -> None:
        # Campaign configuration and accounting state.
        self.creator = GlobalState(Account)
        self.total_nfts = GlobalState(UInt64(0))
        self.total_pct_bps = GlobalState(UInt64(0))
        self.duration_years = GlobalState(UInt64(0))
        self.start_quarter = GlobalState(UInt64(0))
        self.sale_price = GlobalState(UInt64(0))
        self.first_asset_id = GlobalState(UInt64(0))
        self.pct_per_nft_bps = GlobalState(UInt64(0))
        self.last_reported_quarter = GlobalState(UInt64(0))
        self.last_reported_income = GlobalState(UInt64(0))
        self.payout_per_nft = GlobalState(UInt64(0))
        self.initialized = GlobalState(False)

        # Per-asset claim checkpoint: asset_id -> last claimed quarter.
        self.last_claimed_quarter = BoxMap(UInt64, UInt64, key_prefix="lc_")
        # Registry of assets minted by this contract: asset_id -> 1.
        self.minted_assets = BoxMap(UInt64, UInt64, key_prefix="ma_")

    @arc4.abimethod
    def mint_future_nft(
        self,
        total_nfts: UInt64,
        total_pct_bps: UInt64,
        duration_years: UInt64,
        start_quarter: UInt64,
        sale_price: UInt64,
        mbr_payment: gtxn.PaymentTransaction,
    ) -> None:
        assert not self.initialized.value
        assert total_nfts > UInt64(0)
        assert total_pct_bps > UInt64(0)
        assert total_pct_bps <= UInt64(10_000)
        assert duration_years > UInt64(0)
        assert start_quarter > UInt64(0)
        assert sale_price > UInt64(0)

        assert mbr_payment.sender == Txn.sender
        assert mbr_payment.receiver == Global.current_application_address
        # NOTE: Exact MBR depends on protocol params; require a sensible minimum for demo.
        assert mbr_payment.amount >= UInt64(1_000_000)

        self.creator.value = Txn.sender
        self.total_nfts.value = total_nfts
        self.total_pct_bps.value = total_pct_bps
        self.duration_years.value = duration_years
        self.start_quarter.value = start_quarter
        self.sale_price.value = sale_price
        self.pct_per_nft_bps.value = self.total_pct_bps.value // self.total_nfts.value
        self.initialized.value = True

        # Mint a fixed series of ARC-19 style NFTs from the app account.
        for idx in urange(total_nfts):
            created = itxn.AssetConfig(
                total=1,
                decimals=0,
                default_frozen=False,
                asset_name=b"Future Earning NFT",
                unit_name=b"FENFT",
                # ARC-19 template URL (CID sourced from reserve account by clients).
                url=b"template-ipfs://{ipfscid:1:raw:reserve:sha2-256}",
                manager=Global.current_application_address,
                reserve=Global.current_application_address,
                fee=0,
            ).submit()
            if idx == UInt64(0):
                self.first_asset_id.value = created.created_asset.id
            self.minted_assets[created.created_asset.id] = UInt64(1)

    @arc4.abimethod
    def buy_nft(
        self,
        asset_id: UInt64,
        opt_in: gtxn.AssetTransferTransaction,
        payment: gtxn.PaymentTransaction,
    ) -> None:
        assert self.initialized.value
        assert asset_id > UInt64(0)
        assert self.minted_assets.get(asset_id, default=UInt64(0)) == UInt64(1)

        asset = Asset(asset_id)

        # Ensure buyer has opted-in in the same group.
        assert opt_in.sender == Txn.sender
        assert opt_in.asset_receiver == Txn.sender
        assert opt_in.xfer_asset.id == asset.id
        assert opt_in.asset_amount == UInt64(0)

        assert payment.sender == Txn.sender
        assert payment.receiver == Global.current_application_address
        assert payment.amount == self.sale_price.value

        app_balance, app_opted = op.AssetHoldingGet.asset_balance(Global.current_application_address, asset)
        assert app_opted
        assert app_balance == UInt64(1)

        # Transfer NFT to investor and forward payment to creator.
        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
            fee=0,
        ).submit()
        itxn.Payment(
            receiver=self.creator.value,
            amount=payment.amount,
            fee=0,
        ).submit()

    @arc4.abimethod
    def report_income(
        self, quarter: UInt64, income_amount: UInt64, payout_funding: gtxn.PaymentTransaction
    ) -> None:
        assert self.initialized.value
        assert Txn.sender == self.creator.value
        assert quarter > self.last_reported_quarter.value
        assert income_amount > UInt64(0)

        total_payout = (income_amount * self.total_pct_bps.value) // UInt64(10_000)
        assert total_payout > UInt64(0)

        # Require the creator to fund the app for this quarter's payouts.
        assert payout_funding.sender == Txn.sender
        assert payout_funding.receiver == Global.current_application_address
        assert payout_funding.amount == total_payout

        self.last_reported_quarter.value = quarter
        self.last_reported_income.value = income_amount
        self.payout_per_nft.value = total_payout // self.total_nfts.value

    @arc4.abimethod
    def claim_payout(self, asset_id: UInt64) -> None:
        assert self.initialized.value
        assert asset_id > UInt64(0)
        assert self.minted_assets.get(asset_id, default=UInt64(0)) == UInt64(1)
        assert self.last_reported_quarter.value > UInt64(0)

        holder_balance, holder_opted = op.AssetHoldingGet.asset_balance(Txn.sender, Asset(asset_id))
        assert holder_opted
        assert holder_balance == UInt64(1)

        claimed = self.last_claimed_quarter.get(asset_id, default=UInt64(0))
        assert claimed < self.last_reported_quarter.value
        assert self.payout_per_nft.value > UInt64(0)

        itxn.Payment(
            amount=self.payout_per_nft.value,
            receiver=Txn.sender,
            fee=0,
        ).submit()

        self.last_claimed_quarter[asset_id] = self.last_reported_quarter.value

    @arc4.abimethod(readonly=True)
    def get_pending_payout(self, asset_id: UInt64, address: Account) -> UInt64:
        assert self.initialized.value
        assert asset_id > UInt64(0)
        assert self.minted_assets.get(asset_id, default=UInt64(0)) == UInt64(1)
        assert address != Global.zero_address

        if self.last_reported_quarter.value == UInt64(0):
            return UInt64(0)

        holder_balance, holder_opted = op.AssetHoldingGet.asset_balance(address, Asset(asset_id))
        if not holder_opted:
            return UInt64(0)
        if holder_balance != UInt64(1):
            return UInt64(0)

        claimed = self.last_claimed_quarter.get(asset_id, default=UInt64(0))
        if claimed < self.last_reported_quarter.value:
            return self.payout_per_nft.value
        return UInt64(0)

    @arc4.abimethod(readonly=True)
    def get_terms(self) -> tuple[Account, UInt64, UInt64, UInt64, UInt64, UInt64, UInt64]:
        """
        Returns: (creator, total_nfts, total_pct_bps, duration_years, start_quarter, sale_price, first_asset_id)
        """
        # Must be safe to call before minting/initialization (UI calls this after deploy).
        # Return zero/default values until initialized.
        if not self.initialized.value:
            return (
                Global.zero_address,
                UInt64(0),
                UInt64(0),
                UInt64(0),
                UInt64(0),
                UInt64(0),
                UInt64(0),
            )
        return (
            self.creator.value,
            self.total_nfts.value,
            self.total_pct_bps.value,
            self.duration_years.value,
            self.start_quarter.value,
            self.sale_price.value,
            self.first_asset_id.value,
        )

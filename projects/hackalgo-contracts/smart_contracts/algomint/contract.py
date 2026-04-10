from algopy import Account, ARC4Contract, Asset, BoxMap, Global, GlobalState, Txn, UInt64, arc4, gtxn, itxn, op, urange


class Algomint(ARC4Contract):
    def __init__(self) -> None:
        # Campaign configuration and accounting state.
        self.creator = GlobalState(Account)
        self.total_nfts = GlobalState(UInt64(0))
        self.total_pct_bps = GlobalState(UInt64(0))
        self.duration_years = GlobalState(UInt64(0))
        self.start_quarter = GlobalState(UInt64(0))
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
    def mint_future_nft(self, axfer: gtxn.PaymentTransaction) -> None:
        assert not self.initialized.value
        assert axfer.sender == Txn.sender
        assert axfer.receiver == Global.current_application_address
        assert axfer.amount >= UInt64(200_000)

        self.creator.value = Txn.sender
        self.total_nfts.value = UInt64(10)
        self.total_pct_bps.value = UInt64(500)
        self.duration_years.value = UInt64(3)
        self.start_quarter.value = UInt64(20261)
        self.pct_per_nft_bps.value = self.total_pct_bps.value // self.total_nfts.value
        self.initialized.value = True

        # Mint a fixed series of ARC-19 style NFTs from the app account.
        for _idx in urange(10):
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
            self.minted_assets[created.created_asset.id] = UInt64(1)

    @arc4.abimethod
    def buy_nft(self, asset_id: UInt64, axfer: gtxn.PaymentTransaction) -> None:
        assert self.initialized.value
        assert asset_id > UInt64(0)
        assert self.minted_assets.get(asset_id, default=UInt64(0)) == UInt64(1)
        assert axfer.sender == Txn.sender
        assert axfer.amount > UInt64(0)
        assert axfer.receiver == Global.current_application_address

        asset = Asset(asset_id)
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
            amount=axfer.amount,
            fee=0,
        ).submit()

    @arc4.abimethod
    def report_income(self, quarter: UInt64, income_amount: UInt64) -> None:
        assert self.initialized.value
        assert Txn.sender == self.creator.value
        assert quarter > self.last_reported_quarter.value

        self.last_reported_quarter.value = quarter
        self.last_reported_income.value = income_amount
        self.payout_per_nft.value = (income_amount * self.pct_per_nft_bps.value) // UInt64(10_000)

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

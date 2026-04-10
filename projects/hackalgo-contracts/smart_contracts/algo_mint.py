from algopy import Account, Box, GlobalState, Txn, UInt64, arc4, gtxn, itxn


class AlgoMint(arc4.ARC4Contract):
    """
    Demo contract for "future earnings" payout claims.

    Notes (demo constraints):
    - This contract does not implement full ARC-19/ARC-69 NFT metadata.
    - It uses a pull-based distribution: creator reports quarterly income, holders claim.
    - For hackathon simplicity, "ownership" is represented by having called `buy_nft` once.
    """

    def __init__(self) -> None:
        self.creator = GlobalState(Account, key="creator")
        self.total_nfts = GlobalState(UInt64(0), key="total_nfts")
        self.total_pct_bps = GlobalState(UInt64(0), key="total_pct_bps")
        self.duration_years = GlobalState(UInt64(0), key="duration_years")
        self.start_quarter = GlobalState(UInt64(0), key="start_quarter")

    @arc4.abimethod
    def mint_future_nft(
        self,
        total_nfts: UInt64,
        total_pct_bps: UInt64,
        duration_years: UInt64,
        axfer: gtxn.PaymentTransaction,
    ) -> None:
        creator, exists = self.creator.maybe()
        assert not exists

        self.creator.value = Txn.sender
        assert axfer.sender == Txn.sender
        assert axfer.amount > 0
        assert total_nfts > 0
        assert total_pct_bps > 0
        assert total_pct_bps <= 10_000
        assert duration_years > 0

        self.total_nfts.value = total_nfts
        self.total_pct_bps.value = total_pct_bps
        self.duration_years.value = duration_years
        self.start_quarter.value = UInt64(0)


    @arc4.abimethod
    def buy_nft(self, asset_id: UInt64, axfer: gtxn.PaymentTransaction) -> None:
        creator, creator_exists = self.creator.maybe()
        assert creator_exists
        assert asset_id > 0
        assert asset_id <= self.total_nfts.value

        assert axfer.sender == Txn.sender
        assert axfer.amount > 0

        owner_box = Box(Account, key=b"own_" + arc4.UInt64(asset_id).bytes)
        if owner_box:
            assert owner_box.value == creator

        itxn.Payment(receiver=creator, amount=axfer.amount, fee=0).submit()
        owner_box.value = Txn.sender

    @arc4.abimethod
    def report_income(self, quarter: UInt64, income_amount: UInt64) -> None:
        creator, creator_exists = self.creator.maybe()
        assert creator_exists
        assert Txn.sender == creator
        assert quarter > self.start_quarter.value
        assert income_amount > 0

        total_payout = (income_amount * self.total_pct_bps.value) // UInt64(10_000)
        payout_per_nft = total_payout // self.total_nfts.value
        per_q_box = Box(UInt64, key=b"q_" + arc4.UInt64(quarter).bytes)
        per_q_box.value = payout_per_nft
        self.start_quarter.value = quarter

    @arc4.abimethod
    def claim_payout(self, asset_id: UInt64) -> None:
        assert asset_id > 0
        assert asset_id <= self.total_nfts.value

        owner_box = Box(Account, key=b"own_" + arc4.UInt64(asset_id).bytes)
        if owner_box:
            assert owner_box.value == Txn.sender
        else:
            assert Txn.sender == self.creator.value
        pending = self.get_pending_payout(asset_id, Txn.sender)
        assert pending > 0

        itxn.Payment(receiver=Txn.sender, amount=pending, fee=0).submit()

        last_claimed = Box(UInt64, key=b"lc_" + arc4.UInt64(asset_id).bytes)
        last_claimed.value = self.start_quarter.value

    @arc4.abimethod
    def get_pending_payout(self, asset_id: UInt64, address: Account) -> UInt64:
        assert asset_id > 0
        assert asset_id <= self.total_nfts.value

        owner_box = Box(Account, key=b"own_" + arc4.UInt64(asset_id).bytes)
        if owner_box:
            if owner_box.value != address:
                return UInt64(0)
        elif self.creator.value != address:
            return UInt64(0)

        last_claimed_box = Box(UInt64, key=b"lc_" + arc4.UInt64(asset_id).bytes)
        last_claimed = UInt64(0)
        if last_claimed_box:
            last_claimed = last_claimed_box.value
        latest = self.start_quarter.value
        if latest <= last_claimed:
            return UInt64(0)

        pending = UInt64(0)
        q = last_claimed + UInt64(1)
        while q <= latest:
            per_q_box = Box(UInt64, key=b"q_" + arc4.UInt64(q).bytes)
            if per_q_box:
                pending = pending + per_q_box.value
            q = q + UInt64(1)

        return pending

from algopy import Account, Box, GlobalState, LocalState, Txn, UInt64, arc4, gtxn, itxn


class AlgoMint(arc4.ARC4Contract):
    """
    Demo contract for "future earnings" payout claims.

    Notes (demo constraints):
    - This contract does not implement full ARC-19/ARC-69 NFT metadata.
    - It uses a pull-based distribution: creator reports quarterly income, holders claim.
    - For hackathon simplicity, "ownership" is represented by having called `buy_nft` once.
    """

    def __init__(self) -> None:
        # Global state
        self.creator = GlobalState(Account, key="creator")
        self.total_nfts = GlobalState(UInt64(0), key="total_nfts")
        self.total_pct_bps = GlobalState(UInt64(0), key="total_pct_bps")
        self.duration_years = GlobalState(UInt64(0), key="duration_years")
        # Interpreted as "latest reported quarter" for monotonic enforcement
        self.start_quarter = GlobalState(UInt64(0), key="start_quarter")

        # Local state (simplified for demo)
        # payout_pending: cached pending amount for a holder (updated on claim)
        self.payout_pending = LocalState(UInt64, key="payout_pending")
        # last_claimed_quarter: used to compute pending payouts
        self.last_claimed_quarter = LocalState(UInt64, key="last_claimed_q")
        # has_position: marker that an account is eligible to claim
        self.has_position = LocalState(UInt64, key="has_pos")

    @arc4.abimethod
    def mint_future_nft(self, axfer: gtxn.PaymentTransaction) -> None:
        # Only creator can mint; first call sets creator.
        creator, exists = self.creator.maybe()
        if exists:
            assert Txn.sender == creator
        else:
            self.creator.value = Txn.sender

        # Basic group sanity (demo): payment must be from creator.
        assert axfer.sender == Txn.sender
        assert axfer.amount > 0

        # Demo defaults if not set (hackathon example: 10 NFTs, 5% over 3 years).
        if self.total_nfts.value == 0:
            self.total_nfts.value = UInt64(10)
        if self.total_pct_bps.value == 0:
            self.total_pct_bps.value = UInt64(500)  # 5.00%
        if self.duration_years.value == 0:
            self.duration_years.value = UInt64(3)

    @arc4.abimethod
    def buy_nft(self, asset_id: UInt64, axfer: gtxn.PaymentTransaction) -> None:
        # NFT must exist (demo check: non-zero ID and creator initialized)
        creator_value, creator_exists = self.creator.maybe()
        assert creator_exists
        assert asset_id != UInt64(0)

        # Payment must be from buyer.
        assert axfer.sender == Txn.sender
        assert axfer.amount > 0

        # Forward payment to creator (demo: assumes ALGO payments).
        itxn.Payment(receiver=creator_value, amount=axfer.amount).submit()

        # Mark buyer as eligible holder (demo: assumes 1 NFT per account).
        self.has_position[Txn.sender] = UInt64(1)
        if Txn.sender not in self.last_claimed_quarter:
            self.last_claimed_quarter[Txn.sender] = UInt64(0)
        if Txn.sender not in self.payout_pending:
            self.payout_pending[Txn.sender] = UInt64(0)

    @arc4.abimethod
    def report_income(self, quarter: UInt64, income_amount: UInt64) -> None:
        # Only creator can report.
        creator, creator_exists = self.creator.maybe()
        assert creator_exists
        assert Txn.sender == creator

        # Quarter must increase.
        assert quarter > self.start_quarter.value

        # Persist income report for this quarter in a box.
        report_box = Box(UInt64, key=b"inc_" + arc4.UInt64(quarter).bytes)
        report_box.value = income_amount

        # Track latest reported quarter.
        self.start_quarter.value = quarter

    @arc4.abimethod
    def claim_payout(self, asset_id: UInt64) -> None:
        # NFT must exist (demo check)
        assert asset_id != UInt64(0)
        creator_value, creator_exists = self.creator.maybe()
        assert creator_exists

        # Must have bought at least once to be eligible.
        assert self.has_position.get(Txn.sender, default=UInt64(0)) == 1

        pending = self.get_pending_payout(asset_id, Txn.sender)
        assert pending > 0

        # Pay from app account balance.
        itxn.Payment(
            receiver=Txn.sender,
            amount=pending,
        ).submit()

        # Update local state to reflect claim up to latest quarter.
        self.last_claimed_quarter[Txn.sender] = self.start_quarter.value
        self.payout_pending[Txn.sender] = UInt64(0)

    @arc4.abimethod
    def get_pending_payout(self, asset_id: UInt64, address: Account) -> UInt64:
        # asset_id exists (demo check)
        assert asset_id != UInt64(0)
        creator_value, creator_exists = self.creator.maybe()
        assert creator_exists

        # Not a holder -> no pending
        if self.has_position.get(address, default=UInt64(0)) != 1:
            return UInt64(0)

        last_claimed = self.last_claimed_quarter.get(address, default=UInt64(0))
        latest = self.start_quarter.value
        if latest <= last_claimed:
            return UInt64(0)

        # Demo computes pending only for the latest quarter (sufficient for the hackathon flow).
        # If you later want multi-quarter accumulation, sum over (last_claimed+1..latest) boxes.
        income_box = Box(UInt64, key=b"inc_" + arc4.UInt64(latest).bytes)
        if not income_box:
            return UInt64(0)

        income_amount = income_box.value

        # total_payout = income_amount * total_pct_bps / 10000
        total_payout = (income_amount * self.total_pct_bps.value) // UInt64(10_000)
        # per_nft = total_payout / total_nfts
        if self.total_nfts.value == 0:
            return UInt64(0)
        per_nft = total_payout // self.total_nfts.value

        return per_nft

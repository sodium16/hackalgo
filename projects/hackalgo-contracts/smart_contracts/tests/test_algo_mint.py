from __future__ import annotations

from collections.abc import Iterator

import pytest
from algopy import Application, UInt64
from algopy_testing import AlgopyTestContext, algopy_testing_context

from smart_contracts.algo_mint import AlgoMint


@pytest.fixture()
def context() -> Iterator[AlgopyTestContext]:
    with algopy_testing_context() as ctx:
        yield ctx


def test_mint_buy_report_and_claim_flow(context: AlgopyTestContext) -> None:
    creator = context.any.account()
    investor = context.any.account()

    contract = AlgoMint()

    # Creator mints/configures (demo defaults: 10 NFTs, 5%).
    pay_mint = context.any.txn.payment(
        sender=creator, receiver=context.any.account(), amount=UInt64(1_000_000)
    )
    mint_call = context.txn.defer_app_call(contract.mint_future_nft, axfer=pay_mint)
    for txn in mint_call._txns:  # type: ignore[attr-defined]
        txn.fields["sender"] = creator
    with context.txn.create_group(mint_call._txns):  # type: ignore[arg-type, attr-defined]
        mint_call.submit()

    # Investor buys one NFT (asset_id is a demo identifier).
    asset_id = UInt64(123)
    pay_buy = context.any.txn.payment(
        sender=investor, receiver=context.any.account(), amount=UInt64(2_000_000)
    )
    buy_call = context.txn.defer_app_call(contract.buy_nft, asset_id=asset_id, axfer=pay_buy)
    for txn in buy_call._txns:  # type: ignore[attr-defined]
        txn.fields["sender"] = investor
    with context.txn.create_group(buy_call._txns):  # type: ignore[arg-type, attr-defined]
        buy_call.submit()

    # Creator reports quarterly income: income=10,000 => total payout=500 => per NFT=50.
    report_call = context.txn.defer_app_call(
        contract.report_income, quarter=UInt64(1), income_amount=UInt64(10_000)
    )
    for txn in report_call._txns:  # type: ignore[attr-defined]
        txn.fields["sender"] = creator
    with context.txn.create_group(report_call._txns):  # type: ignore[arg-type, attr-defined]
        report_call.submit()

    pending = contract.get_pending_payout(asset_id, investor)
    assert pending == UInt64(50)

    # Fund app so it can pay (claim is a payment from app account).
    # In unit tests, we can just ensure the app has enough Algo to cover the claim.
    app_address = Application(contract.__app_id__).address
    context.ledger.update_account(app_address, balance=1_000_000)

    claim_call = context.txn.defer_app_call(contract.claim_payout, asset_id=asset_id)
    for txn in claim_call._txns:  # type: ignore[attr-defined]
        txn.fields["sender"] = investor
    with context.txn.create_group(claim_call._txns):  # type: ignore[arg-type, attr-defined]
        claim_call.submit()

    pending_after = contract.get_pending_payout(asset_id, investor)
    assert pending_after == UInt64(0)

from __future__ import annotations

import algokit_utils

try:
    from scripts._common import (
        BUY_METHOD,
        BUY_NFT_PAYMENT_MICROALGOS,
        CLAIM_METHOD,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        MINT_MBR_FUNDING_MICROALGOS,
        MINT_METHOD,
        PENDING_METHOD,
        REPORT_METHOD,
        deploy_or_update_app,
        get_algorand,
        get_creator,
        get_investor,
        make_payment_arg,
    )
except ModuleNotFoundError:
    from _common import (
        BUY_METHOD,
        BUY_NFT_PAYMENT_MICROALGOS,
        CLAIM_METHOD,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        MINT_MBR_FUNDING_MICROALGOS,
        MINT_METHOD,
        PENDING_METHOD,
        REPORT_METHOD,
        deploy_or_update_app,
        get_algorand,
        get_creator,
        get_investor,
        make_payment_arg,
    )


def main() -> None:
    algorand = get_algorand()
    creator = get_creator(algorand)
    investor = get_investor(algorand)

    deployed = deploy_or_update_app(algorand, creator)
    creator_client = algorand.client.get_app_client_by_id(
        app_spec=deployed.app_spec_path.read_text(encoding="utf-8"),
        app_id=deployed.app_id,
        default_sender=creator.address,
    )
    investor_client = algorand.client.get_app_client_by_id(
        app_spec=deployed.app_spec_path.read_text(encoding="utf-8"),
        app_id=deployed.app_id,
        default_sender=investor.address,
    )

    mint_payment = make_payment_arg(
        algorand=algorand,
        sender=creator,
        receiver=deployed.app_address,
        amount_microalgos=MINT_MBR_FUNDING_MICROALGOS,
    )
    creator_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=MINT_METHOD,
            args=[10, 500, 3, mint_payment],
        )
    )
    first_asset_id = 1

    buy_payment = make_payment_arg(
        algorand=algorand,
        sender=investor,
        receiver=deployed.app_address,
        amount_microalgos=BUY_NFT_PAYMENT_MICROALGOS,
    )
    investor_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=BUY_METHOD,
            args=[first_asset_id, buy_payment],
            extra_fee=algokit_utils.AlgoAmount.from_micro_algo(
                INNER_TXN_EXTRA_FEE_MICROALGOS
            ),
        )
    )

    creator_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=REPORT_METHOD,
            args=[1, 10000_0000],
        )
    )

    pending_result = investor_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=PENDING_METHOD,
            args=[first_asset_id, investor.address],
        )
    )
    print(f"Pending payout before claim: {pending_result.abi_return} microAlgos")

    before_balance = algorand.account.get_information(investor.address).amount
    investor_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=CLAIM_METHOD,
            args=[first_asset_id],
            extra_fee=algokit_utils.AlgoAmount.from_micro_algo(
                INNER_TXN_EXTRA_FEE_MICROALGOS
            ),
        )
    )
    after_balance = algorand.account.get_information(investor.address).amount

    print(f"Demo completed for app_id={deployed.app_id}, asset_id={first_asset_id}")
    print(f"Investor balance before claim: {before_balance}")
    print(f"Investor balance after claim:  {after_balance}")
    print(f"Balance delta (microAlgos):    {after_balance - before_balance}")


if __name__ == "__main__":
    main()

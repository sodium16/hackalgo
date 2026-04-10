from __future__ import annotations

import algokit_utils

try:
    from scripts._common import (
        CONTRACT_TOPUP_MICROALGOS,
        MINT_MBR_FUNDING_MICROALGOS,
        MINT_METHOD,
        deploy_or_update_app,
        get_algorand,
        get_creator,
        make_payment_arg,
    )
except ModuleNotFoundError:
    from _common import (
    CONTRACT_TOPUP_MICROALGOS,
    MINT_MBR_FUNDING_MICROALGOS,
    MINT_METHOD,
    deploy_or_update_app,
    get_algorand,
    get_creator,
    make_payment_arg,
    )


def main() -> None:
    algorand = get_algorand()
    creator = get_creator(algorand)
    deployed = deploy_or_update_app(algorand, creator)
    app_client = algorand.client.get_app_client_by_id(
        app_spec=deployed.app_spec_path.read_text(encoding="utf-8"),
        app_id=deployed.app_id,
        default_sender=creator.address,
    )

    # Ensure contract has enough liquidity for payout claims in demo flow.
    algorand.send.payment(
        algokit_utils.PaymentParams(
            sender=creator.address,
            receiver=deployed.app_address,
            amount=algokit_utils.AlgoAmount.from_micro_algo(CONTRACT_TOPUP_MICROALGOS),
        )
    )

    mbr_payment = make_payment_arg(
        algorand=algorand,
        sender=creator,
        receiver=deployed.app_address,
        amount_microalgos=MINT_MBR_FUNDING_MICROALGOS,
    )
    app_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=MINT_METHOD,
            args=[10, 500, 3, mbr_payment],
        )
    )

    print("Deployment and mint completed.")
    print(f"app_id={deployed.app_id}")
    print(f"app_address={deployed.app_address}")


if __name__ == "__main__":
    main()

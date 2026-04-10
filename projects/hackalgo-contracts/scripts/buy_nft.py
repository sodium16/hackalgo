from __future__ import annotations

import argparse

import algokit_utils

try:
    from scripts._common import (
        BUY_METHOD,
        BUY_NFT_PAYMENT_MICROALGOS,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        get_algorand,
        get_app_client,
        get_investor,
        load_state,
        make_payment_arg,
    )
except ModuleNotFoundError:
    from _common import (
        BUY_METHOD,
        BUY_NFT_PAYMENT_MICROALGOS,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        get_algorand,
        get_app_client,
        get_investor,
        load_state,
        make_payment_arg,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Buy an NFT as investor.")
    parser.add_argument("asset_id", type=int, help="Asset ID of NFT to buy")
    args = parser.parse_args()

    algorand = get_algorand()
    investor = get_investor(algorand)
    state = load_state()
    app_id = int(state["app_id"])
    app_client = get_app_client(algorand=algorand, app_id=app_id, sender=investor)

    buy_payment = make_payment_arg(
        algorand=algorand,
        sender=investor,
        receiver=app_client.app_address,
        amount_microalgos=BUY_NFT_PAYMENT_MICROALGOS,
    )
    app_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=BUY_METHOD,
            args=[args.asset_id, buy_payment],
            asset_references=[args.asset_id],
            extra_fee=algokit_utils.AlgoAmount.from_micro_algo(
                INNER_TXN_EXTRA_FEE_MICROALGOS
            ),
        )
    )

    print(f"Bought NFT asset_id={args.asset_id} from app_id={app_id}")


if __name__ == "__main__":
    main()

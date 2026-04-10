from __future__ import annotations

import argparse

import algokit_utils

try:
    from scripts._common import (
        CLAIM_METHOD,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        get_algorand,
        get_app_client,
        get_investor,
        load_state,
    )
except ModuleNotFoundError:
    from _common import (
        CLAIM_METHOD,
        INNER_TXN_EXTRA_FEE_MICROALGOS,
        get_algorand,
        get_app_client,
        get_investor,
        load_state,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Claim NFT payout as investor.")
    parser.add_argument("asset_id", type=int, help="Asset ID to claim payout for")
    args = parser.parse_args()

    algorand = get_algorand()
    investor = get_investor(algorand)
    state = load_state()
    app_id = int(state["app_id"])
    app_client = get_app_client(algorand=algorand, app_id=app_id, sender=investor)

    app_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=CLAIM_METHOD,
            args=[args.asset_id],
            asset_references=[args.asset_id],
            extra_fee=algokit_utils.AlgoAmount.from_micro_algo(
                INNER_TXN_EXTRA_FEE_MICROALGOS
            ),
        )
    )

    print(f"Claimed payout for asset_id={args.asset_id} on app_id={app_id}")


if __name__ == "__main__":
    main()

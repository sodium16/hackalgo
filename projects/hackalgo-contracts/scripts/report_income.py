from __future__ import annotations

import argparse

import algokit_utils

try:
    from scripts._common import (
        REPORT_METHOD,
        get_algorand,
        get_app_client,
        get_creator,
        load_state,
    )
except ModuleNotFoundError:
    from _common import REPORT_METHOD, get_algorand, get_app_client, get_creator, load_state


def main() -> None:
    parser = argparse.ArgumentParser(description="Report quarterly income as creator.")
    parser.add_argument("quarter", type=int, help="Quarter index")
    parser.add_argument("income_amount", type=int, help="Income amount in microAlgos")
    args = parser.parse_args()

    algorand = get_algorand()
    creator = get_creator(algorand)
    state = load_state()
    app_id = int(state["app_id"])
    app_client = get_app_client(algorand=algorand, app_id=app_id, sender=creator)

    app_client.send.call(
        algokit_utils.AppClientMethodCallParams(
            method=REPORT_METHOD,
            args=[args.quarter, args.income_amount],
        )
    )

    print(
        f"Reported income for app_id={app_id}: "
        f"quarter={args.quarter}, income_amount={args.income_amount}"
    )


if __name__ == "__main__":
    main()

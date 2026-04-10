from __future__ import annotations

import json
import os
from pathlib import Path

from algosdk.encoding import is_valid_address
from algosdk.logic import get_application_address
from algokit_utils import AlgorandClient, AssetCreateParams

ROOT = Path(__file__).resolve().parent.parent
METADATA_DIR = ROOT / "assets" / "metadata"
CID_FILE = METADATA_DIR / "cids.json"
ASSET_IDS_FILE = ROOT / "assets" / "asset_ids.json"


def _load_cids() -> dict[str, str]:
    if not CID_FILE.exists():
        raise FileNotFoundError(f"Missing {CID_FILE}. Run scripts/upload_to_ipfs.py first.")

    cid_map = json.loads(CID_FILE.read_text(encoding="utf-8"))
    if len(cid_map) != 10:
        raise RuntimeError(f"Expected 10 CIDs in {CID_FILE}, found {len(cid_map)}.")

    return cid_map


def _resolve_contract_address() -> str:
    contract_address = os.getenv("CONTRACT_ADDRESS")
    if contract_address and is_valid_address(contract_address):
        return contract_address

    app_id_raw = os.getenv("CONTRACT_APP_ID")
    if app_id_raw:
        try:
            app_id = int(app_id_raw)
        except ValueError as exc:
            raise RuntimeError("CONTRACT_APP_ID must be an integer.") from exc
        if app_id <= 0:
            raise RuntimeError("CONTRACT_APP_ID must be a positive integer.")
        return get_application_address(app_id)

    raise RuntimeError(
        "Set a valid CONTRACT_ADDRESS (58-char Algorand address) "
        "or set CONTRACT_APP_ID to derive the app address."
    )


def main() -> None:
    contract_address = _resolve_contract_address()

    cid_map = _load_cids()
    metadata_files = [f"nft_{idx}.json" for idx in range(1, 11)]

    algorand = AlgorandClient.default_localnet()
    deployer = algorand.account.localnet_dispenser()

    created_assets: list[dict[str, str | int]] = []

    for idx, metadata_name in enumerate(metadata_files, start=1):
        cid = cid_map.get(metadata_name)
        if not cid:
            raise RuntimeError(f"CID missing for {metadata_name} in {CID_FILE}.")

        create_result = algorand.send.asset_create(
            AssetCreateParams(
                sender=deployer.address,
                total=1,
                decimals=0,
                default_frozen=False,
                asset_name=f"Future Earning NFT #{idx}",
                unit_name=f"FENFT{idx}",
                manager=contract_address,
                url=f"ipfs://{cid}",
            )
        )

        if create_result.asset_id is None:
            raise RuntimeError(f"Asset creation failed for {metadata_name}; no asset_id returned.")

        created_assets.append(
            {
                "asset_id": create_result.asset_id,
                "metadata_file": metadata_name,
                "cid": cid,
            }
        )
        print(f"Created ASA {create_result.asset_id} for {metadata_name}")

    ASSET_IDS_FILE.write_text(json.dumps(created_assets, indent=2), encoding="utf-8")
    print(f"\nSaved asset IDs to {ASSET_IDS_FILE}")


if __name__ == "__main__":
    main()

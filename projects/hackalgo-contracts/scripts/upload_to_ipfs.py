from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import requests

PINATA_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
ROOT = Path(__file__).resolve().parent.parent
METADATA_DIR = ROOT / "assets" / "metadata"
OUTPUT_FILE = METADATA_DIR / "cids.json"


def _build_headers() -> dict[str, str] | None:
    jwt = os.getenv("PINATA_JWT")
    if jwt:
        return {"Authorization": f"Bearer {jwt}"}

    api_key = os.getenv("PINATA_API_KEY")
    api_secret = os.getenv("PINATA_API_SECRET")
    if api_key and api_secret:
        return {
            "pinata_api_key": api_key,
            "pinata_secret_api_key": api_secret,
        }

    return None


def _mock_cid(raw_bytes: bytes) -> str:
    # Deterministic mock for local demos when no Pinata keys are set.
    return f"mockcid_{hashlib.sha256(raw_bytes).hexdigest()[:40]}"


def _load_metadata(path: Path) -> tuple[dict[str, Any], bytes]:
    raw_text = path.read_text(encoding="utf-8")
    return json.loads(raw_text), raw_text.encode("utf-8")


def main() -> None:
    metadata_files = sorted(METADATA_DIR.glob("nft_*.json"))
    if len(metadata_files) != 10:
        raise RuntimeError(f"Expected 10 metadata files in {METADATA_DIR}, found {len(metadata_files)}")

    headers = _build_headers()
    use_mock = headers is None
    if use_mock:
        print("No Pinata credentials found (PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET). Using mock CIDs.")
    else:
        print("Uploading metadata files to Pinata...")

    cid_map: dict[str, str] = {}
    for metadata_file in metadata_files:
        payload_json, raw_bytes = _load_metadata(metadata_file)

        if use_mock:
            cid = _mock_cid(raw_bytes)
        else:
            payload = {
                "pinataOptions": {"cidVersion": 1},
                "pinataMetadata": {"name": metadata_file.name},
                "pinataContent": payload_json,
            }
            response = requests.post(PINATA_URL, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            cid = response.json()["IpfsHash"]

        cid_map[metadata_file.name] = cid
        print(f"{metadata_file.name}: {cid}")

    OUTPUT_FILE.write_text(json.dumps(cid_map, indent=2), encoding="utf-8")
    print(f"\nSaved CID mapping to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

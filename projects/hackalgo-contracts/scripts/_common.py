from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import algokit_utils
from algokit_utils import AlgoAmount, AlgorandClient, SigningAccount
from algosdk import mnemonic
from algosdk.atomic_transaction_composer import TransactionWithSigner

ROOT_DIR = Path(__file__).resolve().parent.parent
STATE_FILE = Path(__file__).resolve().parent / ".algo_mint_state.json"
INVESTOR_FILE = Path(__file__).resolve().parent / ".algo_mint_investor.json"
CONTRACT_PATH = ROOT_DIR / "smart_contracts" / "algo_mint.py"
ARTIFACTS_DIR = ROOT_DIR / "smart_contracts" / "artifacts" / "algo_mint"

APP_NAME = "algo-mint"

MINT_MBR_FUNDING_MICROALGOS = 2_000_000
BUY_NFT_PAYMENT_MICROALGOS = 1_000_000
CONTRACT_TOPUP_MICROALGOS = 20_000_000
INNER_TXN_EXTRA_FEE_MICROALGOS = 1_000

MINT_METHOD = "mint_future_nft(uint64,uint64,uint64,pay)void"
BUY_METHOD = "buy_nft(uint64,pay)void"
REPORT_METHOD = "report_income(uint64,uint64)void"
CLAIM_METHOD = "claim_payout(uint64)void"
PENDING_METHOD = "get_pending_payout(uint64,address)uint64"


@dataclass
class DeployedApp:
    app_id: int
    app_address: str
    app_spec_path: Path


def get_algorand() -> AlgorandClient:
    return AlgorandClient.from_environment()


def _account_from_env_with_fallback(algorand: AlgorandClient, *names: str) -> SigningAccount:
    for name in names:
        try:
            return algorand.account.from_environment(name)
        except Exception:
            continue
    raise RuntimeError(f"Unable to load account from env names: {', '.join(names)}")


def get_creator(algorand: AlgorandClient) -> SigningAccount:
    creator = _account_from_env_with_fallback(algorand, "CREATOR", "DEPLOYER")
    algorand.account.ensure_funded_from_environment(
        account_to_fund=creator.address,
        min_spending_balance=AlgoAmount.from_algo(20),
    )
    return creator


def get_investor(algorand: AlgorandClient) -> SigningAccount:
    try:
        investor = _account_from_env_with_fallback(algorand, "INVESTOR")
    except RuntimeError:
        if INVESTOR_FILE.exists():
            investor_mnemonic = json.loads(INVESTOR_FILE.read_text(encoding="utf-8"))[
                "mnemonic"
            ]
            investor = algorand.account.from_mnemonic(investor_mnemonic)
        else:
            investor = algorand.account.random()
            INVESTOR_FILE.write_text(
                json.dumps(
                    {"mnemonic": mnemonic.from_private_key(investor.private_key)},
                    indent=2,
                ),
                encoding="utf-8",
            )
    algorand.account.ensure_funded(
        account_to_fund=investor.address,
        dispenser_account=algorand.account.localnet_dispenser(),
        min_spending_balance=AlgoAmount.from_algo(20),
    )
    return investor


def compile_contract() -> Path:
    if not CONTRACT_PATH.exists():
        raise FileNotFoundError(
            f"Contract not found at {CONTRACT_PATH}. "
            "Create smart_contracts/algo_mint.py first."
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "algokit",
            "--no-color",
            "compile",
            "python",
            str(CONTRACT_PATH),
            f"--out-dir={ARTIFACTS_DIR}",
            "--output-source-map",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        raise RuntimeError(f"Contract compile failed:\n{result.stdout}\n{result.stderr}")
    return get_app_spec_path()


def get_app_spec_path() -> Path:
    arc56_specs = sorted(ARTIFACTS_DIR.glob("*.arc56.json"))
    if not arc56_specs:
        raise FileNotFoundError(
            f"No ARC-56 app spec found in {ARTIFACTS_DIR}. "
            "Run deploy.py to compile first."
        )
    return arc56_specs[0]


def save_state(app_id: int, app_address: str, app_spec_path: Path) -> None:
    payload = {
        "app_id": app_id,
        "app_address": app_address,
        "app_spec_path": str(app_spec_path),
    }
    STATE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_state() -> dict[str, str | int]:
    if not STATE_FILE.exists():
        raise FileNotFoundError(
            f"State file not found at {STATE_FILE}. Run scripts/deploy.py first."
        )
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def deploy_or_update_app(algorand: AlgorandClient, creator: SigningAccount) -> DeployedApp:
    app_spec_path = compile_contract()
    app_spec_json = app_spec_path.read_text(encoding="utf-8")
    factory = algorand.client.get_app_factory(
        app_spec=app_spec_json,
        default_sender=creator.address,
        app_name=APP_NAME,
    )
    app_client, _result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
    )
    save_state(app_client.app_id, app_client.app_address, app_spec_path)
    return DeployedApp(
        app_id=app_client.app_id,
        app_address=app_client.app_address,
        app_spec_path=app_spec_path,
    )


def get_app_client(
    algorand: AlgorandClient,
    app_id: int,
    sender: SigningAccount,
    app_spec_path: Path | None = None,
) -> algokit_utils.AppClient:
    spec = app_spec_path or Path(str(load_state()["app_spec_path"]))
    app_spec_json = spec.read_text(encoding="utf-8")
    return algorand.client.get_app_client_by_id(
        app_spec=app_spec_json,
        app_id=app_id,
        default_sender=sender.address,
    )




def make_payment_arg(
    algorand: AlgorandClient,
    sender: SigningAccount,
    receiver: str,
    amount_microalgos: int,
) -> TransactionWithSigner:
    payment_txn = algorand.create_transaction.payment(
        algokit_utils.PaymentParams(
            sender=sender.address,
            receiver=receiver,
            amount=AlgoAmount.from_micro_algo(amount_microalgos),
        )
    )
    return TransactionWithSigner(payment_txn, sender.signer)

import algokit_utils
import pytest
from algokit_utils import (
    AlgoAmount,
    AlgorandClient,
    SigningAccount,
)

from smart_contracts.artifacts.algomint.algomint_client import (
    AlgomintClient,
    AlgomintFactory,
)


@pytest.fixture()
def deployer(algorand_client: AlgorandClient) -> SigningAccount:
    account = algorand_client.account.from_environment("DEPLOYER")
    algorand_client.account.ensure_funded_from_environment(
        account_to_fund=account.address, min_spending_balance=AlgoAmount.from_algo(10)
    )
    return account


@pytest.fixture()
def algomint_client(
    algorand_client: AlgorandClient, deployer: SigningAccount
) -> AlgomintClient:
    factory = algorand_client.client.get_typed_app_factory(
        AlgomintFactory, default_sender=deployer.address
    )

    client, _ = factory.deploy(
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        on_update=algokit_utils.OnUpdate.AppendApp,
    )
    return client


def test_deploys_algomint_client(algomint_client: AlgomintClient) -> None:
    assert algomint_client.app_id > 0
    assert algomint_client.app_address

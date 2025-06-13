"""Action providers for AgentKit."""

from .action_decorator import create_action
from .action_provider import Action, ActionProvider
from .aave.aave_action_provider import AaveActionProvider, aave_action_provider
from .allora.allora_action_provider import AlloraActionProvider, allora_action_provider
from .basename.basename_action_provider import (
    BasenameActionProvider,
    basename_action_provider,
)
from .cdp.cdp_api_action_provider import CdpApiActionProvider, cdp_api_action_provider
from .compound.compound_action_provider import CompoundActionProvider, compound_action_provider
from .erc20.erc20_action_provider import ERC20ActionProvider, erc20_action_provider
from .hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
    hyperbolic_action_provider,
)
from .morpho.morpho_action_provider import MorphoActionProvider, morpho_action_provider
from .nillion.nillion_action_provider import NillionActionProvider, nillion_action_provider
from .onramp.onramp_action_provider import OnrampActionProvider, onramp_action_provider
from .pyth.pyth_action_provider import PythActionProvider, pyth_action_provider
from .ssh.ssh_action_provider import SshActionProvider, ssh_action_provider
from .superfluid.superfluid_action_provider import (
    SuperfluidActionProvider,
    superfluid_action_provider,
)
from .twitter.twitter_action_provider import TwitterActionProvider, twitter_action_provider
from .wallet.wallet_action_provider import WalletActionProvider, wallet_action_provider
from .weth.weth_action_provider import WethActionProvider, weth_action_provider
from .wow.wow_action_provider import WowActionProvider, wow_action_provider

__all__ = [
    "Action",
    "ActionProvider",
    "create_action",
    "AaveActionProvider",
    "aave_action_provider",
    "AlloraActionProvider",
    "allora_action_provider",
    "BasenameActionProvider",
    "basename_action_provider",
    "CdpApiActionProvider",
    "cdp_api_action_provider",
    "CompoundActionProvider",
    "compound_action_provider",
    "ERC20ActionProvider",
    "erc20_action_provider",
    "HyperbolicActionProvider",
    "hyperbolic_action_provider",
    "MorphoActionProvider",
    "morpho_action_provider",
    "NillionActionProvider",
    "nillion_action_provider",
    "OnrampActionProvider",
    "onramp_action_provider",
    "PythActionProvider",
    "pyth_action_provider",
    "SshActionProvider",
    "ssh_action_provider",
    "SuperfluidActionProvider",
    "superfluid_action_provider",
    "TwitterActionProvider",
    "twitter_action_provider",
    "WalletActionProvider",
    "wallet_action_provider",
    "WethActionProvider",
    "weth_action_provider",
    "WowActionProvider",
    "wow_action_provider",
]

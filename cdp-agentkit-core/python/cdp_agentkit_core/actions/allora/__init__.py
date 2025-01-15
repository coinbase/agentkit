from cdp_agentkit_core.actions.allora.action import AlloraAction
from cdp_agentkit_core.actions.allora.get_all_topics import GetAllTopicsAction
from cdp_agentkit_core.actions.allora.get_price_inference import GetPriceInferenceAction


def get_all_allora_actions() -> list[type[AlloraAction]]:
    actions = []
    for action in AlloraAction.__subclasses__():
        actions.append(action())

    return actions


ALLORA_ACTIONS = get_all_allora_actions()

__all__ = [
    "ALLORA_ACTIONS",
    "GetPriceInferenceAction",
    "GetAllTopicsAction",
]

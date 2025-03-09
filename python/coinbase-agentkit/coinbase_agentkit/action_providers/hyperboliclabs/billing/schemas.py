"""Schemas for Hyperbolic billing actions.

This module provides simplified schemas for billing action inputs.
"""

from pydantic import BaseModel


class GetCurrentBalanceSchema(BaseModel):
    """Schema for get_current_balance action.

    This action doesn't require any inputs.
    """

    pass


class GetSpendHistorySchema(BaseModel):
    """Schema for get_spend_history action.

    This action doesn't require any inputs.
    """

    pass

"""Schemas for Hyperbolic billing actions.

This module provides simplified schemas for billing action inputs.
"""

from pydantic import BaseModel


class GetCurrentBalanceSchema(BaseModel):
    """Schema for get_current_balance action."""

    pass


class GetPurchaseHistorySchema(BaseModel):
    """Schema for get_purchase_history action."""

    pass


class GetSpendHistorySchema(BaseModel):
    """Schema for get_spend_history action."""

    pass

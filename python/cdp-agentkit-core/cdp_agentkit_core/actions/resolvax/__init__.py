"""
resolvax_agentkit
Official Coinbase AgentKit Action Provider for ResolvaX (Base Layer 2 x402).
"""
from .action_provider import ResolvaXActionProvider
from .schemas import (
    MathSolveSchema,
    LatexConverterSchema,
    FinancialMathSchema,
    ExerciseGeneratorSchema,
    MathEvaluatorSchema,
    MathOcrSchema,
)

__version__ = "0.1.0"
__all__ = [
    "ResolvaXActionProvider",
    "MathSolveSchema",
    "LatexConverterSchema",
    "FinancialMathSchema",
    "ExerciseGeneratorSchema",
    "MathEvaluatorSchema",
    "MathOcrSchema",
]

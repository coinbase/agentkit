"""
resolvax_agentkit/schemas.py
Pydantic Schemas for ResolvaX 6 Commercial M2M APIs.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MathSolveSchema(BaseModel):
    expression: str = Field(..., description="Equação ou expressão matemática, ex: '3*x^2 - 12*x + 9 = 0' ou 'sin(x)^2 + cos(x)^2'")
    operation: str = Field(default="solve", description="Operação: 'solve', 'simplify', 'factor', 'expand', 'diff', 'integrate'")
    variable: Optional[str] = Field(default="x", description="Variável independente principal (padrão: 'x')")


class LatexConverterSchema(BaseModel):
    input_text: str = Field(..., description="Texto ou fórmula matemática para conversão em LaTeX puro")
    display_mode: Optional[str] = Field(default="inline", description="Modo de exibição: 'inline' ($...$) ou 'block' ($$...$$)")


class FinancialMathSchema(BaseModel):
    calculation_type: str = Field(..., description="Tipo de cálculo: 'compound_interest', 'simple_interest', 'price_table', 'sac_table', 'npv', 'irr'")
    principal: float = Field(..., description="Capital ou valor financiado inicial em R$ / moeda base")
    rate: float = Field(..., description="Taxa de juros expressa em valor decimal por período (ex: 0.015 para 1.5%)")
    periods: int = Field(..., description="Quantidade de períodos (meses ou anos)")


class ExerciseGeneratorSchema(BaseModel):
    topic: str = Field(..., description="Tópico matemático: 'quadratic_equations', 'linear_systems', 'trigonometry', 'percentages', 'geometry'")
    difficulty: Optional[str] = Field(default="medium", description="Dificuldade: 'easy', 'medium', 'hard'")
    grade_level: Optional[str] = Field(default="EF09", description="Nível de escolaridade ou código BNCC (ex: 'EF09', 'EM01')")


class MathEvaluatorSchema(BaseModel):
    candidate_answer: str = Field(..., description="Resposta do aluno ou agente candidata a avaliação")
    expected_answer: str = Field(..., description="Gabarito ou resposta oficial esperada")
    variable: Optional[str] = Field(default="x", description="Variável principal da expressão")


class MathOcrSchema(BaseModel):
    image_base64: str = Field(..., description="Imagem contendo texto ou fórmulas matemáticas em Base64")

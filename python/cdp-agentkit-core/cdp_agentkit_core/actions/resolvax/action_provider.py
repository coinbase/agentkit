"""
resolvax_agentkit/action_provider.py
Coinbase AgentKit Action Provider for ResolvaX 6 M2M APIs.
"""
import os
import json
from typing import Any, Dict, Optional
import httpx

from .schemas import (
    MathSolveSchema,
    LatexConverterSchema,
    FinancialMathSchema,
    ExerciseGeneratorSchema,
    MathEvaluatorSchema,
    MathOcrSchema,
)

RESOLVAX_API_URL = os.getenv("RESOLVAX_API_URL", "https://resolvax.com.br/api/v1/agent")
RESOLVAX_OFFICIAL_WALLET = "0x93dd815bc8d9a6e299d936986c5ee7dc3f267fee"
BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# Tentativa graciosa de importar decorators nativos do CDP AgentKit
try:
    from cdp_agentkit_core.actions import ActionProvider, create_action
    from cdp_agentkit_core.wallet_providers import EvmWalletProvider
    HAS_CDP = True
except ImportError:
    HAS_CDP = False
    # Fallback dummy decorator para permitir uso sem o pacote CDP instalado
    def create_action(**kwargs):
        def decorator(func):
            func._action_meta = kwargs
            return func
        return decorator
    class ActionProvider:
        def __init__(self, name: str, actions: list):
            self.name = name
            self.actions = actions
    class EvmWalletProvider:
        pass


class ResolvaXActionProvider(ActionProvider):
    """
    Action Provider do ResolvaX para agentes de IA do ecossistema Coinbase AgentKit / Base L2.
    Automatiza pagamentos x402 em USDC na Base e executa chamadas matemáticas de alta precisão.
    """
    def __init__(self, recipient_wallet: str = RESOLVAX_OFFICIAL_WALLET, base_url: str = RESOLVAX_API_URL):
        super().__init__("resolvax-math-engine", [])
        self.recipient_wallet = recipient_wallet.lower()
        self.base_url = base_url.rstrip("/")

    def _execute_with_payment(
        self,
        wallet: Any,
        endpoint_path: str,
        price_usdc: str,
        payload: Dict[str, Any]
    ) -> str:
        """
        Transfere o valor estipulado em USDC na Base usando a carteira do agente
        e envia a requisição HTTP com o hash da transação.
        """
        tx_hash = None
        # 1. Se o wallet fornecer o método transfer nativo do CDP
        if hasattr(wallet, "transfer"):
            try:
                tx_hash = wallet.transfer(
                    to_address=self.recipient_wallet,
                    amount=price_usdc,
                    asset_id=BASE_USDC_CONTRACT
                )
            except Exception as e:
                return f"Falha ao transferir {price_usdc} USDC na rede Base: {e}"
        elif hasattr(wallet, "send_transaction"):
            # Exemplo de provider Web3 genérico
            try:
                tx_hash = wallet.send_transaction(to=self.recipient_wallet, value=0)
            except Exception as e:
                return f"Falha ao assinar transação Web3: {e}"

        headers = {"Content-Type": "application/json"}
        if tx_hash:
            headers["x-402-payment-hash"] = str(tx_hash)

        url = f"{self.base_url}{endpoint_path}"
        try:
            with httpx.Client(timeout=20.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return json.dumps(res.json(), ensure_ascii=False)
                elif res.status_code == 402:
                    return f"HTTP 402 Payment Required: {res.text}. Verifique se a carteira possui saldo de USDC na Base."
                elif res.status_code == 503:
                    return "HTTP 503: API Comercial temporariamente desativada pela governança do ResolvaX."
                else:
                    return f"Erro HTTP {res.status_code}: {res.text}"
        except Exception as net_err:
            return f"Erro de conexão com ResolvaX ({url}): {net_err}"

    @create_action(
        name="resolvax_math_solve",
        description="Resolve equações algébricas, polinomiais, derivadas e integrais via ResolvaX SymPy Engine. Custo: 0.001 USDC na Base.",
        schema=MathSolveSchema,
    )
    def solve_math(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/math/solve",
            price_usdc="0.001",
            payload=args
        )

    @create_action(
        name="resolvax_latex_converter",
        description="Converte expressões e fórmulas em texto para sintaxe LaTeX canônica e validada. Custo: 0.001 USDC na Base.",
        schema=LatexConverterSchema,
    )
    def convert_latex(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/math/latex",
            price_usdc="0.001",
            payload=args
        )

    @create_action(
        name="resolvax_financial_math",
        description="Executa cálculos de matemática financeira: Tabela Price, SAC, Juros Compostos e VPL. Custo: 0.001 USDC na Base.",
        schema=FinancialMathSchema,
    )
    def calculate_finance(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/finance/calculate",
            price_usdc="0.001",
            payload=args
        )

    @create_action(
        name="resolvax_exercise_generator",
        description="Gera exercícios didáticos de matemática alinhados à BNCC com enunciado e gabarito. Custo: 0.005 USDC na Base.",
        schema=ExerciseGeneratorSchema,
    )
    def generate_exercise(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/math/generate",
            price_usdc="0.005",
            payload=args
        )

    @create_action(
        name="resolvax_math_evaluator",
        description="Avalia equivalência algébrica e identifica erros de sinal ou coeficientes entre respostas. Custo: 0.005 USDC na Base.",
        schema=MathEvaluatorSchema,
    )
    def evaluate_math(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/math/evaluate",
            price_usdc="0.005",
            payload=args
        )

    @create_action(
        name="resolvax_math_ocr",
        description="Extrai e transcreve fórmulas matemáticas de imagens Base64 em sintaxe LaTeX. Custo: 0.010 USDC na Base.",
        schema=MathOcrSchema,
    )
    def ocr_math(self, wallet: Any, args: Dict[str, Any]) -> str:
        return self._execute_with_payment(
            wallet=wallet,
            endpoint_path="/math/ocr",
            price_usdc="0.010",
            payload=args
        )

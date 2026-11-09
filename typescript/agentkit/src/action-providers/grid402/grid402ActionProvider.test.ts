import { grid402ActionProvider, Grid402ActionProvider } from "./grid402ActionProvider";

describe("Grid402ActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  let provider: Grid402ActionProvider;

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
    provider = grid402ActionProvider();
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });

  describe("fetchCnpj", () => {
    it("should sanitize cnpj digits and return company data on success", async () => {
      const mockData = {
        cnpj: "00000000000191",
        razao_social: "BANCO DO BRASIL SA",
        status: "ATIVA",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchCnpj({
        cnpj: "00.000.000/0001-91",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toContain("/api/v1/cnpj?cnpj=00000000000191");

      const parsed = JSON.parse(response);
      expect(parsed.cnpj).toBe("00000000000191");
      expect(parsed.razao_social).toBe("BANCO DO BRASIL SA");
    });

    it("should handle HTTP 402 payment required response gracefully", async () => {
      fetchMock.mockResolvedValueOnce({
        status: 402,
        ok: false,
        json: async () => ({
          error: "payment_required",
          price_usdc: "0.0005",
        }),
      });

      const response = await provider.fetchCnpj({
        cnpj: "12345678000199",
      });

      const parsed = JSON.parse(response);
      expect(parsed.error).toContain("Payment required");
      expect(parsed.details.price_usdc).toBe("0.0005");
    });
  });

  describe("fetchCep", () => {
    it("should resolve CEP postal code to address", async () => {
      const mockData = {
        cep: "01310100",
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        cidade: "Sao Paulo",
        uf: "SP",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchCep({ code: "01310-100" });
      const parsed = JSON.parse(response);
      expect(parsed.logradouro).toBe("Avenida Paulista");
    });
  });

  describe("fetchForex", () => {
    it("should fetch foreign exchange rates", async () => {
      const mockData = {
        usd_brl: 5.25,
        eur_brl: 5.75,
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchForex({});
      const parsed = JSON.parse(response);
      expect(parsed.usd_brl).toBe(5.25);
    });
  });

  describe("fetchCrypto", () => {
    it("should fetch spot crypto prices in BRL", async () => {
      const mockData = {
        bitcoin: { brl: 500000 },
        ethereum: { brl: 15000 },
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchCrypto({});
      const parsed = JSON.parse(response);
      expect(parsed.bitcoin.brl).toBe(500000);
    });
  });

  describe("fetchDns", () => {
    it("should query DNS records for domain", async () => {
      const mockData = {
        domain: "bcb.gov.br",
        records: { A: ["161.148.16.50"] },
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchDns({ domain: "bcb.gov.br" });
      const parsed = JSON.parse(response);
      expect(parsed.domain).toBe("bcb.gov.br");
    });
  });

  describe("fetchSsl", () => {
    it("should inspect SSL certificates", async () => {
      const mockData = {
        host: "bcb.gov.br",
        valid: true,
        issuer: "DigiCert",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchSsl({ host: "bcb.gov.br" });
      const parsed = JSON.parse(response);
      expect(parsed.valid).toBe(true);
    });
  });

  describe("fetchAsn", () => {
    it("should retrieve ASN routing info", async () => {
      const mockData = {
        ip: "8.8.8.8",
        asn: "AS15169",
        org: "Google LLC",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchAsn({ ip: "8.8.8.8" });
      const parsed = JSON.parse(response);
      expect(parsed.asn).toBe("AS15169");
    });
  });

  describe("fetchIndicators", () => {
    it("should fetch macroeconomic indicators", async () => {
      const mockData = {
        selic: 10.75,
        cdi: 10.65,
        ipca_12m: 3.92,
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchIndicators({});
      const parsed = JSON.parse(response);
      expect(parsed.selic).toBe(10.75);
    });
  });

  describe("fetchHolidays", () => {
    it("should fetch national holidays list", async () => {
      const mockData = {
        year: 2026,
        holidays: [{ date: "2026-01-01", name: "Confraternizacao Universal" }],
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchHolidays({ year: 2026 });
      const parsed = JSON.parse(response);
      expect(parsed.year).toBe(2026);
    });
  });

  describe("calculateWorkdays", () => {
    it("should calculate business days between dates", async () => {
      const mockData = {
        start_date: "2026-01-05",
        end_date: "2026-01-09",
        workdays: 5,
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.calculateWorkdays({
        startDate: "2026-01-05",
        endDate: "2026-01-09",
      });
      const parsed = JSON.parse(response);
      expect(parsed.workdays).toBe(5);
    });
  });

  describe("fetchSanctions", () => {
    it("should fetch sanctions for a given CNPJ", async () => {
      const mockData = {
        cnpj: "00000000000191",
        has_sanctions: false,
        total_sanctions: 0,
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchSanctions({ cnpj: "00.000.000/0001-91" });
      const parsed = JSON.parse(response);
      expect(parsed.cnpj).toBe("00000000000191");
      expect(parsed.has_sanctions).toBe(false);
    });
  });

  describe("fetchSimples", () => {
    it("should fetch Simples Nacional status for a given CNPJ", async () => {
      const mockData = {
        cnpj: "00000000000191",
        optante_simples: false,
        optante_simei: false,
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchSimples({ cnpj: "00.000.000/0001-91" });
      const parsed = JSON.parse(response);
      expect(parsed.cnpj).toBe("00000000000191");
      expect(parsed.optante_simples).toBe(false);
    });
  });

  describe("fetchCompliance", () => {
    it("should evaluate compliance score and risk tier for a given CNPJ", async () => {
      const mockData = {
        cnpj: "00000000000191",
        compliance_score: 95,
        risk_tier: "BAIXO",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      });

      const response = await provider.fetchCompliance({ cnpj: "00.000.000/0001-91" });
      const parsed = JSON.parse(response);
      expect(parsed.compliance_score).toBe(95);
      expect(parsed.risk_tier).toBe("BAIXO");
    });
  });

  describe("verifyOracleProof", () => {
    it("should verify cryptographic proof via POST", async () => {
      const mockVerification = {
        verified: true,
        signer: "0xa31c31069c43ac1c0075a93c325b0dcd7744356c",
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockVerification,
      });

      const response = await provider.verifyOracleProof({
        payload: { test: "data", _oracle_proof: { signature: "0x123" } },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");

      const parsed = JSON.parse(response);
      expect(parsed.verified).toBe(true);
      expect(parsed.signer).toBe("0xa31c31069c43ac1c0075a93c325b0dcd7744356c");
    });
  });

  describe("getSummary", () => {
    it("should fetch status and service summary", async () => {
      const mockSummary = {
        status: "ok",
        version: "1.0",
        services: ["cnpj", "cep", "forex", "crypto"],
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockSummary,
      });

      const response = await provider.getSummary({});
      const parsed = JSON.parse(response);
      expect(parsed.status).toBe("ok");
    });
  });

  describe("configuration and error handling", () => {
    it("should use custom baseUrl and sandbox header when configured", async () => {
      const customProvider = grid402ActionProvider({
        baseUrl: "https://custom.grid402.online",
        sandbox: true,
        apiKey: "test-token",
      });

      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ ok: true }),
      });

      await customProvider.getSummary({});

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toContain("https://custom.grid402.online/status");
      expect(callArgs[1].headers["X-Payment"]).toBe("demo");
      expect(callArgs[1].headers["Authorization"]).toBe("Bearer test-token");
    });

    it("should handle unexpected network exceptions", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

      const response = await provider.getSummary({});
      const parsed = JSON.parse(response);
      expect(parsed.error).toBe("Failed to execute request to Grid402");
      expect(parsed.message).toContain("Connection refused");
    });
  });
});

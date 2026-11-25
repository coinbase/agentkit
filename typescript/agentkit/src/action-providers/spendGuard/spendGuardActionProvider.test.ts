import { spendGuardActionProvider } from "./spendGuardActionProvider";

describe("SpendGuardActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = spendGuardActionProvider("https://guard.example");

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("posts the batch to /v1/guard and returns the decision", async () => {
    const decision = { ok: true, codes: "0", values: { "BUDGET.USD": 6200 }, latched: false };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify(decision)),
    });

    const result = await provider.guardBatch({
      orders: [{ root: "BUDGET.USD", action: "INCREASE", value_dec: 5 }],
      tenant: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://guard.example/v1/guard",
      expect.objectContaining({ method: "POST" }),
    );
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo).toEqual({
      orders: [{ root: "BUDGET.USD", action: "INCREASE", value_dec: 5 }],
      tenant: 2,
    });
    expect(JSON.parse(result)).toEqual(decision);
  });

  it("answers with the challenge when the batch is over the free tier", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      text: jest.fn().mockResolvedValue('{"accepts":[{"amount":"1000"}]}'),
    });

    const result = await provider.guardBatch({
      orders: [{ root: "QUEUE.BATCH", action: "SET", value: 16 }],
    });

    expect(result).toContain("Payment required");
    expect(result).toContain('"amount":"1000"');
  });

  it("reports a server error without throwing", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("boom"),
    });

    const result = await provider.guardBatch({
      orders: [{ root: "API.RATE", action: "READ" }],
    });

    expect(result).toContain("Spend guard error 500");
  });

  it("reports a network error without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("Network down"));

    const result = await provider.guardBatch({
      orders: [{ root: "API.RATE", action: "READ" }],
    });

    expect(result).toContain("Error calling the spend guard");
  });
});

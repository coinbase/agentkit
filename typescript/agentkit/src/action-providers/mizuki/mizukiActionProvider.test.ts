import { mizukiActionProvider } from "./mizukiActionProvider";

describe("MizukiActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = mizukiActionProvider();

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue({
      status,
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("quoteMaintenance", () => {
    it("returns the quote and its payment requirements", async () => {
      respond(201, { quote_id: "q-1", price_usdc: "2", accepts: [{ scheme: "exact" }] });

      const result = await provider.quoteMaintenance({
        githubIssueUrl: "https://github.com/open-covenant/covenant/issues/12",
      });

      expect(result).toContain("q-1");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://mizuki.opencovenant.org/api/mizuki/v1/quotes");
      expect(JSON.parse(init.body)).toEqual({
        github_issue_url: "https://github.com/open-covenant/covenant/issues/12",
      });
    });

    it("relays the reason an issue was refused instead of reporting a generic failure", async () => {
      respond(422, { error: "Choose an open GitHub issue for paid maintenance." });

      const result = await provider.quoteMaintenance({
        githubIssueUrl: "https://github.com/open-covenant/covenant/pull/3",
      });

      expect(result).toContain("declined");
      expect(result).toContain("Choose an open GitHub issue");
    });
  });

  describe("getJobStatus", () => {
    it("returns the job state", async () => {
      respond(200, { id: "11111111-1111-4111-8111-111111111111", state: "delivered" });

      const result = await provider.getJobStatus({
        jobId: "11111111-1111-4111-8111-111111111111",
      });

      expect(result).toContain("delivered");
    });

    it("distinguishes an unknown job from a failure", async () => {
      respond(404, {});

      const result = await provider.getJobStatus({
        jobId: "11111111-1111-4111-8111-111111111111",
      });

      expect(result).toContain("No Mizuki job found");
    });
  });

  describe("assessRepository", () => {
    it("returns the assessment", async () => {
      respond(200, { repository: "open-covenant/covenant", eligible: true });

      const result = await provider.assessRepository({ owner: "open-covenant", repo: "covenant" });

      expect(result).toContain("eligible");
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://mizuki.opencovenant.org/api/mizuki/x402/assess/open-covenant/covenant",
      );
    });

    it("surfaces the payment challenge rather than treating it as an error", async () => {
      respond(402, { x402Version: 2 });

      const result = await provider.assessRepository({ owner: "open-covenant", repo: "covenant" });

      expect(result).toContain("paid endpoint");
    });

    it("refuses path segments that are not GitHub names", async () => {
      const result = await provider.assessRepository({ owner: "..", repo: "covenant" });

      expect(result).toContain("must be GitHub names");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("listBounties", () => {
    it("returns the open bounties", async () => {
      respond(200, { bounties: [{ id: "b-1", title: "Fix the README" }] });

      const result = await provider.listBounties({});

      expect(result).toContain("Fix the README");
    });
  });

  describe("supportsNetwork", () => {
    it("supports any network, because quoting and reading are HTTP", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});

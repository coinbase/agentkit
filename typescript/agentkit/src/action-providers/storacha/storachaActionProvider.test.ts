import { StorachaActionProvider } from "./storachaActionProvider";

import type {
    Client,
} from "@storacha/client";

// TODO base64
const MOCK_CONFIG = {
    key: "test-key",
    proof: "test-proof",
};


describe("StorachaActionProvider", () => {
    let mockClient: jest.Mocked<Client>;
    let provider: StorachaActionProvider;

    beforeEach(() => {
        mockClient = {
            uploadFile: jest.fn(),
            uploadDirectory: jest.fn(),
        } as unknown as jest.Mocked<Client>;

        provider = new StorachaActionProvider(MOCK_CONFIG);
    });

    describe("Constructor", () => {
        it("should initialize with config values", () => {
            expect(() => new StorachaActionProvider(MOCK_CONFIG)).not.toThrow();
        });

        it("should initialize with environment variables", () => {
            process.env.STORACHA_KEY = MOCK_CONFIG.key;
            process.env.STORACHA_PROOF = MOCK_CONFIG.proof;

            expect(() => new StorachaActionProvider()).not.toThrow();
        });

        it("should throw error if no config or env vars", () => {
            delete process.env.STORACHA_KEY;
            delete process.env.STORACHA_PROOF;

            expect(() => new StorachaActionProvider()).toThrow("STORACHA_KEY is not configured.");
        });
    });


});

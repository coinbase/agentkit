import { StorachaActionProvider } from "./storachaActionProvider";

import type {
    Client,
} from "@web3-storage/w3up-client/types";

// TODO base64
const MOCK_CONFIG = {
    agentPrivateKey: "test-key",
    agentDelegation: "test-proof",
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

        it("should throw error if no config", () => {

            expect(() => new StorachaActionProvider({
                ...MOCK_CONFIG,
                agentPrivateKey: "",
            })).toThrow("STORACHA_KEY is not configured.");
        });
    });


});

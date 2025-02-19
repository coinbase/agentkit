import {
  cdpApiActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { AgentBuilder } from "./src/builder";
import { PrivyWalletProviderFactory } from "./src/providers/privy";
import { validateEnvironment } from "./src/env";

const MESSAGE_MODIFIER = `
  You are a helpful agent with a Privy server wallet that can interact onchain using the Coinbase Developer
  Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can
  request them from the faucet if you are on network ID 'base-sepolia' or 'solana-devnet'. If not, you can provide your wallet
  details and request funds from the user. Before executing your first action, get the wallet details to see
  what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If
  someone asks you to do something you can't do with your currently available tools, you must say so, and
  encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
  docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
  restating your tools' descriptions unless it is explicitly requested.
`;

const MODEL = "gpt-4o-mini";
const NAME = "Privy Agent Example!";
const WALLET_DATA_FILE_PATH = "wallet_data.txt";
const WALLET_DEFAULT_CHAIN_ID = "84532"; // base-sepolia

const REQUIRED_ENV = ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY", "OPENAI_API_KEY"] as const;

/**
 * Creates and starts the agent
 */
export async function startAgent(): Promise<void> {
  validateEnvironment(REQUIRED_ENV);

  const actionProviders = [
    cdpApiActionProvider({
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
    }),
    erc20ActionProvider(),
    pythActionProvider(),
    walletActionProvider(),
    wethActionProvider(),
  ];

  const walletFactory = new PrivyWalletProviderFactory();
  const agent = await new AgentBuilder()
    .withName(NAME)
    .withModel(MODEL)
    .withMessageModifier(MESSAGE_MODIFIER)
    .withRequiredEnv(REQUIRED_ENV)
    .withActionProviders(actionProviders)
    .withWalletProvider(walletFactory, {
      walletDataFilePath: WALLET_DATA_FILE_PATH,
      walletDefaultChainId: WALLET_DEFAULT_CHAIN_ID,
    })
    .build();

  await agent.start();
}

if (require.main === module) {
  console.log("Starting Your Agent(s)...");
  startAgent().catch(error => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  });
}

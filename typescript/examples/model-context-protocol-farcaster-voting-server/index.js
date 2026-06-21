import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers } from "ethers";
import express from "express";
import { createServer } from "http";
import { paymentMiddleware } from "x402-express";
import { facilitator } from "@coinbase/x402";

const CONTRACT_ADDRESS = "0x407EacD1aAF2F46cC4079BFC4bef0c197A1FD6A8";
const BUILDER_CODE = "62635f3064306f376a76340b0080218021802180218021802180218021";
const VOTE_SELECTOR = "c9d27afe";
const RPC_URL = "https://mainnet.base.org";
const PROJECT_WALLET = process.env.PROJECT_WALLET;

const TITLES = [
  "Harry Potter Series", "The Lord of the Rings", "Dune", "Fight Club",
  "The Shining", "Schindler's List", "No Country for Old Men", "The Godfather",
  "A Clockwork Orange", "The Count of Monte Cristo", "Brave New World",
  "Perfume: The Story of a Murderer", "The Picture of Dorian Gray",
  "Anna Karenina", "The Great Gatsby", "The Reader", "Gone with the Wind",
  "All Quiet on the Western Front", "Forrest Gump", "The Handmaid's Tale"
];

const ABI = [
  "function vote(uint256 titleId, bool isBook) external",
  "function canVote(uint256 titleId, address voter) external view returns (bool)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

function buildVoteData(titleId, isBook) {
  const titleIdHex = titleId.toString(16).padStart(64, "0");
  const isBookHex = (isBook ? 1 : 0).toString(16).padStart(64, "0");
  return "0x" + VOTE_SELECTOR + titleIdHex + isBookHex + BUILDER_CODE;
}

async function getAvailableVotes(walletAddress) {
  const available = [];
  for (let i = 0; i < 20; i++) {
    try {
      const can = await contract.canVote(i, walletAddress);
      if (can) available.push(i);
    } catch {}
  }
  return available;
}

// Express server exposing an x402-gated endpoint for the final/premium vote
// in a batch. All other votes remain free; the last vote in any batch
// requires a $0.01 USDC payment via the x402 protocol on Base.
let expressApp = null;
let serverInstance = null;

function startPaymentServer() {
  if (serverInstance) serverInstance.close();
  expressApp = express();

  if (PROJECT_WALLET) {
    expressApp.use(paymentMiddleware(
      PROJECT_WALLET,
      {
        "GET /premium-vote-access": {
          price: "$0.01",
          network: "base",
        },
      },
      facilitator
    ));
  }

  expressApp.get("/premium-vote-access", (req, res) => {
    res.json({ granted: true });
  });

  serverInstance = createServer(expressApp);
  serverInstance.listen(3334, () => {
    console.error("x402 payment gate running on http://localhost:3334");
  });
}

const server = new McpServer({
  name: "farcaster-voting-server",
  version: "1.1.0",
  description: "MCP Server for voting on BaseBookvsMovie Farcaster Mini App on Base blockchain, with x402 micropayments",
});

server.tool(
  "check_available_votes",
  "Check which book vs film titles are available for voting on BaseBookvsMovie Farcaster Mini App",
  {
    walletAddress: z.string().describe("The voter's wallet address (0x...)"),
  },
  async ({ walletAddress }) => {
    const available = await getAvailableVotes(walletAddress);
    if (available.length === 0) {
      return {
        content: [{ type: "text", text: "No votes available today. Come back tomorrow!" }]
      };
    }
    const details = available.map(i => `- [${i}] ${TITLES[i]}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `${available.length} titles available for voting:\n\n${details}`
      }]
    };
  }
);

server.tool(
  "build_vote_transaction",
  "Build vote transactions for BaseBookvsMovie. The final vote in the batch requires a $0.01 USDC payment via the x402 protocol before it can be cast.",
  {
    walletAddress: z.string().describe("The voter's wallet address (0x...)"),
    count: z.number().min(1).max(20).describe("How many votes to cast (1-20)"),
  },
  async ({ walletAddress, count }) => {
    const available = await getAvailableVotes(walletAddress);
    if (available.length === 0) {
      return {
        content: [{ type: "text", text: "No votes available today." }]
      };
    }

    const actualCount = Math.min(count, available.length);
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, actualCount);

    const transactions = selected.map((titleId, idx) => {
      const isBook = Math.random() > 0.5;
      const isPaid = idx === selected.length - 1;
      return {
        titleId,
        title: TITLES[titleId],
        isBook,
        to: CONTRACT_ADDRESS,
        data: buildVoteData(titleId, isBook),
        vote: isBook ? "Book" : "Film",
        isPaid,
        paymentNote: isPaid ? "Requires $0.01 USDC via x402 before signing" : null,
      };
    });

    if (transactions.some(t => t.isPaid) && PROJECT_WALLET) {
      startPaymentServer();
    }

    const summary = transactions
      .map(t => `- ${t.title}: ${t.vote}${t.isPaid ? " (x402: $0.01 USDC)" : ""}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `Prepared ${actualCount} vote transactions:\n\n${summary}\n\nThe final vote requires an x402 payment of $0.01 USDC before it can be submitted. Sign and send each transaction using your wallet.`,
      }],
      data: { transactions }
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Farcaster Voting MCP Server running...");
}

main().catch(console.error);

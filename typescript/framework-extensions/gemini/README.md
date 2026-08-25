# Coinbase AgentKit Gemini Extension

This package provides integration between Coinbase's AgentKit and Google's Gemini AI models, enabling seamless function calling capabilities.

## Installation

```bash
npm install @coinbase/agentkit-gemini @google/generative-ai @coinbase/agentkit
```

## Usage

### Basic Setup

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { getGeminiTools, executeGeminiFunction } from "@coinbase/agentkit-gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize AgentKit
const agentKit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID!,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET!,
  cdpWalletSecret: process.env.CDP_WALLET_SECRET!,
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// Get function declarations for Gemini
const functionDeclarations = getGeminiTools(agentKit);

// Create a chat session with tools
const chat = model.startChat({
  tools: [{ functionDeclarations }],
});
```

### Function Calling Example

```typescript
async function handleUserMessage(message: string) {
  // Send message to Gemini
  const result = await chat.sendMessage(message);
  const response = result.response;

  // Check if Gemini wants to call a function
  const functionCalls = response.functionCalls();
  
  if (functionCalls && functionCalls.length > 0) {
    // Execute each function call
    const functionResults = [];
    
    for (const functionCall of functionCalls) {
      try {
        const result = await executeGeminiFunction(agentKit, {
          name: functionCall.name,
          args: functionCall.args,
        });
        
        functionResults.push({
          name: functionCall.name,
          response: { result },
        });
      } catch (error) {
        functionResults.push({
          name: functionCall.name,
          response: { error: error.message },
        });
      }
    }
    
    // Send function results back to Gemini
    const followUpResult = await chat.sendMessage([
      {
        functionResponse: functionResults[0], // Handle multiple results as needed
      },
    ]);
    
    return followUpResult.response.text();
  }
  
  return response.text();
}

// Example usage
const response = await handleUserMessage("Send 0.1 ETH to 0x742d35Cc6634C0532925a3b8D4C9db96590c6C8C");
console.log(response);
```

### Complete Example with Error Handling

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { getGeminiTools, executeGeminiFunction } from "@coinbase/agentkit-gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function createGeminiAgent() {
  // Initialize AgentKit
  const agentKit = await AgentKit.from({
    cdpApiKeyId: process.env.CDP_API_KEY_ID!,
    cdpApiKeySecret: process.env.CDP_API_KEY_SECRET!,
    cdpWalletSecret: process.env.CDP_WALLET_SECRET!,
  });

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0, // Use low temperature for more deterministic function calls
    },
  });

  // Get function declarations
  const functionDeclarations = getGeminiTools(agentKit);
  
  console.log(`Loaded ${functionDeclarations.length} functions:`, 
    functionDeclarations.map(f => f.name).join(", "));

  // Create chat session
  const chat = model.startChat({
    tools: [{ functionDeclarations }],
    history: [],
  });

  return {
    async sendMessage(message: string): Promise<string> {
      try {
        const result = await chat.sendMessage(message);
        const response = result.response;

        // Handle function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          console.log(`Executing ${functionCalls.length} function call(s)...`);
          
          const functionResults = [];
          
          for (const functionCall of functionCalls) {
            console.log(`Calling function: ${functionCall.name}`);
            console.log(`Arguments:`, functionCall.args);
            
            try {
              const result = await executeGeminiFunction(agentKit, {
                name: functionCall.name,
                args: functionCall.args,
              });
              
              functionResults.push({
                name: functionCall.name,
                response: { result },
              });
              
              console.log(`Function ${functionCall.name} completed successfully`);
            } catch (error) {
              console.error(`Function ${functionCall.name} failed:`, error.message);
              functionResults.push({
                name: functionCall.name,
                response: { error: error.message },
              });
            }
          }
          
          // Send function results back to get final response
          const followUpResult = await chat.sendMessage([
            {
              functionResponse: functionResults[0], // Adjust for multiple results
            },
          ]);
          
          return followUpResult.response.text();
        }
        
        return response.text();
      } catch (error) {
        console.error("Error in sendMessage:", error);
        throw error;
      }
    },
  };
}

// Usage
async function main() {
  const agent = await createGeminiAgent();
  
  const response = await agent.sendMessage(
    "What's my wallet balance and can you send 0.01 ETH to vitalik.eth?"
  );
  
  console.log("Agent response:", response);
}

main().catch(console.error);
```

## API Reference

### `getGeminiTools(agentKit: AgentKit): FunctionDeclaration[]`

Converts AgentKit actions into Gemini-compatible function declarations.

**Parameters:**
- `agentKit`: An initialized AgentKit instance

**Returns:**
- Array of `FunctionDeclaration` objects compatible with Gemini's function calling API

### `executeGeminiFunction(agentKit: AgentKit, functionCall: { name: string; args: Record<string, any> }): Promise<string>`

Executes a function call from Gemini's response using the appropriate AgentKit action.

**Parameters:**
- `agentKit`: An initialized AgentKit instance
- `functionCall`: Object containing the function name and arguments from Gemini's response

**Returns:**
- Promise resolving to the function execution result as a string

**Throws:**
- Error if the function is not found in AgentKit actions
- Error if the function arguments are invalid according to the schema

## Environment Variables

Make sure to set the following environment variables:

```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# CDP API credentials
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret
```

## Supported Zod Schema Types

The extension supports conversion of the following Zod schema types to Gemini's OpenAPI 3.0 format:

- `ZodString` (with min/max length constraints)
- `ZodNumber` (with min/max constraints, integer detection)
- `ZodBoolean`
- `ZodArray`
- `ZodObject` (with required field detection)
- `ZodEnum`
- `ZodLiteral`
- `ZodUnion` (converted to enum when all options are literals)
- `ZodOptional`
- `ZodNullable`
- `ZodRecord`

## Best Practices

1. **Use Low Temperature**: Set temperature to 0 for more deterministic function calls
2. **Validate Function Calls**: Always handle potential errors when executing functions
3. **Descriptive Function Names**: AgentKit action names should be descriptive for better model understanding
4. **Error Handling**: Implement proper error handling for both Gemini API calls and function executions
5. **Function Limits**: Be mindful of the number of functions provided to avoid overwhelming the model

## License

Apache-2.0
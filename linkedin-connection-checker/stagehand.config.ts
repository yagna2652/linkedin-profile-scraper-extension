import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import { AISdkClient } from "./llm_clients/aisdk_client.js";
import { OpenAIClient } from "./llm_clients/openai_client.js";

dotenv.config();

// Create a function to get the LLM client based on explicit configuration
const getLLMClient = () => {
  // Only initialize if environment variables are explicitly set
  const aiProvider = process.env.AI_PROVIDER?.toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  try {
    if (aiProvider === 'openai' && openaiKey) {
      return new OpenAIClient();
    } else if (aiProvider === 'anthropic' && anthropicKey) {
      return new AISdkClient("claude-3-sonnet-20240229");
    } else {
      // If no provider is explicitly configured, return dummy client
      return getDummyClient();
    }
  } catch (error) {
    console.error(`Error initializing LLM client:`, error);
    
    // Fallback to a dummy client that doesn't require a key
    return getDummyClient();
  }
};

// Create a dummy client for fallback when API keys are missing
const getDummyClient = () => {
  const dummyClient = {
    model: "dummy-model",
    modelName: "dummy-model",
    type: "dummy",
    hasVision: false,
    clientOptions: {},
    createChatCompletion: async () => ({
      choices: [{ message: { role: "assistant", content: "API key error - using dummy client" } }]
    }),
    extract: async () => ({
      status: "UNKNOWN",
      confidence: 0.5,
      reasoning: "API key error - using dummy client"
    })
  };
  return dummyClient;
};

const StagehandConfig: ConstructorParams = {
  verbose: 1 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // LLM configuration using the selected provider
  llmClient: getLLMClient(),

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      blockAds: true,
      viewport: {
        width: 1024,
        height: 768,
      },
    },
  },
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
    headless: process.env.HEADLESS_BROWSER === 'true' ? true : false,
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;

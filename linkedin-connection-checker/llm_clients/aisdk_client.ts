/**
 * Simple Anthropic client for Stagehand
 */
export class AISdkClient {
  model: string;
  modelName: string;
  apiKey: string;
  type: string = "anthropic";
  hasVision: boolean = false;
  clientOptions: any = {};

  constructor(model: string, apiKey?: string) {
    this.model = model;
    this.modelName = model;
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.clientOptions = { apiKey: this.apiKey };
    
    // Validate that we have an API key
    if (!this.apiKey) {
      throw new Error("Anthropic API key is required. Please set ANTHROPIC_API_KEY in your .env file.");
    }
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    messages: { role: string; content: string }[],
    options?: any
  ) {
    try {
      // Mock response for now since we're having dependency issues
      console.log("Using mock AI response since dependencies are not available");
      
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: "This is a mock response from the AI client",
            },
          },
        ],
      };
    } catch (error) {
      console.error("Error in AISdkClient:", error);
      throw error;
    }
  }

  /**
   * Extract structured data from the page
   */
  async extract(accessibility: { text: string }, instruction: string, schema: any) {
    try {
      console.log("Using mock extraction since dependencies are not available");
      
      // Return a basic mock response
      return {
        status: "UNKNOWN",
        confidence: 0.5,
        reasoning: "Mock reasoning (AI dependencies not available)",
      };
    } catch (error) {
      console.error("Error in AISdkClient extract:", error);
      throw error;
    }
  }
} 
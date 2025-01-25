declare module 'llamaai' {
  class LlamaAI {
    constructor(apiKey: string);
    
    // Replace 'run' with a more generic method that matches your usage
    api(requestJson: {
      messages: Array<{
        role: string;
        content: string;
      }>;
      functions?: Array<{
        name: string;
        description?: string;
        parameters: {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        };
      }>;
      stream?: boolean;
      function_call?: string;
    }): Promise<{
      choices: Array<{
        message: {
          function_call: {
            arguments: string;
          };
        };
      }>;
    }>;
  }

  export default LlamaAI;
}
export interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      payload: {
        rainfall: number;
        yield: number;
        provider: 'openai' | 'anthropic' | 'historical';
        timestamp: string;
      };
    }>;
  }
  
  export interface PredictionData {
    rainfall: number;
    yield: number;
    provider: 'openai' | 'anthropic' | 'historical';
    timestamp: string;
  }
  
  
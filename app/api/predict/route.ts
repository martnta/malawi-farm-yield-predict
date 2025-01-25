import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from 'next/server'
import LlamaAI from 'llamaai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

const apiToken = process.env.LLAMA_API_KEY;
const llamaAPI = apiToken ? new LlamaAI(apiToken) : null;

export const runtime = 'edge'

interface RequestBody {
  rainfall: number
  provider: 'openai' | 'anthropic' | 'llama' | 'deepseek'
}

const RAINFALL_CONSTRAINTS = {
  MIN: 0,
  MAX: 5000,
  OPTIMAL_LOW: 800,
  OPTIMAL_HIGH: 1200,
  TYPICAL_LOW: 725,
  TYPICAL_HIGH: 2500
}

const YIELD_CONSTRAINTS = {
  MIN: 0,
  MAX: 10,  // 10 metric tons per hectare
  TYPICAL_LOW: 1,  // 1 metric ton per hectare
  TYPICAL_HIGH: 4  // 4 metric tons per hectare
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RequestBody
    const { rainfall, provider } = body

    if (!rainfall || !provider) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof rainfall !== 'number' || rainfall < RAINFALL_CONSTRAINTS.MIN || rainfall > RAINFALL_CONSTRAINTS.MAX) {
      return NextResponse.json({ error: 'Invalid rainfall value' }, { status: 400 })
    }

    if (!['openai', 'anthropic', 'llama'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    const systemPrompt = `You are an AI specialized in Malawian agriculture. Consider these facts:
- Malawi's typical annual rainfall ranges from ${RAINFALL_CONSTRAINTS.TYPICAL_LOW}mm to ${RAINFALL_CONSTRAINTS.TYPICAL_HIGH}mm
- Main crops include maize, tobacco, tea, and sugarcane
- Typical maize yields range from ${YIELD_CONSTRAINTS.TYPICAL_LOW} to ${YIELD_CONSTRAINTS.TYPICAL_HIGH} metric tons per hectare depending on conditions
- Rainfall is a critical factor in determining yield
Provide numeric predictions in metric tons per hectare based on rainfall data, followed by a brief comment explaining the prediction.`

    const userPrompt = `Given an annual rainfall of ${rainfall}mm in Malawi, predict the farm yield in metric tons per hectare. Consider:
1. If rainfall is below ${RAINFALL_CONSTRAINTS.TYPICAL_LOW}mm, yields are severely impacted
2. If rainfall is above ${RAINFALL_CONSTRAINTS.TYPICAL_HIGH}mm, flooding may reduce yields
3. Optimal rainfall is between ${RAINFALL_CONSTRAINTS.OPTIMAL_LOW}-${RAINFALL_CONSTRAINTS.OPTIMAL_HIGH}mm
Respond with a numeric prediction followed by a brief explanation.`

    let prediction: number;
    let comment: string;

    if (provider === 'anthropic') {
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 150,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
              }
            ]
          }
        ]
      });

      const match = response.content[0].type;
      if (match) {
        prediction = parseFloat(match[1]);
        comment = match[2].trim();
      } else {
        throw new Error('Failed to parse Anthropic response');
      }
    } else if (provider === 'openai') {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      const match = completion.choices[0].message.content;
      if (match) {
        prediction = parseFloat(match[1]);
        comment = match[2].trim();
      } else {
        throw new Error('Failed to parse OpenAI response');
      }
    }
    else if (provider === 'deepseek') {
      const completion = await openai.chat.completions.create({
        model: "deepseek-chat",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      const match = completion.choices[0].message.content;
      if (match) {
        prediction = parseFloat(match[1]);
        comment = match[2].trim();
      } else {
        throw new Error('Failed to parse OpenAI response');
      }
    }
    else if (provider === 'llama') {
      if (!llamaAPI) {
        throw new Error('Llama API not configured - missing API key');
      }
    
      const apiRequestJson = {
        "messages": [
          {"role": "system", "content": systemPrompt},
          {"role": "user", "content": userPrompt},
        ],
        "functions": [
          {
            "name": "predict_yield",
            "description": "Predict farm yield based on rainfall",
            "parameters": {
              "type": "object",
              "properties": {
                "yield": {
                  "type": "number",
                  "description": "Predicted yield in metric tons per hectare",
                },
                "comment": {
                  "type": "string",
                  "description": "Brief explanation of the prediction",
                },
              },
              "required": ["yield", "comment"],
            },
          }
        ],
        "stream": false,
        "function_call": "predict_yield",
      };
    
      try {
        const response = await llamaAPI.api(apiRequestJson);
        const result = JSON.parse(response.choices[0].message.function_call.arguments);
        prediction = result.yield;
        comment = result.comment;
      } catch (error) {
        console.error('Llama API error:', error);
        throw new Error('Failed to get prediction from Llama API');
      }
    } else {
      throw new Error('Invalid provider');
    }

    if (isNaN(prediction) || prediction < YIELD_CONSTRAINTS.MIN || prediction > YIELD_CONSTRAINTS.MAX) {
      throw new Error('Invalid prediction value')
    }

    return NextResponse.json({
      prediction: prediction.toFixed(2),
      comment,
      provider,
      rainfall,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to get prediction'
    }, { status: 500 });
  }
}


import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge'

interface RequestBody {
  rainfall: number
  provider: 'openai' | 'anthropic'
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
  MAX: 6000,
  TYPICAL_LOW: 1000,
  TYPICAL_HIGH: 4000
}

export async function POST(req: Request) {
  try {
    // Parse and validate request
    const body = await req.json() as RequestBody
    const { rainfall, provider } = body

    if (!rainfall || !provider) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof rainfall !== 'number' || rainfall < RAINFALL_CONSTRAINTS.MIN || rainfall > RAINFALL_CONSTRAINTS.MAX) {
      return NextResponse.json({ error: 'Invalid rainfall value' }, { status: 400 })
    }

    if (provider !== 'openai' && provider !== 'anthropic') {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Construct prompts
    const systemPrompt = `You are an AI specialized in Malawian agriculture. Consider these facts:
- Malawi's typical annual rainfall ranges from ${RAINFALL_CONSTRAINTS.TYPICAL_LOW}mm to ${RAINFALL_CONSTRAINTS.TYPICAL_HIGH}mm
- Main crops include maize, tobacco, tea, and sugarcane
- Typical maize yields range from ${YIELD_CONSTRAINTS.TYPICAL_LOW} to ${YIELD_CONSTRAINTS.TYPICAL_HIGH} kg/hectare depending on conditions
- Rainfall is a critical factor in determining yield
Provide numeric predictions in kg/hectare based on rainfall data.`

    const userPrompt = `Given an annual rainfall of ${rainfall}mm in Malawi, predict the farm yield in kg/hectare. Consider:
1. If rainfall is below ${RAINFALL_CONSTRAINTS.TYPICAL_LOW}mm, yields are severely impacted
2. If rainfall is above ${RAINFALL_CONSTRAINTS.TYPICAL_HIGH}mm, flooding may reduce yields
3. Optimal rainfall is between ${RAINFALL_CONSTRAINTS.OPTIMAL_LOW}-${RAINFALL_CONSTRAINTS.OPTIMAL_HIGH}mm
Respond with only a numeric prediction.`

    let prediction: number;

    if (provider === 'anthropic') {
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
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

      prediction = parseFloat(response.content[0].type);
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        
        store: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      prediction = parseFloat(completion.choices[0].message.content || "0");
    }

    // Validate numeric response
    if (isNaN(prediction) || prediction < YIELD_CONSTRAINTS.MIN || prediction > YIELD_CONSTRAINTS.MAX) {
      throw new Error('Invalid prediction value')
    }

    return NextResponse.json({
      prediction: prediction.toFixed(2),
      provider,
      rainfall,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to get prediction'
    }, { status: 500 })
  }
}


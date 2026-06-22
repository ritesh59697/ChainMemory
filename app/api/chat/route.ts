import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not set in server environment.' },
        { status: 500 }
      );
    }

    // Format history for Groq SDK
    const formattedMessages = [
      {
        role: 'system',
        content: 'You are ChainMemory AI, a premium AI agent with persistent, secure memory backed by 0G Storage. Keep your responses concise, intelligent, and engaging.',
      },
      ...(history || []),
    ];

    if (message) {
      formattedMessages.push({ role: 'user', content: message });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: formattedMessages as any,
      model: 'llama-3.3-70b-versatile',
    });

    const reply = chatCompletion.choices[0]?.message?.content || '';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error in Groq Chat API:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate response from AI' },
      { status: 500 }
    );
  }
}

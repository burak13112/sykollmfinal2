import { GoogleGenAI, Chat } from "@google/genai";
import { Message } from '../types';

// We map the "SykoLLM" frontend selection to an actual high-performance Gemini model
// This creates the illusion of the custom model while using robust infrastructure.
const MODEL_MAPPING: Record<string, string> = {
  'syko-v1-alpha': 'gemini-3-flash-preview',
  'syko-v1-pro': 'gemini-3-pro-preview', // Future proofing
};

const SYSTEM_INSTRUCTION = `
You are SykoLLM, an advanced AI model currently in ALPHA stage. 
You are helpful, concise, and intelligent. 
You prefer a modern, somewhat technical but accessible tone. 
Do not mention being made by Google unless explicitly asked about your underlying architecture. 
Focus on solving the user's problem efficiently.
`;

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    if (!process.env.API_KEY) {
      throw new Error("API Key is missing");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const streamResponse = async (
  modelId: string,
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  const client = getClient();
  const realModelName = MODEL_MAPPING[modelId] || 'gemini-3-flash-preview';

  // Convert history to format expected by Chat
  // Note: We don't send the very last user message in the history init, 
  // it is sent via sendMessageStream.
  const previousHistory = history.slice(0, -1).map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const lastMessage = history[history.length - 1];

  const chat: Chat = client.chats.create({
    model: realModelName,
    history: previousHistory,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  try {
    const resultStream = await chat.sendMessageStream({ 
      message: lastMessage.content 
    });

    let fullText = '';
    for await (const chunk of resultStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;

  } catch (error) {
    console.error("SykoLLM API Error:", error);
    throw error;
  }
};
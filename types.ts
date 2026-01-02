export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  tag: string; // e.g., ALPHA, BETA
  description: string;
}

export enum Theme {
  DARK = 'dark',
  LIGHT = 'light',
}
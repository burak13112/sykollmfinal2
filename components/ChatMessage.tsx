import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Icons } from './Icon';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`w-full animate-slide-up ${isUser ? 'bg-transparent' : 'bg-black/5 dark:bg-white/5 border-y border-black/5 dark:border-white/5'}`}>
      <div className="max-w-3xl mx-auto py-8 px-4 md:px-6 flex gap-4 md:gap-6">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser 
            ? 'bg-black text-white dark:bg-white dark:text-black' 
            : 'bg-gradient-to-br from-gray-700 to-black text-white dark:from-gray-200 dark:to-white dark:text-black'
        }`}>
          {isUser ? <Icons.Terminal size={16} /> : <Icons.Cpu size={16} />}
        </div>

        <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm tracking-wide">
              {isUser ? 'YOU' : 'SYKO LLM'}
            </span>
            {!isUser && (
              <span className="text-[10px] bg-red-600 text-white px-1 rounded font-bold uppercase">
                ALPHA
              </span>
            )}
          </div>
          
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-pre:bg-black/10 dark:prose-pre:bg-black prose-pre:rounded-lg">
             <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { Message, ChatSession, ModelConfig, Theme } from './types';
import { streamResponse } from './services/sykoService';
import { Icons } from './components/Icon';
import { ModelSelector } from './components/ModelSelector';
import { ChatMessage } from './components/ChatMessage';

const MODELS: ModelConfig[] = [
  { id: 'syko-v1-alpha', name: 'SykoLLM', tag: 'ALPHA', description: 'Our fastest, most efficient model for general tasks.' },
  { id: 'syko-v1-pro', name: 'SykoLLM Pro', tag: 'PREVIEW', description: 'Enhanced reasoning capabilities for complex problems.' },
];

export default function App() {
  // State
  const [theme, setTheme] = useState<Theme>(Theme.DARK);
  const [input, setInput] = useState('');
  const [currentModel, setCurrentModel] = useState(MODELS[0].id);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize
  useEffect(() => {
    // Load Theme
    const savedTheme = localStorage.getItem('syko-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme;
    }

    // Load Sessions
    const savedSessions = localStorage.getItem('syko-sessions');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      // Don't auto-load a session, start fresh by default or load last used?
      // Let's start fresh to keep it clean.
    }
  }, []);

  // Persist Sessions
  useEffect(() => {
    localStorage.setItem('syko-sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const toggleTheme = () => {
    const newTheme = theme === Theme.DARK ? Theme.LIGHT : Theme.DARK;
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    localStorage.setItem('syko-theme', newTheme);
  };

  const createNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const saveCurrentSession = (updatedMessages: Message[]) => {
    if (updatedMessages.length === 0) return;

    const title = updatedMessages[0].content.slice(0, 30) + (updatedMessages[0].content.length > 30 ? '...' : '');
    
    if (!currentSessionId) {
      const newId = Date.now().toString();
      const newSession: ChatSession = {
        id: newId,
        title,
        messages: updatedMessages,
        createdAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
    } else {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: updatedMessages, title: s.title === 'New Chat' ? title : s.title }
          : s
      ));
    }
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      createNewSession();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    // Save immediately so we don't lose user prompt
    saveCurrentSession(newMessages);

    try {
      // Optimistic AI message
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        role: 'model',
        content: '',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, initialAiMsg]);

      await streamResponse(currentModel, newMessages, (chunk) => {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMsgId 
            ? { ...msg, content: msg.content + chunk }
            : msg
        ));
      });

      // Update session with final response
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
           // We need to get the latest state of messages here effectively
           // Since setMessages is async, let's grab the latest state updater logic or simpler:
           // We trigger a re-save after streaming is done using the current functional state
           return s; 
        }
        return s;
      }));
      
    } catch (error) {
       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: 'model',
         content: "Connection to SykoLLM Alpha failed. Please check your network or try again.",
         timestamp: Date.now(),
         isError: true
       }]);
    } finally {
      setIsTyping(false);
      // Final save to capture the full AI response in storage
      // Note: In a real app we'd use a better state sync, but for this simpler version:
      // We rely on the effect hook on 'messages' or manually sync here.
      // Let's rely on user action or next render cycle for perfect consistency, 
      // but to ensure persistence, we force update the session in the sessions array:
      setSessions(prevSessions => {
         // This is a bit tricky inside the async closure, but sufficient for this demo
         // to update the session with the latest messages state content if we had access to it easily.
         // Instead, we will let the user 'Save' manually or auto-save on next interaction.
         return prevSessions; 
      });
    }
  };

  // Sync messages to current session when messages change (Auto-save mechanism)
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages } : s
      ));
    }
  }, [messages, currentSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-black text-black dark:text-white font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-gray-50 dark:bg-syko-dark border-r border-black/10 dark:border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={createNewSession}
            className="flex-1 flex items-center gap-2 px-4 py-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg hover:border-black/30 dark:hover:border-white/30 transition-all shadow-sm hover:shadow-md group"
          >
            <Icons.Plus size={18} className="group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">New Chat</span>
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden ml-2 p-2 opacity-50">
            <Icons.Close size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 pb-2 text-xs font-bold opacity-40 uppercase tracking-widest">History</div>
          {sessions.length === 0 && (
            <div className="text-center py-10 opacity-30 text-sm">
              No saved chats yet.
            </div>
          )}
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => loadSession(session)}
              className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors text-sm ${
                currentSessionId === session.id 
                  ? 'bg-black/10 dark:bg-white/10 font-medium' 
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Icons.Chat size={14} />
                <span className="truncate">{session.title}</span>
              </div>
              <button 
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
              >
                <Icons.Trash size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 space-y-2">
           <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-medium"
          >
            {theme === Theme.DARK ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
            <span>{theme === Theme.DARK ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <div className="flex items-center gap-3 px-3 py-2 opacity-50">
             <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
               S
             </div>
             <span className="text-xs font-mono">SykoLLM v1.02</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full">
        
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-10 backdrop-blur-md bg-white/80 dark:bg-black/80 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2">
               <Icons.Menu size={20} />
            </button>
            <div className="font-bold text-lg tracking-tight flex items-center gap-2">
              SykoLLM
              <span className="text-[10px] bg-black text-white dark:bg-white dark:text-black px-1.5 py-0.5 rounded font-mono uppercase">Beta</span>
            </div>
          </div>
          
          <ModelSelector 
            currentModel={currentModel} 
            models={MODELS} 
            onSelect={setCurrentModel} 
          />
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto pt-20 pb-4 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-0 animate-fade-in">
              <div className="w-16 h-16 bg-black dark:bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                 <Icons.Cpu size={32} className="text-white dark:text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to SykoLLM</h2>
              <p className="opacity-60 max-w-md">
                Experience the power of our Alpha model. Fast, efficient, and strictly minimal.
              </p>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {["Explain quantum computing", "Write a python script", "Analyze this logic", "Write a poem about darkness"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      // Slight timeout to allow state update before submit if we wanted auto-submit
                      // But just setting input is better UX usually
                    }}
                    className="p-4 rounded-xl border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/5 dark:hover:bg-white/5 text-sm text-left transition-all"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-h-full">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isTyping && (
                <div className="w-full py-6 px-4 md:px-6">
                   <div className="max-w-3xl mx-auto flex gap-4">
                      <div className="w-8 h-8 flex items-center justify-center">
                         <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-0"></div>
                         <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-75 mx-1"></div>
                         <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-150"></div>
                      </div>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black dark:to-transparent z-20">
          <div className="max-w-3xl mx-auto relative group">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to SykoLLM..."
              className="w-full bg-gray-100 dark:bg-syko-gray text-base px-5 py-4 pr-12 rounded-2xl border-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 resize-none max-h-48 overflow-y-auto shadow-sm transition-all placeholder:opacity-50"
              style={{ minHeight: '56px' }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isTyping}
              className="absolute right-3 bottom-3 p-2 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-80 disabled:opacity-0 disabled:scale-75 transition-all duration-200 shadow-md"
            >
              <Icons.Send size={18} />
            </button>
          </div>
          <div className="text-center mt-3">
             <p className="text-[10px] opacity-40 font-mono">SykoLLM Alpha may produce inaccurate information.</p>
          </div>
        </div>

      </main>
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { ModelConfig } from '../types';
import { Icons } from './Icon';

interface ModelSelectorProps {
  currentModel: string;
  onSelect: (id: string) => void;
  models: ModelConfig[];
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onSelect, models }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = models.find(m => m.id === currentModel) || models[0];

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition-colors"
      >
        <Icons.Cpu size={14} className="opacity-60" />
        <span className="font-semibold tracking-tight">{selected.name}</span>
        <span className="text-[10px] bg-black text-white dark:bg-white dark:text-black px-1.5 py-0.5 rounded uppercase font-bold">
          {selected.tag}
        </span>
        <Icons.ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 right-0 md:left-0 bg-white dark:bg-syko-gray border border-black/10 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-fade-in">
          <div className="p-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg flex flex-col gap-1 transition-colors ${
                  currentModel === model.id 
                    ? 'bg-black/5 dark:bg-white/10' 
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm">{model.name}</span>
                  <span className="text-[10px] border border-current px-1 rounded opacity-70">{model.tag}</span>
                </div>
                <p className="text-xs opacity-60 truncate">{model.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
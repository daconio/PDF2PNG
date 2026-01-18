import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { Button } from './Button';

interface PageSelectionModalProps {
  fileName: string;
  totalPageCount: number;
  onConfirm: (pages: number[]) => void;
  onCancel: () => void;
  translations: {
    title: string;
    desc: string;
    placeholder: string;
    convert: string;
    cancel: string;
    invalid: string;
    selectAll: string;
  };
}

// Helper function to parse page ranges (e.g., "1-3, 5")
const parsePageInput = (input: string, totalCount: number): number[] => {
  const pages = new Set<number>();
  // Allow spaces, commas, semicolons as delimiters
  const parts = input.split(/[,;\s]+/).map(p => p.trim());
  
  for (const part of parts) {
    if (!part) continue;
    
    if (part.includes('-')) {
      const ranges = part.split('-').map(s => s.trim());
      // Ensure we have exactly start and end parts
      if (ranges.length >= 2) {
        const start = parseInt(ranges[0], 10);
        const end = parseInt(ranges[1], 10);
        
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let i = min; i <= max; i++) pages.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) pages.add(num);
    }
  }
  
  // Return sorted unique valid pages
  return Array.from(pages)
    .filter(p => p >= 1 && p <= totalCount)
    .sort((a, b) => a - b);
};

export const PageSelectionModal: React.FC<PageSelectionModalProps> = ({ 
  fileName, 
  totalPageCount, 
  onConfirm, 
  onCancel,
  translations 
}) => {
  const [input, setInput] = useState(`1-${totalPageCount}`);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use the shared parsing logic for real-time feedback
  const validPages = useMemo(() => 
    parsePageInput(input, totalPageCount), 
  [input, totalPageCount]);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = () => {
    if (validPages.length === 0) {
      setError(translations.invalid);
      return;
    }
    onConfirm(validPages);
  };

  const formatPagePreview = (pages: number[]) => {
    if (pages.length === 0) return '';
    if (pages.length <= 10) return pages.join(', ');
    return `${pages.slice(0, 10).join(', ')}, ... (+${pages.length - 10} more)`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-black shadow-neo-lg w-full max-w-lg p-6 rounded-xl flex flex-col relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-black/10">
          <div className="p-2 bg-primary border-2 border-black rounded shadow-neo-sm">
            <Layers size={20} className="text-black" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold uppercase leading-none">{translations.title}</h3>
          </div>
        </div>

        <div className="bg-gray-50 border border-black/20 rounded-lg p-3 mb-6 flex justify-between items-center">
          <div className="truncate pr-4">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">File</p>
             <p className="font-bold text-black truncate">{fileName}</p>
          </div>
          <div className="text-right shrink-0">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Pages</p>
             <p className="font-bold text-black">{totalPageCount}</p>
          </div>
        </div>

        <div className="mb-1 flex justify-between items-center">
            <label className="text-sm font-bold text-black uppercase">Range / Numbers</label>
            <div className="group relative">
                <HelpCircle size={14} className="text-gray-400 cursor-help" />
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-black text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Use dashes for ranges (1-5) and commas for individual pages (1, 3, 5).
                </div>
            </div>
        </div>

        <div className="relative mb-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            className={`w-full border-2 border-black p-4 rounded-lg font-mono text-lg focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all ${error ? 'bg-red-50 border-red-500' : 'bg-white'}`}
            placeholder={translations.placeholder}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {error && (
            <div className="absolute top-full left-0 mt-2 flex items-center gap-1 text-red-600 text-xs font-bold animate-pulse">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Selected Page Preview */}
        <div className="mb-8 min-h-[1.5rem]">
           {validPages.length > 0 ? (
             <div className="text-xs text-gray-600">
                <span className="flex items-center gap-1 font-bold text-green-700 mb-1">
                    <Check size={12} />
                    {validPages.length} pages selected
                </span>
                <p className="font-mono text-gray-500 break-words leading-tight">
                    {formatPagePreview(validPages)}
                </p>
             </div>
           ) : (
             <p className="text-xs text-gray-400 italic">No valid pages selected</p>
           )}
        </div>

        <div className="flex justify-between items-center mt-auto pt-4 border-t-2 border-black/5">
          <button 
             onClick={() => { setInput(`1-${totalPageCount}`); setError(''); inputRef.current?.focus(); }}
             className="text-xs font-bold underline hover:text-primary transition-colors text-gray-500 hover:text-black"
          >
             {translations.selectAll}
          </button>
          
          <div className="flex gap-3">
             <Button variant="secondary" onClick={onCancel} size="sm">
               {translations.cancel}
             </Button>
             <Button onClick={handleSubmit} size="sm" disabled={validPages.length === 0}>
               {translations.convert}
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, AlertCircle, Check } from 'lucide-react';
import { Button } from './Button';

interface PageSelectionModalProps {
  fileName: string;
  fileSize?: number;
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
    // New optional keys for detailed validation
    empty?: string;
    outOfRange?: string;
    invalidChar?: string;
  };
}

interface ValidationResult {
    pages: number[];
    errorKey: 'empty' | 'invalid' | 'outOfRange' | 'invalidChar' | null;
    errorParam: string | number | null;
}

// Robust validation and parsing logic
const validateAndParse = (input: string, totalCount: number): ValidationResult => {
    if (!input.trim()) return { pages: [], errorKey: 'empty', errorParam: null };
  
    // Normalize input: "1 - 3" -> "1-3"
    const normalized = input.replace(/\s*-\s*/g, '-');
    const parts = normalized.split(/[,;\s]+/).map(p => p.trim()).filter(p => p);
    const pages = new Set<number>();
  
    for (const part of parts) {
      // Check for allowed characters (digits and hyphen)
      if (/[^\d-]/.test(part)) {
          return { pages: [], errorKey: 'invalidChar', errorParam: part };
      }
  
      if (part.includes('-')) {
          const ranges = part.split('-');
          // Handle cases like "1-" or "-1" or "1-2-3"
          if (ranges.length !== 2 || !ranges[0] || !ranges[1]) {
               return { pages: [], errorKey: 'invalid', errorParam: part };
          }
  
          const start = parseInt(ranges[0], 10);
          const end = parseInt(ranges[1], 10);
  
          if (isNaN(start) || isNaN(end)) return { pages: [], errorKey: 'invalid', errorParam: part };
          
          const min = Math.min(start, end);
          const max = Math.max(start, end);
  
          if (min < 1) return { pages: [], errorKey: 'outOfRange', errorParam: min };
          if (max > totalCount) return { pages: [], errorKey: 'outOfRange', errorParam: max };
  
          for (let i = min; i <= max; i++) pages.add(i);
      } else {
          const num = parseInt(part, 10);
          if (isNaN(num)) return { pages: [], errorKey: 'invalid', errorParam: part };
          if (num < 1) return { pages: [], errorKey: 'outOfRange', errorParam: num };
          if (num > totalCount) return { pages: [], errorKey: 'outOfRange', errorParam: num };
          pages.add(num);
      }
    }
  
    return { 
        pages: Array.from(pages).sort((a,b)=>a-b), 
        errorKey: null, 
        errorParam: null 
    };
};

export const PageSelectionModal: React.FC<PageSelectionModalProps> = ({ 
  fileName, 
  fileSize,
  totalPageCount, 
  onConfirm, 
  onCancel,
  translations 
}) => {
  const [input, setInput] = useState(`1-${totalPageCount}`);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Real-time validation for preview
  const { pages, errorKey, errorParam } = useMemo(() => 
    validateAndParse(input, totalPageCount), 
  [input, totalPageCount]);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const getLocalizedError = () => {
      if (!errorKey) return '';
      switch (errorKey) {
          case 'empty': 
             return translations.empty || "Please enter page numbers.";
          case 'invalidChar': 
             return (translations.invalidChar || "Invalid character: {c}").replace('{c}', String(errorParam));
          case 'outOfRange': 
             return (translations.outOfRange || "Page {n} out of range.").replace('{n}', String(errorParam)).replace('{t}', String(totalPageCount));
          case 'invalid': 
             return translations.invalid;
          default: 
             return translations.invalid;
      }
  };

  const handleSubmit = () => {
    // If there is an existing validation error or no pages selected
    if (errorKey || pages.length === 0) {
      setErrorMessage(getLocalizedError() || translations.invalid);
      return;
    }
    onConfirm(pages);
  };

  const formatPagePreview = (pageList: number[]) => {
    if (pageList.length === 0) return '';
    if (pageList.length <= 10) return pageList.join(', ');
    return `${pageList.slice(0, 10).join(', ')}, ... (+${pageList.length - 10} more)`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-black shadow-neo-lg w-full max-w-lg p-6 rounded-xl flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-black/10">
          <div className="p-2 bg-primary border-2 border-black rounded shadow-neo-sm">
            <Layers size={20} className="text-black" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold uppercase leading-none">{translations.title}</h3>
          </div>
        </div>

        {/* File Info */}
        <div className="bg-gray-50 border border-black/20 rounded-lg p-3 mb-6 flex justify-between items-center">
          <div className="truncate pr-4">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">File</p>
             <p className="font-bold text-black truncate">{fileName}</p>
             {fileSize && <p className="text-[10px] text-gray-400 font-mono">{(fileSize / 1024 / 1024).toFixed(2)} MB</p>}
          </div>
          <div className="text-right shrink-0">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Pages</p>
             <p className="font-bold text-black">{totalPageCount}</p>
          </div>
        </div>

        {/* Description Label & Select All */}
        <div className="mb-2 flex justify-between items-end">
            <div>
                <label className="text-sm font-bold text-black uppercase block mb-1">Selection</label>
                <p className="text-sm text-gray-600 leading-snug">{translations.desc}</p>
            </div>
            <button 
                onClick={() => { setInput(`1-${totalPageCount}`); setErrorMessage(''); inputRef.current?.focus(); }}
                className="text-xs font-bold text-primary hover:text-primary-hover underline decoration-2 underline-offset-2 mb-1"
                type="button"
            >
                {translations.selectAll}
            </button>
        </div>

        {/* Input Area */}
        <div className="relative mb-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setErrorMessage(''); }}
            className={`w-full border-2 border-black p-4 rounded-lg font-mono text-lg focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all ${errorMessage ? 'bg-red-50 border-red-500' : 'bg-white'}`}
            placeholder={translations.placeholder}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />

          {errorMessage && (
            <div className="absolute top-full left-0 mt-2 flex items-center gap-1 text-red-600 text-xs font-bold animate-pulse">
              <AlertCircle size={12} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Selected Page Preview */}
        <div className="mb-8 min-h-[1.5rem]">
           {pages.length > 0 && !errorKey ? (
             <div className="text-xs text-gray-600">
                <span className="flex items-center gap-1 font-bold text-green-700 mb-1">
                    <Check size={12} />
                    {pages.length} pages selected
                </span>
                <p className="font-mono text-gray-500 break-words leading-tight">
                    {formatPagePreview(pages)}
                </p>
             </div>
           ) : (
             <p className="text-xs text-gray-400 italic">
                {input.trim() ? "..." : "No valid pages selected"}
             </p>
           )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center mt-auto pt-4 border-t-2 border-black/5 gap-3">
             <Button variant="secondary" onClick={onCancel} size="sm">
               {translations.cancel}
             </Button>
             <Button onClick={handleSubmit} size="sm" disabled={pages.length === 0 || !!errorKey}>
               {translations.convert}
             </Button>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PptxSlide, PptxElement } from '../types';
import { Button } from './Button';
import { Download, ChevronLeft, ChevronRight, Save, Type, Image as ImageIcon, Eye, EyeOff, Loader2 } from 'lucide-react';

interface PptxEditorProps {
  slides: PptxSlide[];
  totalFiles?: number; // Total expected pages
  onDownload: (updatedSlides: PptxSlide[]) => void;
  onCancel: () => void;
}

export const PptxEditor: React.FC<PptxEditorProps> = ({ slides, totalFiles, onDownload, onCancel }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [editedSlides, setEditedSlides] = useState<PptxSlide[]>(JSON.parse(JSON.stringify(slides)));
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [dimBackground, setDimBackground] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync prop 'slides' to state 'editedSlides' when new slides stream in
  useEffect(() => {
    if (slides.length > editedSlides.length) {
        // Only append the new slides
        const newSlides = slides.slice(editedSlides.length);
        setEditedSlides(prev => [...prev, ...JSON.parse(JSON.stringify(newSlides))]);
    }
  }, [slides]);

  const currentSlide = editedSlides[currentSlideIndex];
  const isProcessing = totalFiles && editedSlides.length < totalFiles;

  // Calculate dynamic dimensions for the editor canvas
  const slideDimensions = useMemo(() => {
    if (!currentSlide) return { width: 1000, height: 562.5 };
    
    // Default max dimensions for the view area
    const MAX_WIDTH = 1000;
    const MAX_HEIGHT = 700;
    
    const aspect = currentSlide.width / currentSlide.height;
    
    let width = MAX_WIDTH;
    let height = width / aspect;
    
    if (height > MAX_HEIGHT) {
        height = MAX_HEIGHT;
        width = height * aspect;
    }
    
    return { width, height };
  }, [currentSlide]);

  const updateElement = (id: string, updates: Partial<PptxElement>) => {
    setEditedSlides(prev => {
      const newSlides = [...prev];
      const slide = newSlides[currentSlideIndex];
      const elIndex = slide.elements.findIndex(e => e.id === id);
      if (elIndex !== -1) {
        slide.elements[elIndex] = { ...slide.elements[elIndex], ...updates };
      }
      return newSlides;
    });
  };

  const handleDelete = (id: string) => {
    setEditedSlides(prev => {
        const newSlides = [...prev];
        const slide = newSlides[currentSlideIndex];
        slide.elements = slide.elements.filter(e => e.id !== id);
        return newSlides;
    });
    setSelectedElementId(null);
  };

  if (!currentSlide) {
      return (
          <div className="flex h-screen items-center justify-center bg-gray-100 absolute inset-0 z-50">
              <div className="text-center">
                <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
                <h2 className="text-xl font-bold">Initializing Editor...</h2>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 absolute inset-0 z-50 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Slide Editor</h2>
          <span className="text-sm font-bold bg-black text-white px-2 py-1 rounded">
             Slide {currentSlideIndex + 1} / {totalFiles || editedSlides.length}
          </span>
          {/* Dim Toggle for checking extraction */}
          <button 
             onClick={() => setDimBackground(!dimBackground)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded border-2 border-black text-sm font-bold transition-all ${dimBackground ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
          >
             {dimBackground ? <EyeOff size={16}/> : <Eye size={16}/>}
             {dimBackground ? 'Show Original' : 'Dim Background'}
          </button>
        </div>
        <div className="flex gap-2 items-center">
            {isProcessing && (
                <div className="flex items-center gap-2 mr-2 text-sm font-medium text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing {editedSlides.length}/{totalFiles}...
                </div>
            )}
            <Button variant="outline" onClick={onCancel} size="sm">Cancel</Button>
            <Button onClick={() => onDownload(editedSlides)} size="sm">
                <Download size={18} className="mr-2"/> Download PPTX
            </Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for Navigation */}
        <div ref={scrollRef} className="w-48 bg-gray-50 border-r-2 border-black overflow-y-auto p-4 space-y-4 hidden md:block">
            {editedSlides.map((slide, idx) => (
                <div 
                    key={slide.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`border-2 cursor-pointer transition-all hover:scale-105 ${idx === currentSlideIndex ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-gray-300'}`}
                >
                    <div className="relative w-full bg-white" style={{ aspectRatio: `${slide.width}/${slide.height}` }}>
                        <img src={slide.backgroundImage} className="w-full h-full object-contain opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                        </div>
                    </div>
                </div>
            ))}
            
            {/* Sidebar Loading Indicator */}
            {isProcessing && (
                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-white/50">
                    <Loader2 size={24} className="animate-spin text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500 font-medium text-center">Analyzing next slide...</span>
                </div>
            )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 overflow-auto relative">
           
           {/* Navigation Arrows */}
           <button 
             disabled={currentSlideIndex === 0}
             onClick={() => setCurrentSlideIndex(p => p - 1)}
             className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white border-2 border-black p-2 rounded-full shadow-neo hover:bg-gray-100 disabled:opacity-30"
           >
             <ChevronLeft size={24} />
           </button>
           <button 
             disabled={currentSlideIndex === editedSlides.length - 1}
             onClick={() => setCurrentSlideIndex(p => p + 1)}
             className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white border-2 border-black p-2 rounded-full shadow-neo hover:bg-gray-100 disabled:opacity-30"
           >
             <ChevronRight size={24} />
           </button>

           {/* The Slide */}
           <div 
             className="bg-white shadow-2xl relative border border-gray-400 select-none transition-all duration-300 ease-in-out"
             style={{ 
                 width: `${slideDimensions.width}px`, 
                 height: `${slideDimensions.height}px`,
             }}
             onClick={() => setSelectedElementId(null)}
           >
             {/* Background Layer */}
             <div 
                className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
                style={{
                    backgroundImage: `url(${currentSlide.backgroundImage})`,
                    backgroundSize: '100% 100%', // Ensure exact fit
                    backgroundRepeat: 'no-repeat',
                    opacity: dimBackground ? 0.3 : 1.0
                }}
             />

             {/* Elements Layer */}
             {currentSlide.elements.length === 0 && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="bg-red-100 text-red-600 border border-red-400 px-3 py-1 rounded font-bold text-sm">
                         No text/images extracted. Try checking the "Dim Background" to see the original.
                     </span>
                 </div>
             )}

             {currentSlide.elements.map(el => {
                 const isSelected = selectedElementId === el.id;
                 return (
                    <div
                        key={el.id}
                        // Click on wrapper triggers selection, unless it's already selected text (handled by textarea)
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!isSelected) setSelectedElementId(el.id); 
                        }}
                        className={`absolute transition-all group ${
                            isSelected 
                            ? 'z-20' 
                            : 'z-10 hover:z-20'
                        }`}
                        style={{
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            width: `${el.w}%`,
                            height: `${el.h}%`,
                        }}
                    >
                        {el.type === 'text' ? (
                            isSelected ? (
                                <textarea
                                    autoFocus
                                    value={el.content}
                                    onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                    className="w-full h-full resize-none bg-white p-2 text-sm focus:outline-none text-black border-2 border-blue-500 shadow-lg rounded"
                                    style={{ 
                                        fontSize: `${Math.max(12, (el.style?.fontSize || 12) * 1.3)}px`, 
                                        lineHeight: '1.2'
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Allow clicking inside textarea
                                    onKeyDown={(e) => e.stopPropagation()} // Prevent global hotkeys
                                />
                            ) : (
                                <div 
                                    className="w-full h-full p-1 border border-dashed border-blue-300/0 group-hover:border-blue-500 group-hover:bg-blue-50/20 cursor-pointer overflow-hidden whitespace-pre-wrap"
                                    title="Click to edit text"
                                >
                                    {/* Invisible text filler to maintain layout structure if needed, or just visual indicator */}
                                    <div className="w-full h-full bg-transparent" />
                                </div>
                            )
                        ) : (
                            // Image Element
                            <div className={`w-full h-full relative ${isSelected ? 'border-2 border-blue-500 shadow-lg' : 'group-hover:border group-hover:border-dashed group-hover:border-blue-400'}`}>
                                <img src={el.image} className="w-full h-full object-contain" />
                                {isSelected && (
                                    <div className="absolute top-0 right-0 bg-blue-500 text-white p-1 text-xs font-bold">Image</div>
                                )}
                            </div>
                        )}
                        
                        {/* Delete Button (Visible on Selection) */}
                        {isSelected && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(el.id); }}
                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600 z-30 flex items-center justify-center hover:scale-110 transition-transform"
                                title="Delete element"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>
                 );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};

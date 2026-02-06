import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PptxSlide, PptxElement } from '../types';
import { Button } from './Button';
import { Download, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Save } from 'lucide-react';

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
  const [showOverlays, setShowOverlays] = useState(true); // Default to true so users see extracted text
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync prop 'slides' to state 'editedSlides' when new slides stream in
  useEffect(() => {
    if (slides.length > editedSlides.length) {
        // Only append the new slides, deeply cloning them to avoid reference issues
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
      // Create a deep copy of the structure we are modifying to ensure React detects state changes
      const newSlides = [...prev];
      const slideIndex = currentSlideIndex;
      
      if (!newSlides[slideIndex]) return prev;

      const slide = { ...newSlides[slideIndex] };
      const elements = [...slide.elements];
      
      const elIndex = elements.findIndex(e => e.id === id);
      if (elIndex !== -1) {
        elements[elIndex] = { ...elements[elIndex], ...updates };
        slide.elements = elements;
        newSlides[slideIndex] = slide;
      }
      
      return newSlides;
    });
  };

  const handleDelete = (id: string) => {
    setEditedSlides(prev => {
        const newSlides = [...prev];
        const slide = { ...newSlides[currentSlideIndex] };
        slide.elements = slide.elements.filter(e => e.id !== id);
        newSlides[currentSlideIndex] = slide;
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

  // Helper to calculate font size
  const getFontSize = (el: PptxElement) => {
      // Calculate visual height of the box in pixels
      const boxHeightPx = (el.h / 100) * slideDimensions.height;
      
      // AI estimate (pt) converted to screen px (approx)
      // We scale it based on the current view ratio vs original PDF
      const scaleFactor = slideDimensions.width / currentSlide.width;
      const aiFontSizePx = (el.style?.fontSize || 12) * scaleFactor * 1.5; // Multiplier for readability

      // Heuristic: Font size shouldn't exceed the box height usually, but shouldn't be microscopic
      // We prioritize the box height if the AI guess seems wildly off
      const fitSize = boxHeightPx * 0.75; // 75% of box height

      // Return valid pixel string. Use fitSize if AI size is missing or too small/large
      if (!aiFontSizePx || aiFontSizePx < 8) return `${Math.max(10, fitSize)}px`;
      
      return `${Math.max(10, aiFontSizePx)}px`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 absolute inset-0 z-50 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Slide Editor</h2>
          <span className="text-sm font-bold bg-black text-white px-2 py-1 rounded">
             Slide {currentSlideIndex + 1} / {totalFiles || editedSlides.length}
          </span>
          {/* Toggle for Overlays */}
          <button 
             onClick={() => setShowOverlays(!showOverlays)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded border-2 border-black text-sm font-bold transition-all ${!showOverlays ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
             title="Toggle Text Overlays"
          >
             {showOverlays ? <Eye size={16}/> : <EyeOff size={16}/>}
             {showOverlays ? 'Hide Text Boxes' : 'Show Text Boxes'}
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
                    // Dim background slightly when overlays are on, to make text pop
                    opacity: showOverlays ? 0.6 : 1.0 
                }}
             />

             {/* Elements Layer */}
             {currentSlide.elements.length === 0 && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="bg-red-100 text-red-600 border border-red-400 px-3 py-1 rounded font-bold text-sm">
                         No text/images extracted.
                     </span>
                 </div>
             )}

             {currentSlide.elements.map(el => {
                 const isSelected = selectedElementId === el.id;
                 const fontSize = getFontSize(el);
                 const textColor = el.style?.color || '#000000';
                 const bgColor = el.style?.bgColor || '#ffffff';
                 
                 // If overlays are hidden and element is not selected, hide it.
                 // This allows viewing the original clean image.
                 if (!showOverlays && !isSelected) return null;

                 return (
                    <div
                        key={el.id}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!isSelected) setSelectedElementId(el.id); 
                        }}
                        className={`absolute transition-all group ${
                            isSelected 
                            ? 'z-[100]' // High z-index to ensure it sits on top of everything when editing
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
                                    value={el.content || ''} // Handle potentially undefined content
                                    onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                    className="w-full h-full resize-none p-1 border-2 border-blue-500 shadow-lg rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 overflow-auto"
                                    style={{ 
                                        fontSize: fontSize,
                                        fontFamily: '"Pretendard", "Nanum Gothic", sans-serif', // Explicit font stack for Korean
                                        color: textColor,
                                        backgroundColor: bgColor
                                    }}
                                    onClick={(e) => e.stopPropagation()} 
                                    onKeyDown={(e) => e.stopPropagation()} 
                                    spellCheck={false}
                                />
                            ) : (
                                <div 
                                    className={`w-full h-full p-0.5 border cursor-pointer overflow-hidden whitespace-pre-wrap transition-colors ${isSelected ? 'border-blue-500' : 'border-blue-300/50 hover:border-blue-500'}`}
                                    title="Click to edit text"
                                    style={{ 
                                        backgroundColor: bgColor 
                                    }}
                                >
                                    <div 
                                        className="w-full h-full break-words leading-tight" 
                                        style={{ 
                                            fontSize: fontSize,
                                            fontFamily: '"Pretendard", "Nanum Gothic", sans-serif',
                                            color: textColor
                                        }}
                                    >
                                        {el.content}
                                    </div>
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
                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600 z-[110] flex items-center justify-center hover:scale-110 transition-transform"
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
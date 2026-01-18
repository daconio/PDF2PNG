import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Save, Undo, Redo, Eraser, Type, Minus, Plus, 
  Crop, RotateCw, SlidersHorizontal, Check, MousePointer2, 
  Pen, Square, Circle as CircleIcon, Slash,
  AlignLeft, AlignCenter, AlignRight, Pipette
} from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

export type ToolMode = 'draw' | 'crop' | 'adjust';

interface ImageEditorProps {
  file: { url: string; name: string };
  onSave: (newBlob: Blob) => void;
  onClose: () => void;
  translations?: any;
  initialMode?: ToolMode;
}

// Font definitions
const FONT_OPTIONS = [
  { label: 'Pretendard', value: '"Pretendard", sans-serif' },
  { label: 'Nanum Gothic', value: '"Nanum Gothic", sans-serif' },
  { label: 'Nanum Myeongjo', value: '"Nanum Myeongjo", serif' },
  { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  { label: 'System (Sans/Gothic)', value: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  { label: 'System (Serif)', value: '"Batang", "Times New Roman", serif' },
];

type DrawingTool = 'eraser' | 'text' | 'pen' | 'line' | 'rect' | 'circle' | 'eyedropper';

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onClose, initialMode = 'draw' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for drawing state to avoid re-renders during mousemove
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  
  // History State
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  
  // Modes
  const [mode, setMode] = useState<ToolMode>(initialMode);
  
  // Drawing State
  const [drawTool, setDrawTool] = useState<DrawingTool>('pen');
  
  // Tool Config
  const [strokeSize, setStrokeSize] = useState(5);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [opacity, setOpacity] = useState(100); // 0-100

  // Text Specific
  const [textSize, setTextSize] = useState(40);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textAlign, setTextAlign] = useState<CanvasTextAlign>('left');
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Crop State
  const [cropSelection, setCropSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null);

  // Adjustment State
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    setCtx(context);

    const img = new Image();
    img.src = file.url;
    img.crossOrigin = "anonymous"; 
    
    img.onload = () => {
      // Set canvas size to match image natural size
      canvas.width = img.width;
      canvas.height = img.height;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.drawImage(img, 0, 0);
      
      // Initialize history
      const initialData = context.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
      setHistoryStep(0);
    };
  }, [file.url]);

  // Focus input when it appears
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  const saveState = (context: CanvasRenderingContext2D = ctx!) => {
    if (!context || !canvasRef.current) return;
    const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Create new history path starting from current step, discarding any "future" states
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    
    // Limit history size to 20 to manage memory
    if (newHistory.length > 20) {
        newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreState = (index: number) => {
      if (!ctx || !canvasRef.current || index < 0 || index >= history.length) return;
      const imageData = history[index];
       
      // Resize canvas if needed (for crop/rotate undo/redo)
      if (canvasRef.current.width !== imageData.width || canvasRef.current.height !== imageData.height) {
        canvasRef.current.width = imageData.width;
        canvasRef.current.height = imageData.height;
      }
      
      ctx.putImageData(imageData, 0, 0);
      setHistoryStep(index);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
        restoreState(historyStep - 1);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
        restoreState(historyStep + 1);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field (like text tool)
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history, ctx]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // --- DRAWING LOGIC ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || !ctx || !canvasRef.current) return;
    
    // Handle Eyedropper Tool
    if (drawTool === 'eyedropper') {
        const { x, y } = getCoordinates(e);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        // Convert [r,g,b] to hex
        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
        setStrokeColor(hex);
        // Automatically switch back to pen for convenience
        setDrawTool('pen');
        return;
    }

    // Handle Text Tool separately
    if (drawTool === 'text') {
        const rect = canvasRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // If an input is already active, commit it before starting a new one
        if (textInput) {
            commitText();
            // Allow immediate placement of next text box
            setTextInput({ x: clickX, y: clickY, value: '' });
        } else {
            // Start new text input
            setTextInput({ x: clickX, y: clickY, value: '' });
        }
        return;
    }

    const { x, y } = getCoordinates(e);
    isDrawingRef.current = true;
    startPosRef.current = { x, y };

    // Setup Context
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeSize;
    ctx.strokeStyle = drawTool === 'eraser' ? '#FFFFFF' : strokeColor;
    ctx.globalAlpha = drawTool === 'eraser' ? 1.0 : opacity / 100;
    
    if (drawTool === 'pen' || drawTool === 'eraser') {
      ctx.moveTo(x, y);
      // Small dot for click
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // For shapes, save state to restore during drag
      snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || mode !== 'draw' || !ctx || !canvasRef.current) return;
    
    const { x, y } = getCoordinates(e);

    if (drawTool === 'pen' || drawTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (snapshotRef.current && startPosRef.current) {
      // Restore before drawing new shape frame
      ctx.putImageData(snapshotRef.current, 0, 0);
      
      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;
      const w = x - startX;
      const h = y - startY;

      ctx.beginPath();
      // Re-apply styles after putImageData
      ctx.lineWidth = strokeSize;
      ctx.strokeStyle = strokeColor;
      ctx.globalAlpha = opacity / 100;

      if (drawTool === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
      } else if (drawTool === 'rect') {
        ctx.rect(startX, startY, w, h);
      } else if (drawTool === 'circle') {
        // Ellipse based on bounding box
        ctx.ellipse(
            startX + w / 2, 
            startY + h / 2, 
            Math.abs(w / 2), 
            Math.abs(h / 2), 
            0, 0, 2 * Math.PI
        );
      }
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (ctx) {
        ctx.closePath();
        ctx.globalAlpha = 1.0; // Reset
      }
      snapshotRef.current = null;
      startPosRef.current = null;
      saveState();
    }
  };

  const commitText = () => {
    if (!textInput || !ctx || !canvasRef.current) {
      setTextInput(null);
      return;
    }

    if (!textInput.value.trim()) {
        setTextInput(null);
        return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = textInput.x * scaleX;
    const y = (textInput.y * scaleY) + (textSize * 0.8); 

    ctx.save();
    ctx.font = `bold ${textSize}px ${fontFamily}`;
    ctx.fillStyle = strokeColor; 
    ctx.textAlign = textAlign;
    ctx.fillText(textInput.value, x, y);
    ctx.restore();
    
    saveState();
    setTextInput(null);
  };

  // --- ROTATE LOGIC ---
  const handleRotate = () => {
    if (!ctx || !canvasRef.current) return;
    const canvas = canvasRef.current;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Rotate 90 degrees clockwise
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((90 * Math.PI) / 180);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    tempCtx.restore();

    // Update main canvas
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);
    
    saveState();
  };

  // --- CROP LOGIC ---
  const startCropSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'crop' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCropStart({ x, y });
    setCropSelection({ x, y, w: 0, h: 0 });
    setIsSelectingCrop(true);
  };

  const updateCropSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingCrop || !cropStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(currentX, cropStart.x);
    const y = Math.min(currentY, cropStart.y);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setCropSelection({ x, y, w, h });
  };

  const endCropSelection = () => {
    setIsSelectingCrop(false);
  };

  const applyCrop = () => {
    if (!cropSelection || !ctx || !canvasRef.current || cropSelection.w < 5 || cropSelection.h < 5) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const sourceX = cropSelection.x * scaleX;
    const sourceY = cropSelection.y * scaleY;
    const sourceW = cropSelection.w * scaleX;
    const sourceH = cropSelection.h * scaleY;

    try {
        const croppedData = ctx.getImageData(sourceX, sourceY, sourceW, sourceH);
        
        canvasRef.current.width = sourceW;
        canvasRef.current.height = sourceH;
        ctx.putImageData(croppedData, 0, 0);
        
        saveState();
        setCropSelection(null);
        setMode('draw');
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  // --- ADJUSTMENT LOGIC ---
  const applyAdjustments = () => {
    if (!ctx || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx?.drawImage(canvas, 0, 0);

    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    saveState();
    setBrightness(100);
    setContrast(100);
    setMode('draw');
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    
    if (mode === 'adjust' && (brightness !== 100 || contrast !== 100)) {
        const canvas = canvasRef.current;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx?.drawImage(canvas, 0, 0);

        if (ctx) {
            ctx.save();
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        }
    }

    canvasRef.current.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  const getInputTransform = () => {
    if (textAlign === 'center') return 'translate(-50%, -50%)';
    if (textAlign === 'right') return 'translate(-100%, -50%)';
    return 'translate(0, -50%)';
  };

  return (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden animate-in fade-in duration-200">
        {/* Header / Toolbar */}
        <div className="bg-gray-50 border-b-2 border-black p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {/* Main Tools */}
            <div className="flex bg-white rounded-lg border border-black shadow-sm overflow-hidden scale-90 md:scale-100 origin-left">
              <Tooltip content="Pen">
                <button onClick={() => { setMode('draw'); setDrawTool('pen'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'pen' ? 'bg-blue-100 text-blue-700' : ''}`}><Pen size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Eraser">
                <button onClick={() => { setMode('draw'); setDrawTool('eraser'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'eraser' ? 'bg-blue-100 text-blue-700' : ''}`}><Eraser size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Line">
                <button onClick={() => { setMode('draw'); setDrawTool('line'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'line' ? 'bg-blue-100 text-blue-700' : ''}`}><Slash size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Rectangle">
                <button onClick={() => { setMode('draw'); setDrawTool('rect'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'rect' ? 'bg-blue-100 text-blue-700' : ''}`}><Square size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Circle">
                <button onClick={() => { setMode('draw'); setDrawTool('circle'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'circle' ? 'bg-blue-100 text-blue-700' : ''}`}><CircleIcon size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Text">
                <button onClick={() => { setMode('draw'); setDrawTool('text'); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'text' ? 'bg-blue-100 text-blue-700' : ''}`}><Type size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Eyedropper">
                <button onClick={() => { setMode('draw'); setDrawTool('eyedropper'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'eyedropper' ? 'bg-blue-100 text-blue-700' : ''}`}><Pipette size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Crop">
                <button onClick={() => { setMode('crop'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'crop' ? 'bg-blue-100 text-blue-700' : ''}`}><Crop size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Adjustments">
                <button onClick={() => { setMode('adjust'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'adjust' ? 'bg-blue-100 text-blue-700' : ''}`}><SlidersHorizontal size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Rotate 90°">
                <button onClick={handleRotate} className="p-2 hover:bg-gray-100 active:bg-gray-200"><RotateCw size={20} /></button>
              </Tooltip>
            </div>

            {/* Contextual Options */}
            {mode === 'draw' && (
               <div className="flex items-center gap-2 bg-white border border-black px-2 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                 
                 {/* Stroke Size for all drawing tools */}
                 {drawTool !== 'eyedropper' && (
                     <>
                        <button onClick={() => drawTool === 'text' ? setTextSize(Math.max(10, textSize - 2)) : setStrokeSize(Math.max(1, strokeSize - 1))} className="p-1 hover:bg-gray-100 rounded"><Minus size={14} /></button>
                        <span className="text-xs font-bold w-6 text-center">{drawTool === 'text' ? textSize : strokeSize}</span>
                        <button onClick={() => drawTool === 'text' ? setTextSize(textSize + 2) : setStrokeSize(strokeSize + 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={14} /></button>
                     </>
                 )}
                 
                 {drawTool !== 'eraser' && drawTool !== 'eyedropper' && (
                    <>
                        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                        <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-6 h-6 border-0 p-0 rounded cursor-pointer" title="Color" />
                    </>
                 )}

                 {/* Opacity for Pen and Shapes */}
                 {drawTool !== 'eraser' && drawTool !== 'text' && drawTool !== 'eyedropper' && (
                    <>
                        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                        <div className="flex flex-col w-16">
                            <label className="text-[8px] font-bold text-gray-500 uppercase leading-none">Opacity</label>
                            <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </>
                 )}

                 {/* Text Tool Options: Alignment & Font */}
                 {drawTool === 'text' && (
                   <>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <div className="flex rounded border border-gray-300 overflow-hidden">
                        <Tooltip content="Align Left">
                            <button onClick={() => setTextAlign('left')} className={`p-1 hover:bg-gray-100 ${textAlign === 'left' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignLeft size={14} /></button>
                        </Tooltip>
                        <Tooltip content="Align Center">
                            <button onClick={() => setTextAlign('center')} className={`p-1 hover:bg-gray-100 ${textAlign === 'center' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignCenter size={14} /></button>
                        </Tooltip>
                        <Tooltip content="Align Right">
                            <button onClick={() => setTextAlign('right')} className={`p-1 hover:bg-gray-100 ${textAlign === 'right' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignRight size={14} /></button>
                        </Tooltip>
                     </div>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="text-xs border border-gray-300 rounded p-1 max-w-[100px] focus:outline-none focus:border-black cursor-pointer">
                       {FONT_OPTIONS.map((opt) => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                     </select>
                   </>
                 )}
                 
                 {/* Eyedropper Message */}
                 {drawTool === 'eyedropper' && (
                     <span className="text-xs font-medium text-gray-500 px-2">Click image to pick color</span>
                 )}
               </div>
            )}

            {mode === 'crop' && (
                <div className="flex gap-2 scale-90 md:scale-100 origin-left">
                    <Button size="sm" onClick={applyCrop} disabled={!cropSelection} className="bg-blue-600 text-white hover:bg-blue-700 py-1 px-2 h-8"><Check size={14} className="mr-1"/> Apply</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setMode('draw'); setCropSelection(null); }} className="py-1 px-2 h-8">Cancel</Button>
                </div>
            )}

            {mode === 'adjust' && (
                 <div className="flex items-center gap-2 md:gap-4 bg-white border border-black px-3 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                    <div className="flex flex-col w-16 md:w-24">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Bright</label>
                        <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="flex flex-col w-16 md:w-24">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Contrast</label>
                        <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-300 mx-1"></div>
                    <Tooltip content="Apply Changes">
                        <button onClick={applyAdjustments} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check size={16} /></button>
                    </Tooltip>
                    <Tooltip content="Cancel">
                        <button onClick={() => { setMode('draw'); setBrightness(100); setContrast(100); }} className="p-1.5 hover:bg-gray-100 rounded"><X size={16} /></button>
                    </Tooltip>
                 </div>
            )}

            <div className="flex gap-1">
                <Tooltip content="Undo">
                    <Button size="sm" variant="secondary" onClick={handleUndo} disabled={historyStep <= 0} className="hidden sm:flex"><Undo size={18} /></Button>
                </Tooltip>
                <Tooltip content="Redo">
                    <Button size="sm" variant="secondary" onClick={handleRedo} disabled={historyStep >= history.length - 1} className="hidden sm:flex"><Redo size={18} /></Button>
                </Tooltip>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose} className="h-9"><X size={16} className="mr-2" /> Cancel</Button>
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white h-9"><Save size={16} className="mr-2" /> Save</Button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="flex-grow overflow-auto bg-gray-200 relative p-8 flex items-center justify-center cursor-crosshair select-none" ref={containerRef}>
          <div 
             className="relative shadow-lg border border-gray-300 bg-white"
             style={{ 
                 width: canvasRef.current ? canvasRef.current.clientWidth : 'auto',
                 height: canvasRef.current ? canvasRef.current.clientHeight : 'auto'
             }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onClick={(e) => drawTool === 'text' && startDrawing(e)}
              className="max-w-none block"
              style={{
                  filter: mode === 'adjust' ? `brightness(${brightness}%) contrast(${contrast}%)` : 'none',
                  pointerEvents: mode === 'crop' ? 'none' : 'auto',
                  cursor: drawTool === 'eyedropper' ? 'crosshair' : 'crosshair'
              }}
            />
            
            {/* Crop Overlay */}
            {mode === 'crop' && (
                <div 
                    className="absolute inset-0 cursor-crosshair z-10"
                    onMouseDown={startCropSelection}
                    onMouseMove={updateCropSelection}
                    onMouseUp={endCropSelection}
                    onMouseLeave={endCropSelection}
                >
                    <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
                    {cropSelection && (
                        <div 
                            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                            style={{ left: cropSelection.x, top: cropSelection.y, width: cropSelection.w, height: cropSelection.h }}
                        >
                            <div className="absolute top-1/3 w-full h-px bg-white/50"></div>
                            <div className="absolute top-2/3 w-full h-px bg-white/50"></div>
                            <div className="absolute left-1/3 h-full w-px bg-white/50"></div>
                            <div className="absolute left-2/3 h-full w-px bg-white/50"></div>
                            <div className="absolute -top-6 left-0 bg-black text-white text-[10px] px-1 py-0.5 rounded">{Math.round(cropSelection.w)} x {Math.round(cropSelection.h)}</div>
                        </div>
                    )}
                    {!cropSelection && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="bg-black/70 text-white px-3 py-1 rounded text-sm flex items-center gap-2"><MousePointer2 size={14} /> Drag to crop</span></div>
                    )}
                </div>
            )}

            {/* Text Input Overlay */}
            {textInput && (
              <div style={{ position: 'absolute', left: textInput.x, top: textInput.y, transform: getInputTransform(), zIndex: 20 }}>
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => e.key === 'Enter' && commitText()}
                  className="bg-transparent border-b-2 border-blue-500 outline-none p-0 font-bold"
                  style={{ 
                      fontSize: `${textSize}px`, 
                      minWidth: '50px', 
                      width: `${Math.max(50, (textInput.value.length + 1) * (textSize * 0.6))}px`,
                      fontFamily: fontFamily.replace(/"/g, ''), 
                      color: strokeColor,
                      textAlign: textAlign as any
                  }}
                  placeholder="Type..."
                />
              </div>
            )}
          </div>
        </div>
    </div>
  );
};
import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Save, Undo, Eraser, Type, Minus, Plus, 
  Crop, RotateCw, SlidersHorizontal, Check, MousePointer2, Palette 
} from 'lucide-react';
import { Button } from './Button';

interface ImageEditorProps {
  file: { url: string; name: string };
  onSave: (newBlob: Blob) => void;
  onClose: () => void;
  translations?: any;
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

type ToolMode = 'draw' | 'crop' | 'adjust';
type DrawingTool = 'eraser' | 'text';

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  
  // Modes
  const [mode, setMode] = useState<ToolMode>('draw');
  
  // Drawing State
  const [drawTool, setDrawTool] = useState<DrawingTool>('eraser');
  const [eraserSize, setEraserSize] = useState(20);
  const [textSize, setTextSize] = useState(40);
  const [textColor, setTextColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [isDrawing, setIsDrawing] = useState(false);
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
      context.drawImage(img, 0, 0);
      saveState(context); 
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
    setHistory((prev) => [...prev.slice(-10), imageData]); 
  };

  const handleUndo = () => {
    if (history.length <= 1 || !ctx || !canvasRef.current) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previousState = newHistory[newHistory.length - 1];
    
    // Resize canvas to match history state (important if rotated or cropped)
    if (canvasRef.current.width !== previousState.width || canvasRef.current.height !== previousState.height) {
        canvasRef.current.width = previousState.width;
        canvasRef.current.height = previousState.height;
    }
    
    ctx.putImageData(previousState, 0, 0);
    setHistory(newHistory);
  };

  // --- DRAWING LOGIC ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || drawTool !== 'eraser' || !ctx) return;
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'draw' || drawTool !== 'eraser' || !ctx || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || drawTool !== 'text' || textInput) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setTextInput({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      value: ''
    });
  };

  const commitText = () => {
    if (!textInput || !ctx || !canvasRef.current || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = textInput.x * scaleX;
    const y = (textInput.y * scaleY) + (textSize * 0.8); 

    ctx.font = `bold ${textSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.fillText(textInput.value, x, y);
    
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

    // Calculate selection rectangle relative to viewport display size
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
    
    // Apply pending adjustments if user clicks save while in adjust mode
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

  return (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden animate-in fade-in duration-200">
        {/* Header / Toolbar */}
        <div className="bg-gray-50 border-b-2 border-black p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {/* Main Tools */}
            <div className="flex bg-white rounded-lg border border-black shadow-sm overflow-hidden scale-90 md:scale-100 origin-left">
              <button 
                 onClick={() => { setMode('draw'); setDrawTool('eraser'); setTextInput(null); }}
                 className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'eraser' ? 'bg-blue-100 text-blue-700' : ''}`}
                 title="Eraser"
              >
                <Eraser size={20} />
              </button>
              <div className="w-[1px] bg-gray-200"></div>
              <button 
                 onClick={() => { setMode('draw'); setDrawTool('text'); }}
                 className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'text' ? 'bg-blue-100 text-blue-700' : ''}`}
                 title="Text"
              >
                <Type size={20} />
              </button>
              <div className="w-[1px] bg-gray-200"></div>
              <button 
                 onClick={() => { setMode('crop'); setTextInput(null); }}
                 className={`p-2 hover:bg-gray-100 ${mode === 'crop' ? 'bg-blue-100 text-blue-700' : ''}`}
                 title="Crop"
              >
                <Crop size={20} />
              </button>
              <div className="w-[1px] bg-gray-200"></div>
              <button 
                 onClick={() => { setMode('adjust'); setTextInput(null); }}
                 className={`p-2 hover:bg-gray-100 ${mode === 'adjust' ? 'bg-blue-100 text-blue-700' : ''}`}
                 title="Adjustments"
              >
                <SlidersHorizontal size={20} />
              </button>
              <div className="w-[1px] bg-gray-200"></div>
              <button 
                 onClick={handleRotate}
                 className="p-2 hover:bg-gray-100 active:bg-gray-200"
                 title="Rotate 90°"
              >
                <RotateCw size={20} />
              </button>
            </div>

            {/* Contextual Options */}
            {mode === 'draw' && (
               <div className="flex items-center gap-2 bg-white border border-black px-2 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                 <button 
                   onClick={() => drawTool === 'eraser' ? setEraserSize(Math.max(5, eraserSize - 5)) : setTextSize(Math.max(10, textSize - 2))}
                   className="p-1 hover:bg-gray-100 rounded"
                 >
                   <Minus size={14} />
                 </button>
                 <span className="text-xs font-bold w-6 text-center">{drawTool === 'eraser' ? eraserSize : textSize}</span>
                 <button 
                   onClick={() => drawTool === 'eraser' ? setEraserSize(eraserSize + 5) : setTextSize(textSize + 2)}
                   className="p-1 hover:bg-gray-100 rounded"
                 >
                   <Plus size={14} />
                 </button>
                 
                 {drawTool === 'text' && (
                   <>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <select 
                       value={fontFamily}
                       onChange={(e) => setFontFamily(e.target.value)}
                       className="text-xs border border-gray-300 rounded p-1 max-w-[120px] focus:outline-none focus:border-black"
                     >
                       {FONT_OPTIONS.map((opt) => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                     </select>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <div className="flex items-center gap-1 relative">
                       <input 
                         type="color" 
                         value={textColor} 
                         onChange={(e) => setTextColor(e.target.value)}
                         className="w-6 h-6 border-0 p-0 rounded cursor-pointer"
                         title="Text Color"
                       />
                     </div>
                   </>
                 )}
               </div>
            )}

            {mode === 'crop' && (
                <div className="flex gap-2 scale-90 md:scale-100 origin-left">
                    <Button size="sm" onClick={applyCrop} disabled={!cropSelection} className="bg-blue-600 text-white hover:bg-blue-700 py-1 px-2 h-8">
                        <Check size={14} className="mr-1"/> Apply
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setMode('draw'); setCropSelection(null); }} className="py-1 px-2 h-8">
                         Cancel
                    </Button>
                </div>
            )}

            {mode === 'adjust' && (
                 <div className="flex items-center gap-2 md:gap-4 bg-white border border-black px-3 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                    <div className="flex flex-col w-16 md:w-24">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Bright</label>
                        <input 
                            type="range" min="50" max="150" value={brightness} 
                            onChange={(e) => setBrightness(Number(e.target.value))} 
                            className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-col w-16 md:w-24">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Contrast</label>
                        <input 
                            type="range" min="50" max="150" value={contrast} 
                            onChange={(e) => setContrast(Number(e.target.value))} 
                            className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="h-8 w-[1px] bg-gray-300 mx-1"></div>
                    <button onClick={applyAdjustments} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Apply">
                        <Check size={16} />
                    </button>
                    <button onClick={() => { setMode('draw'); setBrightness(100); setContrast(100); }} className="p-1.5 hover:bg-gray-100 rounded" title="Cancel">
                        <X size={16} />
                    </button>
                 </div>
            )}

            <Button size="sm" variant="secondary" onClick={handleUndo} disabled={history.length <= 1} title="Undo" className="hidden sm:flex">
              <Undo size={18} />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose} className="h-9">
              <X size={16} className="mr-2" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white h-9">
              <Save size={16} className="mr-2" /> Save
            </Button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div 
            className="flex-grow overflow-auto bg-gray-200 relative p-8 flex items-center justify-center cursor-crosshair select-none"
            ref={containerRef}
        >
          <div 
             className="relative shadow-lg border border-gray-300 bg-white"
             style={{ 
                 // Ensure the container exactly matches canvas dimensions for accurate overlay positioning
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
              onClick={handleCanvasClick}
              className="max-w-none block"
              style={{
                  filter: mode === 'adjust' ? `brightness(${brightness}%) contrast(${contrast}%)` : 'none',
                  pointerEvents: mode === 'crop' ? 'none' : 'auto' // Pass through events to crop overlay if in crop mode
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
                    {/* Darken background area */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
                    
                    {/* Light up selected area */}
                    {cropSelection && (
                        <div 
                            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                            style={{
                                left: cropSelection.x,
                                top: cropSelection.y,
                                width: cropSelection.w,
                                height: cropSelection.h
                            }}
                        >
                            {/* Grid lines for rule of thirds */}
                            <div className="absolute top-1/3 w-full h-px bg-white/50"></div>
                            <div className="absolute top-2/3 w-full h-px bg-white/50"></div>
                            <div className="absolute left-1/3 h-full w-px bg-white/50"></div>
                            <div className="absolute left-2/3 h-full w-px bg-white/50"></div>
                            
                            {/* Dimensions label */}
                            <div className="absolute -top-6 left-0 bg-black text-white text-[10px] px-1 py-0.5 rounded">
                                {Math.round(cropSelection.w)} x {Math.round(cropSelection.h)}
                            </div>
                        </div>
                    )}
                    
                    {!cropSelection && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-black/70 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                                <MousePointer2 size={14} /> Drag to crop
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Text Input Overlay */}
            {textInput && (
              <div 
                style={{ 
                  position: 'absolute', 
                  left: textInput.x, 
                  top: textInput.y,
                  transform: 'translateY(-50%)',
                  zIndex: 20 
                }}
              >
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
                    minWidth: '100px',
                    fontFamily: fontFamily.replace(/"/g, ''),
                    color: textColor
                  }}
                  placeholder="Type here..."
                />
              </div>
            )}
          </div>
        </div>
    </div>
  );
};
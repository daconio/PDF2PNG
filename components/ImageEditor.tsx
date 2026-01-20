import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Save, Undo, Redo, Eraser, Type, Minus, Plus, 
  Crop, RotateCw, SlidersHorizontal, Check, MousePointer2, 
  Pen, Square, Circle as CircleIcon, Slash, ArrowRight,
  AlignLeft, AlignCenter, AlignRight, Pipette, Triangle, PaintBucket, PaintRoller
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
  { label: 'System', value: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
];

type DrawingTool = 'eraser' | 'text' | 'pen' | 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'eyedropper' | 'cover';

interface HistoryState {
  background: ImageData;
  drawing: ImageData;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onClose, initialMode = 'draw' }) => {
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null); // Layer 1: Original Image
  const canvasRef = useRef<HTMLCanvasElement>(null);           // Layer 2: User Drawings
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);       // Layer 3: Interaction/Preview
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for drawing state to avoid re-renders during mousemove
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null); // For smooth pen strokes

  const [bgCtx, setBgCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [tempCtx, setTempCtx] = useState<CanvasRenderingContext2D | null>(null);
  
  // History State (Stores both layers)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  
  // Modes
  const [mode, setMode] = useState<ToolMode>(initialMode);
  
  // Drawing State
  const [drawTool, setDrawTool] = useState<DrawingTool>('pen');
  const [isFilled, setIsFilled] = useState(false);
  
  // Tool Config
  const [strokeSize, setStrokeSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(30); // Independent eraser size, defaults larger
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
    const bgCanvas = backgroundCanvasRef.current;
    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;

    if (!bgCanvas || !canvas || !tempCanvas) return;

    const backgroundContext = bgCanvas.getContext('2d', { willReadFrequently: true });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const tempContext = tempCanvas.getContext('2d');
    
    if (!backgroundContext || !context || !tempContext) return;
    setBgCtx(backgroundContext);
    setCtx(context);
    setTempCtx(tempContext);

    const img = new Image();
    img.src = file.url;
    img.crossOrigin = "anonymous"; 
    
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      // Set dimensions for ALL layers
      bgCanvas.width = w; bgCanvas.height = h;
      canvas.width = w; canvas.height = h;
      tempCanvas.width = w; tempCanvas.height = h;

      // Draw original image onto Background Layer
      backgroundContext.drawImage(img, 0, 0);

      // Drawing layer stays empty (transparent) initially
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.clearRect(0, 0, w, h); // Ensure drawing layer is clean transparent
      
      // Initialize history with initial state of both layers
      const initialBgData = backgroundContext.getImageData(0, 0, w, h);
      const initialDrawData = context.getImageData(0, 0, w, h);
      
      setHistory([{ background: initialBgData, drawing: initialDrawData }]);
      setHistoryStep(0);
    };
  }, [file.url]);

  // Focus input when it appears
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  const saveState = () => {
    if (!bgCtx || !ctx || !canvasRef.current || !backgroundCanvasRef.current) return;
    
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;

    const bgData = bgCtx.getImageData(0, 0, w, h);
    const drawData = ctx.getImageData(0, 0, w, h);
    
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({ background: bgData, drawing: drawData });
    
    if (newHistory.length > 20) {
        newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreState = (index: number) => {
      if (!bgCtx || !ctx || !backgroundCanvasRef.current || !canvasRef.current || index < 0 || index >= history.length) return;
      
      const state = history[index];
      const { width, height } = state.background;

      // Resize all canvases if history size differs (e.g. after crop/rotate)
      [backgroundCanvasRef.current, canvasRef.current, tempCanvasRef.current].forEach(c => {
          if (c && (c.width !== width || c.height !== height)) {
              c.width = width;
              c.height = height;
          }
      });

      bgCtx.putImageData(state.background, 0, 0);
      ctx.putImageData(state.drawing, 0, 0);
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

  const getCoordinates = (e: React.MouseEvent<HTMLElement>) => {
    if (!tempCanvasRef.current) return { x: 0, y: 0 };
    const rect = tempCanvasRef.current.getBoundingClientRect();
    const scaleX = tempCanvasRef.current.width / rect.width;
    const scaleY = tempCanvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // --- DRAWING LOGIC ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || !ctx || !tempCtx || !canvasRef.current || !tempCanvasRef.current || !bgCtx) return;
    
    const { x, y } = getCoordinates(e);

    // Handle Eyedropper Tool
    if (drawTool === 'eyedropper') {
        // We need to sample from the combined view
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 1; sampleCanvas.height = 1;
        const sampleCtx = sampleCanvas.getContext('2d');
        if (sampleCtx) {
            // Draw BG then Drawing to sample correct color
            sampleCtx.drawImage(backgroundCanvasRef.current!, -x, -y);
            sampleCtx.drawImage(canvasRef.current!, -x, -y);
            const pixel = sampleCtx.getImageData(0, 0, 1, 1).data;
            const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
            setStrokeColor(hex);
            setDrawTool('pen');
        }
        return;
    }

    if (drawTool === 'text') {
        const rect = tempCanvasRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (textInput) {
            commitText();
            setTextInput({ x: clickX, y: clickY, value: '' });
        } else {
            setTextInput({ x: clickX, y: clickY, value: '' });
        }
        return;
    }

    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    lastPosRef.current = { x, y };

    // Setup Contexts (Drawing on the Top Transparent Layer)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const currentSize = drawTool === 'eraser' ? eraserSize : strokeSize;
    ctx.lineWidth = currentSize;
    
    if (drawTool === 'eraser') {
      // Acts as "White-out" to cover underlying PDF content
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#FFFFFF'; 
    } else if (drawTool === 'cover') {
      // Smart Cover: Sample background color from START position and paint with it
      // 1. Sample from background canvas (Layer 1)
      const pixel = bgCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      
      // 2. Set as brush color and update UI state
      setStrokeColor(hex);
      ctx.strokeStyle = hex;
      
      // 3. Force settings for covering
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.globalAlpha = opacity / 100;
    }

    // Temp context setup (for shape previews)
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    tempCtx.lineWidth = currentSize;
    tempCtx.strokeStyle = strokeColor;
    tempCtx.fillStyle = strokeColor;
    tempCtx.globalAlpha = opacity / 100;
    
    if (drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'cover') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || mode !== 'draw' || !ctx || !tempCtx || !tempCanvasRef.current) return;
    
    const { x, y } = getCoordinates(e);

    if (drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'cover') {
      if (lastPosRef.current) {
          ctx.beginPath();
          ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          lastPosRef.current = { x, y };
      }
    } else if (startPosRef.current) {
      tempCtx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
      
      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;
      
      let currentX = x;
      let currentY = y;

      if (e.shiftKey) {
        const dx = x - startX;
        const dy = y - startY;

        if (drawTool === 'rect' || drawTool === 'circle' || drawTool === 'triangle') {
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            currentX = startX + (dx >= 0 ? side : -side);
            currentY = startY + (dy >= 0 ? side : -side);
        } else if (drawTool === 'line' || drawTool === 'arrow') {
            const angle = Math.atan2(dy, dx);
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const dist = Math.sqrt(dx * dx + dy * dy);
            currentX = startX + Math.cos(snapAngle) * dist;
            currentY = startY + Math.sin(snapAngle) * dist;
        }
      }

      const w = currentX - startX;
      const h = currentY - startY;

      tempCtx.beginPath();
      
      if (drawTool === 'line') {
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(currentX, currentY);
      } else if (drawTool === 'arrow') {
        const headLength = Math.max(10, strokeSize * 3);
        const angle = Math.atan2(currentY - startY, currentX - startX);
        
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(currentX, currentY);
        
        tempCtx.lineTo(currentX - headLength * Math.cos(angle - Math.PI / 6), currentY - headLength * Math.sin(angle - Math.PI / 6));
        tempCtx.moveTo(currentX, currentY);
        tempCtx.lineTo(currentX - headLength * Math.cos(angle + Math.PI / 6), currentY - headLength * Math.sin(angle + Math.PI / 6));
      } else if (drawTool === 'rect') {
        tempCtx.rect(startX, startY, w, h);
      } else if (drawTool === 'circle') {
        tempCtx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
      } else if (drawTool === 'triangle') {
        tempCtx.moveTo(startX + w / 2, startY);
        tempCtx.lineTo(startX + w, startY + h);
        tempCtx.lineTo(startX, startY + h);
        tempCtx.closePath();
      }

      if (isFilled && ['rect', 'circle', 'triangle'].includes(drawTool)) {
          tempCtx.fill();
      } else {
          tempCtx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      
      if (ctx) {
          ctx.closePath();
          // Reset context to safe defaults for next operation
          ctx.globalAlpha = 1.0; 
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = strokeColor;
      }

      if ((['rect', 'circle', 'line', 'arrow', 'triangle'].includes(drawTool)) && tempCanvasRef.current && ctx && tempCtx) {
          ctx.drawImage(tempCanvasRef.current, 0, 0);
          tempCtx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
      }

      startPosRef.current = null;
      lastPosRef.current = null;
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

  // --- HELPER FOR TRANSFORMATIONS ---
  const applyTransformToBoth = (transformFn: (context: CanvasRenderingContext2D, width: number, height: number) => ImageData) => {
      if (!bgCtx || !ctx || !backgroundCanvasRef.current) return;
      
      const w = backgroundCanvasRef.current.width;
      const h = backgroundCanvasRef.current.height;

      const newBgData = transformFn(bgCtx, w, h);
      const newDrawData = transformFn(ctx, w, h);

      // Update sizes
      [backgroundCanvasRef.current, canvasRef.current, tempCanvasRef.current].forEach(c => {
          if (c) {
              c.width = newBgData.width;
              c.height = newBgData.height;
          }
      });

      bgCtx.putImageData(newBgData, 0, 0);
      ctx.putImageData(newDrawData, 0, 0);

      saveState();
  };

  const rotateCanvas = (context: CanvasRenderingContext2D, w: number, h: number): ImageData => {
      const temp = document.createElement('canvas');
      temp.width = h; temp.height = w;
      const tCtx = temp.getContext('2d');
      if (!tCtx) return context.getImageData(0,0,1,1);

      tCtx.save();
      tCtx.translate(h / 2, w / 2);
      tCtx.rotate((90 * Math.PI) / 180);
      tCtx.drawImage(context.canvas, -w / 2, -h / 2);
      tCtx.restore();
      return tCtx.getImageData(0, 0, h, w);
  };

  const handleRotate = () => {
    applyTransformToBoth(rotateCanvas);
  };

  // --- CROP HANDLERS ---
  const startCropSelection = (e: React.MouseEvent<HTMLElement>) => {
    const { x, y } = getCoordinates(e);
    setIsSelectingCrop(true);
    setCropStart({ x, y });
    setCropSelection({ x, y, w: 0, h: 0 });
  };

  const updateCropSelection = (e: React.MouseEvent<HTMLElement>) => {
    if (!isSelectingCrop || !cropStart) return;
    const { x, y } = getCoordinates(e);
    
    const minX = Math.min(x, cropStart.x);
    const minY = Math.min(y, cropStart.y);
    const width = Math.abs(x - cropStart.x);
    const height = Math.abs(y - cropStart.y);
    
    setCropSelection({ x: minX, y: minY, w: width, h: height });
  };

  const endCropSelection = () => {
    setIsSelectingCrop(false);
    setCropStart(null);
  };

  const applyCrop = () => {
    if (!cropSelection || !bgCtx || !ctx || !cropSelection.w || !cropSelection.h) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;

    const sX = cropSelection.x * scaleX;
    const sY = cropSelection.y * scaleY;
    const sW = cropSelection.w * scaleX;
    const sH = cropSelection.h * scaleY;

    // Crop both layers
    const croppedBg = bgCtx.getImageData(sX, sY, sW, sH);
    const croppedDraw = ctx.getImageData(sX, sY, sW, sH);

    [backgroundCanvasRef.current, canvasRef.current, tempCanvasRef.current].forEach(c => {
        if (c) { c.width = sW; c.height = sH; }
    });

    bgCtx.putImageData(croppedBg, 0, 0);
    ctx.putImageData(croppedDraw, 0, 0);

    saveState();
    setCropSelection(null);
    setMode('draw');
  };

  const applyAdjustments = () => {
    if (!bgCtx || !backgroundCanvasRef.current) return;
    const canvas = backgroundCanvasRef.current;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx?.drawImage(canvas, 0, 0);

    bgCtx.save();
    bgCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    bgCtx.clearRect(0, 0, canvas.width, canvas.height);
    bgCtx.drawImage(tempCanvas, 0, 0);
    bgCtx.restore();

    // We only adjust background, drawing layer remains untouched
    saveState();
    setBrightness(100);
    setContrast(100);
    setMode('draw');
  };

  const handleSave = () => {
    if (!backgroundCanvasRef.current || !canvasRef.current) return;
    
    // Composite both layers for final output
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = backgroundCanvasRef.current.width;
    exportCanvas.height = backgroundCanvasRef.current.height;
    const exportCtx = exportCanvas.getContext('2d');
    
    if (exportCtx) {
        // 1. Draw Background (with filters if active in adjust mode)
        if (mode === 'adjust' && (brightness !== 100 || contrast !== 100)) {
            exportCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        }
        exportCtx.drawImage(backgroundCanvasRef.current, 0, 0);
        exportCtx.filter = 'none';

        // 2. Draw User Drawings
        exportCtx.drawImage(canvasRef.current, 0, 0);
    }

    exportCanvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  const getInputTransform = () => {
    if (textAlign === 'center') return 'translate(-50%, -50%)';
    if (textAlign === 'right') return 'translate(-100%, -50%)';
    return 'translate(0, -50%)';
  };

  // Helper to get current display size for toolbar
  const getCurrentSize = () => {
    if (drawTool === 'text') return textSize;
    if (drawTool === 'eraser') return eraserSize;
    return strokeSize;
  };

  // Helper to handle size updates from toolbar
  const updateSize = (delta: number) => {
    if (drawTool === 'text') setTextSize(Math.max(10, textSize + (delta * 2)));
    else if (drawTool === 'eraser') setEraserSize(Math.max(1, eraserSize + delta));
    else setStrokeSize(Math.max(1, strokeSize + delta));
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
              <Tooltip content="Smart Cover (Match Background)">
                <button onClick={() => { setMode('draw'); setDrawTool('cover'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'cover' ? 'bg-blue-100 text-blue-700' : ''}`}><PaintRoller size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Line">
                <button onClick={() => { setMode('draw'); setDrawTool('line'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'line' ? 'bg-blue-100 text-blue-700' : ''}`}><Slash size={20} /></button>
              </Tooltip>
              <div className="w-[1px] bg-gray-200"></div>
              <Tooltip content="Arrow">
                <button onClick={() => { setMode('draw'); setDrawTool('arrow'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'arrow' ? 'bg-blue-100 text-blue-700' : ''}`}><ArrowRight size={20} /></button>
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
              <Tooltip content="Triangle">
                <button onClick={() => { setMode('draw'); setDrawTool('triangle'); setTextInput(null); }} className={`p-2 hover:bg-gray-100 ${mode === 'draw' && drawTool === 'triangle' ? 'bg-blue-100 text-blue-700' : ''}`}><Triangle size={20} /></button>
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
                 
                 {/* Stroke/Eraser/Text Size */}
                 {drawTool !== 'eyedropper' && (
                     <>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => updateSize(-1)} className="p-1 hover:bg-gray-100 rounded"><Minus size={14} /></button>
                        <span className="text-xs font-bold w-6 text-center">{getCurrentSize()}</span>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => updateSize(1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={14} /></button>
                     </>
                 )}
                 
                 {drawTool !== 'eraser' && drawTool !== 'eyedropper' && drawTool !== 'cover' && (
                    <>
                        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                        <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-6 h-6 border-0 p-0 rounded cursor-pointer" title="Color" />
                    </>
                 )}

                 {/* Shape Fill Toggle */}
                 {['rect', 'circle', 'triangle'].includes(drawTool) && (
                     <>
                        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                        <Tooltip content={isFilled ? "Filled" : "Outline"}>
                            <button onClick={() => setIsFilled(!isFilled)} className={`p-1 rounded ${isFilled ? 'bg-black text-white' : 'hover:bg-gray-100 text-black'}`}>
                                <PaintBucket size={16} />
                            </button>
                        </Tooltip>
                     </>
                 )}

                 {/* Opacity for Pen and Shapes */}
                 {drawTool !== 'eraser' && drawTool !== 'text' && drawTool !== 'eyedropper' && drawTool !== 'cover' && (
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
                            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setTextAlign('left')} className={`p-1 hover:bg-gray-100 ${textAlign === 'left' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignLeft size={14} /></button>
                        </Tooltip>
                        <Tooltip content="Align Center">
                            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setTextAlign('center')} className={`p-1 hover:bg-gray-100 ${textAlign === 'center' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignCenter size={14} /></button>
                        </Tooltip>
                        <Tooltip content="Align Right">
                            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setTextAlign('right')} className={`p-1 hover:bg-gray-100 ${textAlign === 'right' ? 'bg-blue-50 text-blue-600' : ''}`}><AlignRight size={14} /></button>
                        </Tooltip>
                     </div>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <select onMouseDown={(e) => e.preventDefault()} value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="text-xs border border-gray-300 rounded p-1 max-w-[100px] focus:outline-none focus:border-black cursor-pointer">
                       {FONT_OPTIONS.map((opt) => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                     </select>
                   </>
                 )}
                 
                 {/* Eyedropper Message */}
                 {drawTool === 'eyedropper' && (
                     <span className="text-xs font-medium text-gray-500 px-2">Click image to pick color</span>
                 )}
                 {drawTool === 'cover' && (
                     <span className="text-xs font-medium text-gray-500 px-2">Click background to paint with it</span>
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
             className="relative shadow-lg border border-gray-300"
             style={{ 
                 width: backgroundCanvasRef.current ? backgroundCanvasRef.current.clientWidth : 'auto',
                 height: backgroundCanvasRef.current ? backgroundCanvasRef.current.clientHeight : 'auto',
                 backgroundColor: 'white'
             }}
          >
            {/* Layer 1: Background Image */}
            <canvas
              ref={backgroundCanvasRef}
              className="absolute inset-0 block max-w-none"
              style={{
                  filter: mode === 'adjust' ? `brightness(${brightness}%) contrast(${contrast}%)` : 'none',
              }}
            />

            {/* Layer 2: User Drawings (Transparent) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 block max-w-none"
            />
            
            {/* Layer 3: Temp/Interaction */}
            <canvas
              ref={tempCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onClick={(e) => drawTool === 'text' && startDrawing(e)}
              className="absolute inset-0 max-w-none block z-10"
              style={{
                  pointerEvents: mode === 'crop' ? 'none' : 'auto',
                  cursor: drawTool === 'eyedropper' || drawTool === 'cover' ? 'crosshair' : 'crosshair'
              }}
            />
            
            {/* Crop Overlay */}
            {mode === 'crop' && (
                <div 
                    className="absolute inset-0 cursor-crosshair z-20"
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
              <div style={{ position: 'absolute', left: textInput.x, top: textInput.y, transform: getInputTransform(), zIndex: 30 }}>
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
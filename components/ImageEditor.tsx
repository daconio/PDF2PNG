import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Save, Undo, Redo, Eraser, Type, Minus, Plus, 
  Crop, RotateCw, SlidersHorizontal, Check, MousePointer2, 
  Pen, Square, Circle as CircleIcon, Slash, ArrowRight,
  AlignLeft, AlignCenter, AlignRight, Pipette, Triangle, PaintBucket, Move, ScanSearch,
  ZoomIn, ZoomOut, Maximize
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

type DrawingTool = 'eraser' | 'text' | 'pen' | 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'eyedropper';

interface TextObject {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  fontFamily: string;
  align: CanvasTextAlign;
}

interface HistoryItem {
  imageData: ImageData;
  textObjects: TextObject[];
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onClose, initialMode = 'draw' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);      // Display Canvas (Combines Buffer + Text)
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);  // Interaction Layer (Pen trails, Shapes drag, Crop UI)
  const bufferCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas')); // Offscreen Buffer (Pixel Data Only)
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for drawing state
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const canvasMetricsRef = useRef<{ left: number; top: number; scaleX: number; scaleY: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const activeToolParamsRef = useRef<any>(null);

  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [tempCtx, setTempCtx] = useState<CanvasRenderingContext2D | null>(null);
  
  // State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  
  const [mode, setMode] = useState<ToolMode>(initialMode);
  const [drawTool, setDrawTool] = useState<DrawingTool>('pen');
  const [isFilled, setIsFilled] = useState(false);
  
  // Tool Config
  const [strokeSize, setStrokeSize] = useState(5);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [opacity, setOpacity] = useState(100);

  // Text Specific
  const [textSize, setTextSize] = useState(40);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textAlign, setTextAlign] = useState<CanvasTextAlign>('left');
  const [textInput, setTextInput] = useState<{ id?: string; x: number; y: number; value: string } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Dragging Text Input
  const isDraggingTextRef = useRef(false);
  const textDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const textStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Crop / Adjust / Scale
  const [cropSelection, setCropSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [scale, setScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !tempCanvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true, desynchronized: true });
    const tempContext = tempCanvas.getContext('2d', { desynchronized: true });
    
    if (!context || !tempContext) return;
    setCtx(context);
    setTempCtx(tempContext);

    const img = new Image();
    img.src = file.url;
    img.crossOrigin = "anonymous"; 
    
    img.onload = () => {
      // Set sizes
      canvas.width = img.width;
      canvas.height = img.height;
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      
      // Setup Buffer Canvas (The Pixel Layer)
      bufferCanvasRef.current.width = img.width;
      bufferCanvasRef.current.height = img.height;
      const bCtx = bufferCanvasRef.current.getContext('2d');
      if (bCtx) {
          bCtx.drawImage(img, 0, 0);
          
          // Initial Render
          context.drawImage(bufferCanvasRef.current, 0, 0);

          // Initial History
          const initialData = bCtx.getImageData(0, 0, img.width, img.height);
          setHistory([{ imageData: initialData, textObjects: [] }]);
          setHistoryStep(0);
      }
      
      setDimensions({ width: img.width, height: img.height });

      // Auto Fit
      if (containerRef.current) {
        const padding = 20;
        const availW = containerRef.current.clientWidth - padding;
        const availH = containerRef.current.clientHeight - padding;
        const scaleW = availW / img.width;
        const scaleH = availH / img.height;
        setScale(Math.min(scaleW, scaleH, 1));
      }
    };
  }, [file.url]);

  // Main Render Function: Combines Pixel Buffer + Vector Text Objects
  const renderCanvas = () => {
      if (!ctx || !canvasRef.current) return;
      
      // 1. Clear & Draw Buffer (Pixels)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(bufferCanvasRef.current, 0, 0);

      // 2. Draw Text Objects (Vectors)
      textObjects.forEach(obj => {
          ctx.save();
          ctx.font = `bold ${obj.size}px ${obj.fontFamily}`;
          ctx.fillStyle = obj.color;
          ctx.textAlign = obj.align;
          ctx.textBaseline = 'alphabetic'; // Standardize baseline
          ctx.fillText(obj.text, obj.x, obj.y);
          ctx.restore();
      });
  };

  // Re-render when text objects change
  useEffect(() => {
      renderCanvas();
  }, [textObjects]);

  const fitToScreen = () => {
      if (!containerRef.current || dimensions.width === 0) return;
      const padding = 20;
      const availW = containerRef.current.clientWidth - padding;
      const availH = containerRef.current.clientHeight - padding;
      const scaleW = availW / dimensions.width;
      const scaleH = availH / dimensions.height;
      setScale(Math.min(scaleW, scaleH));
  };

  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  // Text Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTextRef.current && textStartPosRef.current && textDragStartRef.current) {
         e.preventDefault();
         const dxVisual = e.clientX - textDragStartRef.current.x;
         const dyVisual = e.clientY - textDragStartRef.current.y;
         const dxCanvas = dxVisual / scale;
         const dyCanvas = dyVisual / scale;

         setTextInput(prev => prev ? ({ ...prev, x: textStartPosRef.current!.x + dxCanvas, y: textStartPosRef.current!.y + dyCanvas }) : null);
      }
    };
    const handleMouseUp = () => { isDraggingTextRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scale]);

  const handleTextMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!textInput) return;
      isDraggingTextRef.current = true;
      textDragStartRef.current = { x: e.clientX, y: e.clientY };
      textStartPosRef.current = { x: textInput.x, y: textInput.y };
  };

  const saveState = () => {
    const bCtx = bufferCanvasRef.current.getContext('2d');
    if (!bCtx) return;

    // Save Buffer pixels AND current text objects
    const currentImageData = bCtx.getImageData(0, 0, bufferCanvasRef.current.width, bufferCanvasRef.current.height);
    const currentTexts = [...textObjects];

    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({ imageData: currentImageData, textObjects: currentTexts });
    
    if (newHistory.length > 20) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreState = (index: number) => {
      if (index < 0 || index >= history.length) return;
      const item = history[index];
      
      const bCtx = bufferCanvasRef.current.getContext('2d');
      if (!bCtx || !canvasRef.current || !tempCanvasRef.current) return;

      // Restore Canvas Size if changed
      if (canvasRef.current.width !== item.imageData.width || canvasRef.current.height !== item.imageData.height) {
          canvasRef.current.width = item.imageData.width;
          canvasRef.current.height = item.imageData.height;
          tempCanvasRef.current.width = item.imageData.width;
          tempCanvasRef.current.height = item.imageData.height;
          bufferCanvasRef.current.width = item.imageData.width;
          bufferCanvasRef.current.height = item.imageData.height;
          setDimensions({ width: item.imageData.width, height: item.imageData.height });
      }

      // Restore Pixels to Buffer
      bCtx.putImageData(item.imageData, 0, 0);
      
      // Restore Texts
      setTextObjects(item.textObjects);
      
      setHistoryStep(index);
      
      // Trigger render
      setTimeout(renderCanvas, 0);
  };

  const handleUndo = () => { if (historyStep > 0) restoreState(historyStep - 1); };
  const handleRedo = () => { if (historyStep < history.length - 1) restoreState(historyStep + 1); };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? handleRedo() : handleUndo();
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history]);

  const updateCanvasMetrics = () => {
    if (!tempCanvasRef.current) return;
    const rect = tempCanvasRef.current.getBoundingClientRect();
    canvasMetricsRef.current = {
        left: rect.left,
        top: rect.top,
        scaleX: tempCanvasRef.current.width / rect.width,
        scaleY: tempCanvasRef.current.height / rect.height
    };
  };

  const getCoordinates = (clientX: number, clientY: number) => {
    if (!canvasMetricsRef.current) updateCanvasMetrics();
    if (!canvasMetricsRef.current) return { x: 0, y: 0 };
    const { left, top, scaleX, scaleY } = canvasMetricsRef.current;
    return { x: (clientX - left) * scaleX, y: (clientY - top) * scaleY };
  };

  // Check if click hits a text object
  const hitTestText = (x: number, y: number): TextObject | null => {
      if (!ctx) return null;
      // Reverse iterate to pick top-most
      for (let i = textObjects.length - 1; i >= 0; i--) {
          const obj = textObjects[i];
          ctx.save();
          ctx.font = `bold ${obj.size}px ${obj.fontFamily}`;
          const metrics = ctx.measureText(obj.text);
          const height = obj.size; // Approximate height
          
          let startX = obj.x;
          if (obj.align === 'center') startX = obj.x - metrics.width / 2;
          if (obj.align === 'right') startX = obj.x - metrics.width;

          // Bounding box (simple approximation)
          // Y is baseline, so box is from y - height to y + descent (approx size * 0.2)
          const top = obj.y - height * 0.8;
          const bottom = obj.y + height * 0.2;
          
          ctx.restore();

          if (x >= startX && x <= startX + metrics.width && y >= top && y <= bottom) {
              return obj;
          }
      }
      return null;
  };

  // Shapes Render Loop
  const performShapeRender = () => {
      if (!tempCtx || !tempCanvasRef.current || !startPosRef.current || !currentPosRef.current || !activeToolParamsRef.current) return;
      const { tool, strokeSize, color, isFilled, opacity, shiftKey } = activeToolParamsRef.current;
      const { x: startX, y: startY } = startPosRef.current;
      let { x: currentX, y: currentY } = currentPosRef.current;

      tempCtx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);

      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.lineWidth = strokeSize;
      tempCtx.strokeStyle = color;
      tempCtx.fillStyle = color;
      tempCtx.globalAlpha = opacity / 100;

      if (shiftKey) {
        const dx = currentX - startX;
        const dy = currentY - startY;
        if (tool === 'rect' || tool === 'circle' || tool === 'triangle') {
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            currentX = startX + (dx >= 0 ? side : -side);
            currentY = startY + (dy >= 0 ? side : -side);
        } else if (tool === 'line' || tool === 'arrow') {
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
      if (tool === 'line') {
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(currentX, currentY);
      } else if (tool === 'arrow') {
        const headLength = Math.max(10, strokeSize * 3);
        const angle = Math.atan2(currentY - startY, currentX - startX);
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(currentX, currentY);
        tempCtx.lineTo(currentX - headLength * Math.cos(angle - Math.PI / 6), currentY - headLength * Math.sin(angle - Math.PI / 6));
        tempCtx.moveTo(currentX, currentY);
        tempCtx.lineTo(currentX - headLength * Math.cos(angle + Math.PI / 6), currentY - headLength * Math.sin(angle + Math.PI / 6));
      } else if (tool === 'rect') {
        tempCtx.rect(startX, startY, w, h);
      } else if (tool === 'circle') {
        tempCtx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
      } else if (tool === 'triangle') {
        const topX = startX + w / 2;
        const topY = startY;
        const leftX = startX;
        const leftY = startY + h;
        const rightX = startX + w;
        const rightY = startY + h;
        tempCtx.moveTo(topX, topY);
        tempCtx.lineTo(rightX, rightY);
        tempCtx.lineTo(leftX, leftY);
        tempCtx.closePath();
      }

      if (isFilled && ['rect', 'circle', 'triangle'].includes(tool)) tempCtx.fill();
      else tempCtx.stroke();
      
      rafIdRef.current = requestAnimationFrame(performShapeRender);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || !ctx || !tempCtx || !canvasRef.current || !tempCanvasRef.current) return;
    updateCanvasMetrics();
    e.currentTarget.setPointerCapture(e.pointerId);

    const { x, y } = getCoordinates(e.clientX, e.clientY);

    // Eyedropper: Pick from Buffer (Pixels)
    if (drawTool === 'eyedropper') {
        const bCtx = bufferCanvasRef.current.getContext('2d');
        if (bCtx) {
            const pixel = bCtx.getImageData(x, y, 1, 1).data;
            const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
            setStrokeColor(hex);
            setDrawTool('pen');
        }
        return;
    }

    // Text Tool: Hit Detection or New Text
    if (drawTool === 'text') {
        // If we are already editing, commit first
        if (textInput) commitText();

        const hit = hitTestText(x, y);
        if (hit) {
            // Edit existing text
            setTextInput({ id: hit.id, x: hit.x, y: hit.y, value: hit.text });
            // Remove from objects temporarily (so it doesn't double render)
            setTextObjects(prev => prev.filter(t => t.id !== hit.id));
            // Set styles to match
            setStrokeColor(hit.color);
            setTextSize(hit.size);
            setFontFamily(hit.fontFamily);
            setTextAlign(hit.align);
        } else {
            // New text
            setTextInput({ x, y, value: '' });
        }
        return;
    }

    // Pen / Shapes
    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    lastPosRef.current = { x, y };
    currentPosRef.current = { x, y };

    // Setup Temp Context (for interaction)
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    tempCtx.lineWidth = strokeSize;
    tempCtx.strokeStyle = drawTool === 'eraser' ? '#FFFFFF' : strokeColor;
    tempCtx.globalAlpha = drawTool === 'eraser' ? 1.0 : opacity / 100;

    if (['rect', 'circle', 'triangle', 'line', 'arrow'].includes(drawTool)) {
        activeToolParamsRef.current = {
            tool: drawTool,
            strokeSize,
            color: strokeColor,
            isFilled,
            opacity,
            shiftKey: e.shiftKey
        };
        rafIdRef.current = requestAnimationFrame(performShapeRender);
    } else if (drawTool === 'pen' || drawTool === 'eraser') {
        tempCtx.beginPath();
        tempCtx.moveTo(x, y);
        tempCtx.lineTo(x, y);
        tempCtx.stroke();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || mode !== 'draw' || !tempCtx) return;
    const { x, y } = getCoordinates(e.clientX, e.clientY);
    currentPosRef.current = { x, y };
    if (activeToolParamsRef.current) activeToolParamsRef.current.shiftKey = e.shiftKey;

    if (drawTool === 'pen' || drawTool === 'eraser') {
      if (lastPosRef.current) {
          tempCtx.beginPath();
          tempCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
          tempCtx.lineTo(x, y);
          tempCtx.stroke();
          lastPosRef.current = { x, y };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
      }

      // Commit Temp Canvas (Pen/Shapes) to Buffer (Pixel Layer)
      const bCtx = bufferCanvasRef.current.getContext('2d');
      if (bCtx && tempCanvasRef.current) {
         if (['pen', 'eraser'].includes(drawTool)) tempCtx?.closePath();
         bCtx.drawImage(tempCanvasRef.current, 0, 0);
         tempCtx?.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
      }

      startPosRef.current = null;
      lastPosRef.current = null;
      activeToolParamsRef.current = null;
      
      renderCanvas(); // Update Screen
      saveState();    // Save History
    }
  };

  const commitText = () => {
    if (!textInput || !ctx || !canvasRef.current) {
      setTextInput(null);
      return;
    }

    if (!textInput.value.trim()) {
        setTextInput(null);
        renderCanvas(); // Just re-render to ensure clean state
        return;
    }

    const newTextObj: TextObject = {
        id: textInput.id || Math.random().toString(36).substr(2, 9),
        x: textInput.x,
        y: textInput.y,
        text: textInput.value,
        color: strokeColor,
        size: textSize,
        fontFamily: fontFamily,
        align: textAlign
    };

    setTextObjects(prev => [...prev, newTextObj]);
    setTextInput(null);
    // saveState will be called in useEffect or we call it manually
    // Since setTextObjects is async, we can't save immediately unless we use updated list.
    // Let's use a timeout or manual composition for saveState. 
    // Easier: update state, let render happen, then save.
    setTimeout(() => saveState(), 0);
  };

  // --- BAKE TEXTS FUNCTION ---
  // Merges texts into buffer pixels. Used for transformations (Crop/Rotate/Adjust)
  const bakeTextsToBuffer = () => {
      const bCtx = bufferCanvasRef.current.getContext('2d');
      if (!bCtx) return;
      
      textObjects.forEach(obj => {
          bCtx.save();
          bCtx.font = `bold ${obj.size}px ${obj.fontFamily}`;
          bCtx.fillStyle = obj.color;
          bCtx.textAlign = obj.align;
          bCtx.textBaseline = 'alphabetic';
          bCtx.fillText(obj.text, obj.x, obj.y);
          bCtx.restore();
      });
      setTextObjects([]); // Clear vectors as they are now pixels
  };

  // --- ROTATE LOGIC ---
  const handleRotate = () => {
    bakeTextsToBuffer(); // Flatten text before rotation

    const bCtx = bufferCanvasRef.current.getContext('2d');
    if (!bCtx) return;

    // Create temp buffer for rotation
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bufferCanvasRef.current.height;
    tempCanvas.height = bufferCanvasRef.current.width;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tCtx.rotate((90 * Math.PI) / 180);
    tCtx.drawImage(bufferCanvasRef.current, -bufferCanvasRef.current.width / 2, -bufferCanvasRef.current.height / 2);

    // Update Buffer
    bufferCanvasRef.current.width = tempCanvas.width;
    bufferCanvasRef.current.height = tempCanvas.height;
    bCtx.drawImage(tempCanvas, 0, 0);

    // Update Display canvases
    if (canvasRef.current && tempCanvasRef.current) {
        canvasRef.current.width = tempCanvas.width;
        canvasRef.current.height = tempCanvas.height;
        tempCanvasRef.current.width = tempCanvas.width;
        tempCanvasRef.current.height = tempCanvas.height;
    }
    
    setDimensions({ width: tempCanvas.width, height: tempCanvas.height });
    setTimeout(updateCanvasMetrics, 0);
    
    renderCanvas();
    saveState();
    fitToScreen();
  };

  // --- CROP LOGIC ---
  const startCropSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'crop') return;
    updateCanvasMetrics();
    const rect = containerRef.current!.querySelector('canvas')!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropSelection({ x, y, w: 0, h: 0 });
    setIsSelectingCrop(true);
  };

  const updateCropSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingCrop || !cropStart) return;
    const rect = containerRef.current!.querySelector('canvas')!.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(currentX, cropStart.x);
    const y = Math.min(currentY, cropStart.y);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);
    setCropSelection({ x, y, w, h });
  };

  const endCropSelection = () => setIsSelectingCrop(false);

  const applyCrop = () => {
    if (!cropSelection || !ctx || !canvasRef.current || cropSelection.w < 5 || cropSelection.h < 5) return;
    
    bakeTextsToBuffer(); // Flatten text before crop

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const sourceX = cropSelection.x * scaleX;
    const sourceY = cropSelection.y * scaleY;
    const sourceW = cropSelection.w * scaleX;
    const sourceH = cropSelection.h * scaleY;

    try {
        const bCtx = bufferCanvasRef.current.getContext('2d');
        if (!bCtx) return;
        
        const croppedData = bCtx.getImageData(sourceX, sourceY, sourceW, sourceH);
        
        // Update all canvases
        [canvasRef.current, tempCanvasRef.current, bufferCanvasRef.current].forEach(c => {
            if(c) { c.width = sourceW; c.height = sourceH; }
        });

        bCtx.putImageData(croppedData, 0, 0);
        
        setDimensions({ width: sourceW, height: sourceH });

        renderCanvas();
        saveState();
        setCropSelection(null);
        setMode('draw');
        setTimeout(updateCanvasMetrics, 0);
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  // --- ADJUSTMENT LOGIC ---
  const applyAdjustments = () => {
    // Bake adjustments into buffer
    bakeTextsToBuffer();

    const bCtx = bufferCanvasRef.current.getContext('2d');
    if (!bCtx) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bufferCanvasRef.current.width;
    tempCanvas.height = bufferCanvasRef.current.height;
    const tCtx = tempCanvas.getContext('2d');
    if(!tCtx) return;
    
    tCtx.drawImage(bufferCanvasRef.current, 0, 0);

    bCtx.save();
    bCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    bCtx.clearRect(0, 0, bCtx.canvas.width, bCtx.canvas.height);
    bCtx.drawImage(tempCanvas, 0, 0);
    bCtx.restore();

    renderCanvas();
    saveState();
    setBrightness(100);
    setContrast(100);
    setMode('draw');
  };

  const handleSave = () => {
    if (!bufferCanvasRef.current) return;
    
    // Create export canvas that combines everything
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = bufferCanvasRef.current.width;
    exportCanvas.height = bufferCanvasRef.current.height;
    const eCtx = exportCanvas.getContext('2d');
    if (!eCtx) return;

    // 1. Draw Buffer
    eCtx.drawImage(bufferCanvasRef.current, 0, 0);
    
    // 2. Apply Filters if in adjust mode and not applied
    if (mode === 'adjust' && (brightness !== 100 || contrast !== 100)) {
       const temp = document.createElement('canvas');
       temp.width = exportCanvas.width;
       temp.height = exportCanvas.height;
       temp.getContext('2d')?.drawImage(exportCanvas, 0, 0);
       
       eCtx.save();
       eCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
       eCtx.clearRect(0,0, exportCanvas.width, exportCanvas.height);
       eCtx.drawImage(temp, 0, 0);
       eCtx.restore();
    }

    // 3. Draw Text Objects
    textObjects.forEach(obj => {
        eCtx.save();
        eCtx.font = `bold ${obj.size}px ${obj.fontFamily}`;
        eCtx.fillStyle = obj.color;
        eCtx.textAlign = obj.align;
        eCtx.textBaseline = 'alphabetic';
        eCtx.fillText(obj.text, obj.x, obj.y);
        eCtx.restore();
    });

    exportCanvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  const getInputTransform = () => {
    if (textAlign === 'center') return 'translate(-50%, -80%)'; // Adjusted for baseline
    if (textAlign === 'right') return 'translate(-100%, -80%)';
    return 'translate(0, -80%)';
  };

  const getInputWidth = () => {
    if (!ctx) return 50;
    const text = textInput?.value || '';
    ctx.save();
    ctx.font = `bold ${textSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    ctx.restore();
    return Math.max(50, metrics.width + (textSize * 0.5));
  };

  const handleAutoDetectFont = () => {
    const text = textInput?.value || '';
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
    const krCandidates = [
        '"Pretendard", sans-serif', '"Nanum Myeongjo", serif', '"Nanum Gothic", sans-serif',
    ];
    const enCandidates = [
        '"Space Grotesk", sans-serif', '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', '"Pretendard", sans-serif',
    ];
    const candidates = hasKorean ? krCandidates : enCandidates;
    const currentIndex = candidates.indexOf(fontFamily);
    const nextIndex = (currentIndex + 1) % candidates.length;
    setFontFamily(candidates[nextIndex]);
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
            
            {/* Zoom Controls - New Group */}
            <div className="flex items-center gap-1 bg-white border border-black px-2 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                <Tooltip content="Zoom Out">
                    <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomOut size={16} /></button>
                </Tooltip>
                <span className="text-xs font-bold w-10 text-center">{Math.round(scale * 100)}%</span>
                <Tooltip content="Zoom In">
                    <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomIn size={16} /></button>
                </Tooltip>
                <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                <Tooltip content="Fit to Screen">
                    <button onClick={fitToScreen} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Maximize size={16} /></button>
                </Tooltip>
            </div>

            {/* Contextual Options */}
            {mode === 'draw' && (
               <div className="flex items-center gap-2 bg-white border border-black px-2 py-1 shadow-sm rounded scale-90 md:scale-100 origin-left">
                 
                 {/* Stroke Size for all drawing tools */}
                 {drawTool !== 'eyedropper' && (
                     <>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => drawTool === 'text' ? setTextSize(Math.max(10, textSize - 2)) : setStrokeSize(Math.max(1, strokeSize - 1))} className="p-1 hover:bg-gray-100 rounded"><Minus size={14} /></button>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={drawTool === 'text' ? textSize : strokeSize}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              if (drawTool === 'text') setTextSize(val);
                              else setStrokeSize(val);
                            }
                          }}
                          className="w-10 text-center text-xs font-bold bg-gray-50 border border-gray-200 rounded py-0.5 focus:border-blue-500 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => drawTool === 'text' ? setTextSize(textSize + 2) : setStrokeSize(strokeSize + 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={14} /></button>
                     </>
                 )}
                 
                 {drawTool !== 'eraser' && drawTool !== 'eyedropper' && (
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
                     <Tooltip content="Smart Match (Cycle Fonts)">
                        <button 
                            onMouseDown={(e) => e.preventDefault()} 
                            onClick={handleAutoDetectFont}
                            className="p-1 hover:bg-gray-100 text-purple-600"
                        >
                            <ScanSearch size={16} />
                        </button>
                    </Tooltip>
                     <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                     <select 
                        onMouseDown={(e) => e.preventDefault()} 
                        value={fontFamily} 
                        onChange={(e) => setFontFamily(e.target.value)} 
                        className="text-xs border border-gray-300 rounded p-1 max-w-[100px] focus:outline-none focus:border-black cursor-pointer font-bold"
                        style={{ fontFamily: fontFamily.replace(/"/g, '') }}
                     >
                       {FONT_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value} style={{ fontFamily: opt.value.replace(/"/g, '') }}>
                            {opt.label}
                        </option>
                       ))}
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
        <div className="flex-grow overflow-auto bg-gray-200 relative flex items-center justify-center cursor-crosshair select-none" ref={containerRef}>
          <div 
             className="relative shadow-lg border border-gray-300 bg-white origin-center transition-all duration-200 ease-out"
             style={{ 
                 width: dimensions.width * scale,
                 height: dimensions.height * scale
             }}
          >
            {/* Main Display Canvas */}
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{
                  filter: mode === 'adjust' ? `brightness(${brightness}%) contrast(${contrast}%)` : 'none',
              }}
            />
            
            {/* Interaction Layer (Temp) */}
            <canvas
              ref={tempCanvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={(e) => drawTool === 'text' && handlePointerDown(e as any)}
              className="absolute inset-0 block w-full h-full"
              style={{
                  pointerEvents: mode === 'crop' ? 'none' : 'auto',
                  cursor: drawTool === 'eyedropper' ? 'crosshair' : 'crosshair',
                  touchAction: 'none'
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
              <div 
                style={{ 
                    position: 'absolute', 
                    // Convert Canvas Coords back to Visual Coords
                    left: textInput.x * scale, 
                    top: textInput.y * scale, 
                    transform: getInputTransform(), 
                    zIndex: 20 
                }}
                className="group"
              >
                {/* Drag Handle - Appears on hover or when focused/active */}
                <div 
                    onMouseDown={handleTextMouseDown}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white p-1.5 rounded-full cursor-move shadow-neo-sm hover:scale-110 transition-transform z-30"
                    title="Drag to move text"
                >
                    <Move size={14} />
                </div>

                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => e.key === 'Enter' && commitText()}
                  className="bg-transparent border-b-2 border-blue-500 outline-none p-0 font-bold"
                  style={{ 
                      // Scale font size visually to match canvas rendering
                      fontSize: `${textSize * scale}px`, 
                      minWidth: '50px', 
                      width: `${getInputWidth() * scale}px`,
                      fontFamily: fontFamily.replace(/"/g, ''), 
                      color: strokeColor,
                      textAlign: textAlign as any,
                      whiteSpace: 'nowrap'
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
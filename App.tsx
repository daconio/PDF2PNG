import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Images, FileText, CheckCircle, ArrowRight, Download, Github, FileArchive, X, Eye, Pencil, FileStack, Globe, Cog, Crop, RotateCw, SlidersHorizontal, Files, Layers, Plus, UploadCloud, Scissors, ChevronDown, ChevronUp, Clock, AlertCircle, FileType, FolderOutput, FolderDown, Presentation, Type, Timer } from 'lucide-react';
import { useDropzone, Accept } from 'react-dropzone';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  rectSortingStrategy 
} from '@dnd-kit/sortable';

import { ConversionMode, ProcessStatus, FileItem } from './types';
import { convertPdfToImages, convertImagesToPdf, getPdfPageCount, rotateImage, mergePdfs, flattenPdfs, splitPdf, convertPdfToPptx } from './services/pdfService';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { DropZone } from './components/DropZone';
import { Pipeline } from './components/Pipeline';
import { ImageEditor, ToolMode } from './components/ImageEditor';
import { PageSelectionModal } from './components/PageSelectionModal';
import { SortableFileCard, FileCardOverlay } from './components/SortableFileCard';
import { Tooltip } from './components/Tooltip';
import { Toast, ToastType } from './components/Toast';
import JSZip from 'jszip';

type Language = 'ko' | 'en';
type OutputFormat = 'png' | 'jpg';

// Polyfill for File System Access API types
declare global {
    interface Window {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    }
    interface FileSystemDirectoryHandle {
        getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    }
    interface FileSystemFileHandle {
        createWritable(): Promise<FileSystemWritableFileStream>;
    }
    interface FileSystemWritableFileStream {
        write(data: any): Promise<void>;
        close(): Promise<void>;
    }
}

const translations = {
  en: {
    heroTag: "NO CLOUD • PRIVACY FIRST",
    heroTitle: "OWN YOUR ",
    heroTitleHighlight: "DOCUMENTS",
    heroDesc: "Convert PDFs to Images or merge images into PDFs directly in your browser. Brutally simple, fast, and secure.",
    pdfToPng: "PDF to Image",
    pngToPdf: "Image to PDF",
    mergePdf: "Merge PDF",
    flattenPdf: "Flatten PDF",
    splitPdf: "Split PDF",
    pdfToPptx: "PDF to PPTX",
    workspace: "WORKSPACE",
    results: "QUEUE / RESULTS",
    preview: "PREVIEW",
    inputSource: "INPUT SOURCE",
    processing: "PROCESSING...",
    processingDesc: "Crunching data on your device.",
    eta: "Est. Time: ",
    etaSeconds: "s remaining",
    error: "ERROR",
    ready: "FILES IN QUEUE",
    mergeBack: "MERGE TO PDF",
    flattenMerge: "FLATTEN & MERGE",
    downloadZip: "DOWNLOAD ZIP",
    saveToFolder: "SAVE TO FOLDER",
    closePreview: "CLOSE",
    size: "Size",
    clientSide: "CLIENT-SIDE",
    footerTitle: "ParsePDF",
    footerDesc: "Handcrafted with <3 and lots of caffeine.",
    dropTitle: "DROP FILES HERE",
    dropDescPdf: "Upload PDF(s). Multiple files will be processed sequentially.",
    dropDescImg: "Upload images to merge. Drag to reorder.",
    dropDescMerge: "Upload multiple PDFs to merge. Drag to reorder.",
    dropDescFlatten: "Upload PDFs to flatten into images then merge.",
    dropDescSplit: "Upload PDF(s) to split pages.",
    dropDescPptx: "Upload PDF(s) to convert to PowerPoint slides.",
    browse: "BROWSE FILES",
    delete: "DEL",
    edit: "EDIT",
    crop: "CROP",
    rotate: "ROTATE",
    adjust: "ADJUST",
    download: "DL",
    editor: "EDITOR",
    addMore: "ADD FILES",
    dropToAdd: "DROP TO ADD FILES",
    expand: "Expand",
    quality: "Compression / Quality",
    qualityDesc: "Lower quality reduces file size (JPG only).",
    format: "Output Format",
    filename: "Output Filename",
    filenamePlaceholder: "e.g. MyResult (renames all files)",
    pptxEditable: "Editable Conversion",
    pptxEditableDesc: "Separates text and images to create fully editable slides. (Not for scanned PDFs)",
    // Modal
    modalTitle: "Select Pages",
    modalDesc: "Enter page numbers or ranges to extract (e.g. 1-3, 5, 8). Each selected page will be saved as a separate file.",
    modalPlaceholder: "e.g. 1-5, 8",
    modalConvert: "CONVERT",
    modalCancel: "CANCEL",
    modalInvalid: "Invalid format. Check page numbers.",
    modalSelectAll: "Select All",
    modalEmpty: "Please enter page numbers.",
    modalOutOfRange: "Page {n} exceeds limit ({t}).",
    modalInvalidChar: "Invalid character: '{c}'.",
    // Tooltips & Toasts
    ttClientSide: "All processing happens in your browser. No uploads.",
    ttLang: "Switch Language / 언어 변경",
    ttGithub: "View Source Code",
    ttPdfToPng: "Extract images (PNG/JPG) from PDF pages",
    ttPngToPdf: "Combine multiple images into one PDF",
    ttSplitPdf: "Extract specific pages into separate PDFs",
    ttMergePdf: "Combine multiple PDFs into one",
    ttFlattenPdf: "Rasterize PDF pages into images then merge",
    ttPdfToPptx: "Convert PDF pages to PowerPoint slides",
    ttAddFiles: "Add more files to the queue",
    ttDownload: "Download file",
    ttDelete: "Remove file",
    ttCrop: "Crop image",
    ttAdjust: "Adjust brightness & contrast",
    ttRotate: "Rotate 90° clockwise",
    ttEdit: "Open drawing editor",
    ttClose: "Close preview",
    ttDownloadZip: "Download all files as ZIP",
    ttSaveToFolder: "Save all files to a specific folder (Chrome/Edge)",
    ttMergeAction: "Process and Download PDF",
    toastDlStarted: "Download started. Check your downloads folder.",
    toastSaveSuccess: "All files saved successfully!",
    toastSaveError: "Failed to save to folder. Try downloading individual files.",
    toastSaveStart: "Saving files to selected folder..."
  },
  ko: {
    heroTag: "클라우드 X • 개인정보 보호",
    heroTitle: "문서 관리의 ",
    heroTitleHighlight: "새로운 기준",
    heroDesc: "브라우저에서 직접 PDF를 이미지로 변환하거나 이미지를 PDF로 합치세요. 빠르고, 안전하고, 단순합니다.",
    pdfToPng: "PDF → 이미지",
    pngToPdf: "이미지 → PDF",
    mergePdf: "PDF 합치기",
    flattenPdf: "PDF 이미지 병합",
    splitPdf: "PDF 분할",
    pdfToPptx: "PDF → PPTX",
    workspace: "작업 공간",
    results: "대기열 / 결과물",
    preview: "미리보기",
    inputSource: "입력 파일",
    processing: "처리 중...",
    processingDesc: "기기에서 직접 처리하고 있습니다.",
    eta: "예상 시간: ",
    etaSeconds: "초 남음",
    error: "오류 발생",
    ready: "개의 파일 대기 중",
    mergeBack: "PDF로 합치기",
    flattenMerge: "평탄화 및 합치기",
    downloadZip: "ZIP 다운로드",
    saveToFolder: "폴더에 저장",
    closePreview: "닫기",
    size: "크기",
    clientSide: "클라이언트 전용",
    footerTitle: "ParsePDF",
    footerDesc: "개인정보 보호를 위해 정성껏 만들었습니다.",
    dropTitle: "파일을 여기에 놓으세요",
    dropDescPdf: "PDF를 업로드하세요. 여러 파일을 순차적으로 처리합니다.",
    dropDescImg: "이미지를 업로드하세요. 드래그하여 순서를 변경할 수 있습니다.",
    dropDescMerge: "합칠 PDF 파일들을 업로드하세요. 순서를 변경할 수 있습니다.",
    dropDescFlatten: "이미지로 변환하여 합칠 PDF들을 업로드하세요.",
    dropDescSplit: "분할할 PDF를 업로드하세요.",
    dropDescPptx: "PDF를 업로드하세요. PPT 슬라이드로 변환됩니다.",
    browse: "파일 찾기",
    delete: "삭제",
    edit: "편집",
    crop: "자르기",
    rotate: "회전",
    adjust: "보정",
    download: "다운",
    editor: "이미지 편집",
    addMore: "파일 추가",
    dropToAdd: "여기에 놓아서 추가",
    expand: "펼치기",
    quality: "압축 / 품질",
    qualityDesc: "품질을 낮추면 파일 크기가 줄어듭니다 (JPG 전용).",
    format: "출력 형식",
    filename: "파일 이름 설정",
    filenamePlaceholder: "예: 결과물 (모든 파일 이름 변경)",
    pptxEditable: "편집 변환 모드",
    pptxEditableDesc: "PDF의 텍스트와 이미지를 분리하여 편집 가능한 슬라이드로 변환합니다. (스캔된 문서는 지원하지 않음)",
    // Modal
    modalTitle: "페이지 선택",
    modalDesc: "변환할 페이지 번호나 범위를 입력하세요 (예: 1-3, 5, 8). 선택한 페이지는 각각 별도의 파일로 저장됩니다.",
    modalPlaceholder: "예: 1-5, 8",
    modalConvert: "변환 시작",
    modalCancel: "취소",
    modalInvalid: "형식이 올바르지 않거나 페이지 범위를 벗어났습니다.",
    modalSelectAll: "전체 선택",
    modalEmpty: "페이지 번호를 입력해주세요.",
    modalOutOfRange: "{n}페이지는 전체({t})를 초과합니다.",
    modalInvalidChar: "잘못된 문자입니다: '{c}'.",
    // Tooltips & Toasts
    ttClientSide: "모든 처리는 브라우저 내에서 이루어집니다.",
    ttLang: "언어 변경 / Switch Language",
    ttGithub: "소스 코드 보기",
    ttPdfToPng: "PDF 페이지를 이미지(PNG/JPG)로 추출합니다",
    ttPngToPdf: "여러 이미지를 하나의 PDF로 합칩니다",
    ttSplitPdf: "특정 페이지를 별도의 PDF로 분리합니다",
    ttMergePdf: "여러 PDF 파일을 하나로 합칩니다",
    ttFlattenPdf: "PDF를 이미지로 변환하여 병합합니다 (편집 방지)",
    ttPdfToPptx: "PDF 페이지를 PPT 슬라이드로 변환합니다",
    ttAddFiles: "대기열에 파일 추가",
    ttDownload: "파일 다운로드",
    ttDelete: "파일 제거",
    ttCrop: "이미지 자르기",
    ttAdjust: "밝기 및 대비 조절",
    ttRotate: "시계 방향 90도 회전",
    ttEdit: "그리기 에디터 열기",
    ttClose: "미리보기 닫기",
    ttDownloadZip: "모든 파일 ZIP 다운로드",
    ttSaveToFolder: "특정 폴더를 선택하여 모든 파일 저장 (Chrome/Edge)",
    ttMergeAction: "처리 및 PDF 다운로드",
    toastDlStarted: "다운로드가 시작되었습니다. 다운로드 폴더를 확인하세요.",
    toastSaveSuccess: "모든 파일이 성공적으로 저장되었습니다!",
    toastSaveError: "폴더 저장 실패. 파일별 다운로드를 이용해주세요.",
    toastSaveStart: "선택한 폴더에 파일을 저장하는 중..."
  }
};

interface GeneratedFile {
  id: string;
  name: string;
  url: string;
  blob: Blob;
}

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [mode, setMode] = useState<ConversionMode>(ConversionMode.PDF_TO_PNG);
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  
  // Replaced single currentFile with a queue
  const [queue, setQueue] = useState<FileItem[]>([]);
  
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [editingFile, setEditingFile] = useState<GeneratedFile | null>(null);
  const [editorInitialMode, setEditorInitialMode] = useState<ToolMode>('draw');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quality, setQuality] = useState(0.9);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [outputFilename, setOutputFilename] = useState('');
  const [pptxEditable, setPptxEditable] = useState(true); // Default to true for better UX
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Collapsed state for Results panel
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);

  // Hidden input ref for "Add More" functionality
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // New state for page selection
  const [pendingPdf, setPendingPdf] = useState<{ file: File, count: number } | null>(null);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

  // Helper to determine layout state
  const isPreviewMode = !!previewFile || !!editingFile;

  // Track start time for ETA calculation
  const startTimeRef = useRef<number>(0);

  // Auto-collapse results when entering preview mode
  useEffect(() => {
    if (isPreviewMode) {
      setIsResultsCollapsed(true);
    } else {
      setIsResultsCollapsed(false);
    }
  }, [isPreviewMode]);

  // Dnd Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
        coordinateGetter: (_event: any, _args: any) => {
            return { x: 0, y: 0 };
        }
    })
  );

  useEffect(() => {
    setStatus(ProcessStatus.IDLE);
    setQueue([]);
    setGeneratedFiles([]);
    setPreviewFile(null);
    setEditingFile(null);
    setPendingPdf(null);
    setOutputFilename('');
    // Ensure editable is true by default when switching modes to PPTX
    if (mode === ConversionMode.PDF_TO_PPTX) {
        setPptxEditable(true);
    }
    
    // Reset quality logic: Merge defaults to lossless (1.0), others to 0.9
    if (mode === ConversionMode.MERGE_PDF) {
        setQuality(1.0);
    } else {
        setQuality(0.9);
    }
  }, [mode]);

  // Helper for dynamic renaming of files based on user input
  const getEffectiveFilename = useCallback((file: GeneratedFile, index?: number) => {
    if (!outputFilename.trim()) return file.name;
    
    // If index is not provided, find it
    if (typeof index === 'undefined') {
        index = generatedFiles.findIndex(f => f.id === file.id);
    }
    
    if (index === -1) return file.name;
    
    const ext = file.name.split('.').pop();
    // Rename sequentially: BaseName_1.ext, BaseName_2.ext, etc.
    return `${outputFilename.trim()}_${index + 1}.${ext}`;
  }, [outputFilename, generatedFiles]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- QUEUE PROCESSOR ---
  // Watches the queue and processes files sequentially
  useEffect(() => {
    const processNextInQueue = async () => {
        // Find the next item that is QUEUED
        const nextItemIndex = queue.findIndex(item => item.status === ProcessStatus.QUEUED);
        
        // If nothing to process or something is currently processing, return
        if (nextItemIndex === -1 || queue.some(item => item.status === ProcessStatus.PROCESSING)) {
            return;
        }

        const item = queue[nextItemIndex];

        // START TIMER for ETA calculation
        startTimeRef.current = Date.now();

        // Update status to PROCESSING
        setQueue(prev => {
            const newQ = [...prev];
            newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.PROCESSING, progress: 0, estimatedRemaining: undefined };
            return newQ;
        });

        // Set overall app status
        setStatus(ProcessStatus.PROCESSING);

        // Define progress callback
        const onProgressCallback = (current: number, total: number) => {
            setQueue(prev => {
                const newQ = [...prev];
                if (newQ[nextItemIndex]) {
                    newQ[nextItemIndex].progress = (current / total) * 100;

                    // Calculate ETA
                    if (current > 0) {
                        const elapsedMs = Date.now() - startTimeRef.current;
                        const msPerItem = elapsedMs / current;
                        const remainingItems = total - current;
                        const remainingSeconds = Math.ceil((msPerItem * remainingItems) / 1000);
                        
                        // Only update if reasonable
                        if (remainingSeconds >= 0 && remainingSeconds < 3600) {
                            newQ[nextItemIndex].estimatedRemaining = remainingSeconds;
                        }
                    }
                }
                return newQ;
            });
        };

        try {
            let blobs: Blob[] = [];
            
            if (mode === ConversionMode.SPLIT_PDF) {
                // For Split, if we auto-queued, we assume "All Pages" (1 to count)
                const count = await getPdfPageCount(item.file);
                const pages = Array.from({ length: count }, (_, i) => i + 1);
                
                blobs = await splitPdf(item.file, pages, onProgressCallback);
            } else if (mode === ConversionMode.PDF_TO_PNG) {
                // Determine format
                const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
                
                // Default to all pages for queue items
                blobs = await convertPdfToImages(
                  item.file, 
                  onProgressCallback,
                  undefined, // all pages
                  mimeType,
                  quality
                );
            } else if (mode === ConversionMode.PDF_TO_PPTX) {
                // Single PPTX blob returned
                const pptxBlob = await convertPdfToPptx(
                    item.file,
                    onProgressCallback,
                    undefined,
                    pptxEditable // Pass editable flag
                );
                blobs = [pptxBlob];
            }

            // Determine extension based on mode and format
            let extension = 'dat';
            if (mode === ConversionMode.SPLIT_PDF) extension = 'pdf';
            else if (mode === ConversionMode.PDF_TO_PPTX) extension = 'pptx';
            else extension = outputFormat === 'png' ? 'png' : 'jpg';

            const newGeneratedFiles = blobs.map((blob, idx) => ({
                id: `page-${item.id}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                name: mode === 'PDF_TO_PPTX' 
                    ? item.file.name.replace('.pdf', '.pptx') 
                    : `${item.file.name.replace('.pdf', '')}_page_${idx + 1}.${extension}`,
                url: URL.createObjectURL(blob),
                blob: blob
            }));

            setGeneratedFiles(prev => [...prev, ...newGeneratedFiles]);
            
            // Mark Item Completed
            setQueue(prev => {
                const newQ = [...prev];
                newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.COMPLETED, progress: 100, estimatedRemaining: undefined };
                return newQ;
            });

        } catch (err: any) {
            console.error(err);
            setQueue(prev => {
                const newQ = [...prev];
                newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.ERROR, errorMessage: err.message, estimatedRemaining: undefined };
                return newQ;
            });
            addToast(`Error processing file: ${err.message}`, 'error');
        } finally {
            // If this was the last item, reset status to COMPLETED (or IDLE if we want users to add more)
            // But we will keep it as COMPLETED to show the pipeline state
             const isQueueFinished = queue.every((q, i) => i === nextItemIndex || q.status === ProcessStatus.COMPLETED || q.status === ProcessStatus.ERROR);
             if (isQueueFinished) {
                 setStatus(ProcessStatus.COMPLETED);
             }
        }
    };

    processNextInQueue();
  }, [queue, mode, outputFormat, quality, pptxEditable]);

  // --- HANDLERS ---

  const handleFilesDropped = async (files: File[]) => {
    // Determine target based on mode
    if (mode === 'PDF_TO_PNG' || mode === 'SPLIT_PDF') {
        // Special case: Single file processing for Page Selection modal or sequential
        if (files.length === 1 && files[0].type === 'application/pdf') {
             try {
                const count = await getPdfPageCount(files[0]);
                // Trigger Modal
                setPendingPdf({ file: files[0], count });
                return;
             } catch (e) {
                console.error("Failed to read PDF for modal", e);
                // Fallback to queueing
             }
        }
    }

    // Add to Queue (or Generated list for PNG_TO_PDF)
    if (mode === 'PNG_TO_PDF' || mode === 'MERGE_PDF' || mode === 'FLATTEN_PDF') {
         const newFiles = files.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            name: f.name,
            url: URL.createObjectURL(f),
            blob: f
         }));
         setGeneratedFiles(prev => [...prev, ...newFiles]);
         setStatus(ProcessStatus.IDLE); // Ready to merge
    } else {
        // For processing modes (PDF -> PNG, Split, PPTX)
        const newQueueItems: FileItem[] = files.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            file: f,
            status: ProcessStatus.QUEUED,
            progress: 0
        }));
        setQueue(prev => [...prev, ...newQueueItems]);
    }
  };

  const handleModalConfirm = async (pages: number[]) => {
    if (!pendingPdf) return;
    
    setStatus(ProcessStatus.PROCESSING);
    setPendingPdf(null); // Close modal
    startTimeRef.current = Date.now();

    // Custom logic for modal confirmation needs to calculate its own progress
    // Since this bypasses the main queue effect, we simulate a "single item queue" UI or just use a toast
    // However, to keep it consistent, let's just do it here and use a global loading state.
    // Ideally we would add to queue with "pages" metadata, but for now direct execution:

    try {
        let blobs: Blob[] = [];
        const onProgressCallback = (c: number, t: number) => {
            // Can't update queue visual easily here without adding to queue. 
            // Just let it spin.
        };

        if (mode === ConversionMode.PDF_TO_PNG) {
             blobs = await convertPdfToImages(
                pendingPdf.file, 
                onProgressCallback,
                pages,
                outputFormat === 'png' ? 'image/png' : 'image/jpeg',
                quality
             );
        } else if (mode === ConversionMode.SPLIT_PDF) {
             blobs = await splitPdf(pendingPdf.file, pages, onProgressCallback);
        }

        let extension = mode === 'SPLIT_PDF' ? 'pdf' : (outputFormat === 'png' ? 'png' : 'jpg');
        
        const newGeneratedFiles = blobs.map((blob, idx) => ({
            id: `page-${Math.random()}-${idx}`,
            name: `${pendingPdf.file.name.replace('.pdf', '')}_page_${pages[idx]}.${extension}`,
            url: URL.createObjectURL(blob),
            blob: blob
        }));

        setGeneratedFiles(prev => [...prev, ...newGeneratedFiles]);
        setStatus(ProcessStatus.COMPLETED);

    } catch (e: any) {
        addToast("Error converting specific pages: " + e.message, 'error');
        setStatus(ProcessStatus.ERROR);
    }
  };

  const handleMergeAction = async () => {
    if (generatedFiles.length === 0) return;
    
    setStatus(ProcessStatus.PROCESSING);
    try {
        const inputBlobs = generatedFiles.map(f => f.blob);
        let resultBlob: Blob;

        if (mode === 'PNG_TO_PDF') {
            resultBlob = await convertImagesToPdf(inputBlobs, (c, t) => {});
        } else if (mode === 'MERGE_PDF') {
            resultBlob = await mergePdfs(inputBlobs, (c, t) => {});
        } else if (mode === 'FLATTEN_PDF') {
            resultBlob = await flattenPdfs(inputBlobs, (c, t) => {});
        } else {
            return;
        }

        const url = URL.createObjectURL(resultBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = outputFilename ? `${outputFilename}.pdf` : `merged_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setStatus(ProcessStatus.COMPLETED);
        addToast(t('toastDlStarted'), 'success');
    } catch (e: any) {
        console.error(e);
        addToast("Merge failed: " + e.message, 'error');
        setStatus(ProcessStatus.ERROR);
    }
  };

  const handleDownload = (file: GeneratedFile, index: number) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = getEffectiveFilename(file, index);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllZip = async () => {
    if (generatedFiles.length === 0) return;
    const zip = new JSZip();
    
    generatedFiles.forEach((file, index) => {
        zip.file(getEffectiveFilename(file, index), file.blob);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = outputFilename ? `${outputFilename}.zip` : `parsepdf_result.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(t('toastDlStarted'), 'success');
  };

  const handleSaveToFolder = async () => {
     if (!window.showDirectoryPicker) {
         alert("Your browser does not support the File System Access API (Chrome/Edge/Desktop only).");
         return;
     }

     try {
         const dirHandle = await window.showDirectoryPicker();
         addToast(t('toastSaveStart'), 'info');
         
         for (let i = 0; i < generatedFiles.length; i++) {
             const file = generatedFiles[i];
             const name = getEffectiveFilename(file, i);
             const fileHandle = await dirHandle.getFileHandle(name, { create: true });
             const writable = await fileHandle.createWritable();
             await writable.write(file.blob);
             await writable.close();
         }
         addToast(t('toastSaveSuccess'), 'success');
     } catch (err) {
         console.error(err);
         // User aborted or error
         if ((err as Error).name !== 'AbortError') {
             addToast(t('toastSaveError'), 'error');
         }
     }
  };

  const handleDelete = (id: string) => {
    setGeneratedFiles(prev => prev.filter(f => f.id !== id));
    if (previewFile?.id === id) setPreviewFile(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setGeneratedFiles((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
  };

  const handleEditorSave = (newBlob: Blob) => {
      if (!editingFile) return;
      const newUrl = URL.createObjectURL(newBlob);
      
      setGeneratedFiles(prev => prev.map(f => {
          if (f.id === editingFile.id) {
              return { ...f, blob: newBlob, url: newUrl };
          }
          return f;
      }));
      
      setEditingFile(null);
      setPreviewFile(null); // Close preview if open
  };

  const openEditor = (file: GeneratedFile, initialMode: ToolMode = 'draw') => {
      setEditorInitialMode(initialMode);
      setEditingFile(file);
  };

  // --- RENDER ---

  const isMergeMode = ['PNG_TO_PDF', 'MERGE_PDF', 'FLATTEN_PDF'].includes(mode);
  const activeFile = activeId ? generatedFiles.find(f => f.id === activeId) : null;

  return (
    <div className="min-h-screen flex flex-col font-sans text-black selection:bg-accent selection:text-black animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="border-b-4 border-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary border-2 border-black p-2 shadow-neo-sm">
                <FileStack size={24} className="text-black" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">ParsePDF</h1>
            
            <div className="hidden md:flex gap-2 ml-8">
               <Tooltip content={t('ttGithub')}>
                  <a href="https://github.com/parsepdf" target="_blank" rel="noreferrer" className="p-2 border-2 border-black rounded-lg hover:bg-gray-100 transition-all hover:-translate-y-0.5 shadow-neo-sm">
                      <Github size={20} />
                  </a>
               </Tooltip>
               <Tooltip content={t('ttLang')}>
                  <button onClick={() => setLang(l => l === 'en' ? 'ko' : 'en')} className="p-2 border-2 border-black rounded-lg hover:bg-gray-100 transition-all hover:-translate-y-0.5 shadow-neo-sm font-bold flex gap-2 items-center">
                      <Globe size={20} />
                      <span className="text-xs">{lang.toUpperCase()}</span>
                  </button>
               </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-bold shadow-neo-sm animate-pulse">
                 <CheckCircle size={12} /> {t('ttClientSide')}
              </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow bg-[#FFF0F0] p-4 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar: Controls */}
            <div className="lg:col-span-3 space-y-6">
                <Card title={t('workspace')} icon={Layout}>
                    <div className="space-y-2">
                        {[
                            { id: ConversionMode.PDF_TO_PNG, label: t('pdfToPng'), icon: Images, desc: t('ttPdfToPng') },
                            { id: ConversionMode.PNG_TO_PDF, label: t('pngToPdf'), icon: FileArchive, desc: t('ttPngToPdf') },
                            { id: ConversionMode.MERGE_PDF, label: t('mergePdf'), icon: Files, desc: t('ttMergePdf') },
                            { id: ConversionMode.FLATTEN_PDF, label: t('flattenPdf'), icon: Layers, desc: t('ttFlattenPdf') },
                            { id: ConversionMode.SPLIT_PDF, label: t('splitPdf'), icon: Scissors, desc: t('ttSplitPdf') },
                            { id: ConversionMode.PDF_TO_PPTX, label: t('pdfToPptx'), icon: Presentation, desc: t('ttPdfToPptx') },
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setMode(m.id as ConversionMode)}
                                className={`w-full text-left px-4 py-3 border-2 rounded-lg font-bold flex items-center gap-3 transition-all duration-200 group relative ${
                                    mode === m.id 
                                    ? 'bg-primary border-black shadow-neo translate-x-1' 
                                    : 'bg-white border-transparent hover:border-black hover:bg-gray-50'
                                }`}
                            >
                                <m.icon size={20} />
                                <span className="text-sm">{m.label}</span>
                                {mode === m.id && <ArrowRight size={16} className="ml-auto animate-dash" />}
                                
                                {/* Hover Description Tooltip style */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-48 bg-black text-white text-xs p-2 rounded hidden group-hover:block z-50 pointer-events-none">
                                    {m.desc}
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-r-black border-t-transparent border-b-transparent border-l-transparent border-4"></div>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Configuration Panel */}
                {(mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.PNG_TO_PDF || mode === ConversionMode.FLATTEN_PDF || mode === ConversionMode.PDF_TO_PPTX) && (
                    <Card title="CONFIG" icon={Cog} className="animate-in slide-in-from-left-4 fade-in duration-300">
                        <div className="space-y-4">
                            {mode === ConversionMode.PDF_TO_PNG && (
                                <>
                                    <div>
                                        <label className="text-xs font-bold uppercase mb-1 block">{t('format')}</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setOutputFormat('png')} className={`flex-1 py-2 border-2 border-black rounded text-xs font-bold ${outputFormat === 'png' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}>PNG</button>
                                            <button onClick={() => setOutputFormat('jpg')} className={`flex-1 py-2 border-2 border-black rounded text-xs font-bold ${outputFormat === 'jpg' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}>JPG</button>
                                        </div>
                                    </div>
                                    {outputFormat === 'jpg' && (
                                        <div>
                                            <label className="text-xs font-bold uppercase mb-1 block">{t('quality')} ({Math.round(quality * 100)}%)</label>
                                            <input type="range" min="0.1" max="1.0" step="0.1" value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer border border-black" />
                                            <p className="text-[10px] text-gray-500 mt-1">{t('qualityDesc')}</p>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {(mode === ConversionMode.PNG_TO_PDF || mode === ConversionMode.FLATTEN_PDF) && (
                                 <div>
                                    <label className="text-xs font-bold uppercase mb-1 block">{t('quality')} (JPEG Compression)</label>
                                    <input type="range" min="0.5" max="1.0" step="0.1" value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer border border-black" />
                                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                        <span>Smaller File</span>
                                        <span>{Math.round(quality * 100)}%</span>
                                        <span>Better Quality</span>
                                    </div>
                                </div>
                            )}

                            {mode === ConversionMode.PDF_TO_PPTX && (
                                <div>
                                    <label className="flex items-start gap-2 cursor-pointer p-2 border border-black/10 rounded hover:bg-gray-50">
                                        <input 
                                            type="checkbox" 
                                            checked={pptxEditable} 
                                            onChange={(e) => setPptxEditable(e.target.checked)} 
                                            className="mt-1 w-4 h-4 accent-primary border-black"
                                        />
                                        <div>
                                            <span className="text-xs font-bold uppercase block">{t('pptxEditable')}</span>
                                            <span className="text-[10px] text-gray-500 leading-tight block">{t('pptxEditableDesc')}</span>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold uppercase mb-1 block">{t('filename')}</label>
                                <input 
                                    type="text" 
                                    value={outputFilename} 
                                    onChange={(e) => setOutputFilename(e.target.value)}
                                    placeholder={t('filenamePlaceholder')}
                                    className="w-full px-3 py-2 border-2 border-black rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-gray-50"
                                />
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Center & Right: Workspace */}
            <div className="lg:col-span-9 space-y-6">
                
                {/* Status Pipeline */}
                {(queue.length > 0 || generatedFiles.length > 0) && (
                    <Pipeline status={status} />
                )}

                {/* Drop Zone */}
                {queue.length === 0 && generatedFiles.length === 0 && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <DropZone 
                            mode={mode} 
                            onFilesDropped={handleFilesDropped}
                            disabled={status === ProcessStatus.PROCESSING}
                            translations={{
                                dropTitle: t('dropTitle'),
                                dropDesc: isMergeMode ? t('dropDescMerge') : mode === 'SPLIT_PDF' ? t('dropDescSplit') : mode === 'PDF_TO_PPTX' ? t('dropDescPptx') : t('dropDescPdf'),
                                browse: t('browse')
                            }}
                        />
                    </div>
                )}

                {/* Result Area */}
                {(generatedFiles.length > 0 || queue.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         
                        {/* Results / Queue List */}
                        <div className={`lg:col-span-${isResultsCollapsed ? '1' : '3'} transition-all duration-300`}>
                            <div className="bg-white border-2 border-black rounded-xl shadow-neo overflow-hidden flex flex-col h-[80vh]">
                                <div className="p-4 border-b-2 border-black bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-black text-white px-2 py-1 rounded text-xs font-bold">
                                            {generatedFiles.length + queue.filter(q => q.status !== ProcessStatus.COMPLETED).length}
                                        </div>
                                        <h3 className="font-bold uppercase">{isMergeMode ? t('inputSource') : t('results')}</h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="hidden" 
                                            ref={addFilesInputRef}
                                            onChange={(e) => {
                                                if(e.target.files && e.target.files.length > 0) {
                                                    handleFilesDropped(Array.from(e.target.files));
                                                }
                                            }}
                                            accept={isMergeMode ? (mode === 'PNG_TO_PDF' ? "image/*" : "application/pdf") : "application/pdf"} 
                                        />
                                        <Tooltip content={t('ttAddFiles')}>
                                            <Button size="sm" variant="secondary" onClick={() => addFilesInputRef.current?.click()}>
                                                <Plus size={16} className="mr-1" /> {t('addMore')}
                                            </Button>
                                        </Tooltip>

                                        {isMergeMode && (
                                            <Button size="sm" onClick={handleMergeAction} disabled={status === ProcessStatus.PROCESSING}>
                                                {status === ProcessStatus.PROCESSING ? (
                                                    <Clock size={16} className="animate-spin mr-2" />
                                                ) : (
                                                    <Download size={16} className="mr-2" />
                                                )}
                                                {t('ttMergeAction')}
                                            </Button>
                                        )}
                                        
                                        {!isMergeMode && generatedFiles.length > 0 && (
                                             <div className="flex gap-1">
                                                <Tooltip content={t('ttSaveToFolder')}>
                                                    <Button size="sm" variant="secondary" onClick={handleSaveToFolder}>
                                                        <FolderDown size={16} />
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip content={t('ttDownloadZip')}>
                                                    <Button size="sm" onClick={handleDownloadAllZip}>
                                                        <FileArchive size={16} className="mr-2"/> {t('downloadZip')}
                                                    </Button>
                                                </Tooltip>
                                             </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 overflow-y-auto flex-grow bg-[#f8f9fa]">
                                    <DndContext 
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext 
                                            items={generatedFiles.map(f => f.id)}
                                            strategy={rectSortingStrategy}
                                        >
                                            <div className={`grid gap-4 ${isResultsCollapsed ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                                                {generatedFiles.map((file, index) => (
                                                    <SortableFileCard
                                                        key={file.id}
                                                        id={file.id}
                                                        file={file}
                                                        isActive={previewFile?.id === file.id}
                                                        onPreview={() => { setPreviewFile(file); setIsResultsCollapsed(true); }}
                                                        onDelete={() => handleDelete(file.id)}
                                                        onDownload={() => handleDownload(file, index)}
                                                        translations={{ delete: t('delete'), download: t('download') }}
                                                    />
                                                ))}
                                                {/* Loading Skeletons for Queue - Only showing NON-COMPLETED items */}
                                                {queue
                                                    .filter(item => item.status !== ProcessStatus.COMPLETED)
                                                    .map((item) => (
                                                    <div key={item.id} className={`aspect-square border-2 border-dashed ${item.status === ProcessStatus.ERROR ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg flex flex-col items-center justify-center p-4 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300`}>
                                                        {item.status === ProcessStatus.ERROR ? (
                                                            <>
                                                                <AlertCircle size={24} className="text-red-500 mb-2" />
                                                                <span className="text-xs font-bold text-red-500 uppercase text-center break-words w-full">{t('error')}</span>
                                                                <p className="text-[10px] text-red-400 text-center mt-1 leading-tight px-1">{item.errorMessage?.substring(0, 60)}...</p>
                                                                <button onClick={() => setQueue(q => q.filter(i => i.id !== item.id))} className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors">
                                                                    <X size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock size={24} className="text-gray-400 mb-2 animate-spin" />
                                                                <span className="text-xs font-bold text-gray-400 uppercase">{t('processing')}</span>
                                                                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                                                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                                                                </div>
                                                                {item.estimatedRemaining !== undefined && (
                                                                    <div className="mt-2 text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                                                        <Timer size={10} />
                                                                        {t('eta')} {item.estimatedRemaining} {t('etaSeconds')}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </SortableContext>
                                        
                                        <DragOverlay>
                                            {activeFile ? <FileCardOverlay file={activeFile} /> : null}
                                        </DragOverlay>
                                    </DndContext>

                                    {generatedFiles.length === 0 && queue.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                            <UploadCloud size={48} className="mb-4" />
                                            <p className="font-bold text-xl uppercase">{t('dropToAdd')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Preview / Editor Panel */}
                        {isResultsCollapsed && (
                            <div className="lg:col-span-2 h-[80vh] flex flex-col animate-in slide-in-from-right-8 duration-300">
                                <div className="bg-white border-2 border-black rounded-xl shadow-neo flex flex-col h-full overflow-hidden relative">
                                    <div className="p-3 border-b-2 border-black bg-gray-50 flex justify-between items-center shrink-0">
                                        <h3 className="font-bold uppercase flex items-center gap-2">
                                            <Eye size={16}/> {t('preview')}
                                        </h3>
                                        <div className="flex gap-2">
                                            {/* Edit Tools (Only for images) */}
                                            {previewFile && (previewFile.name.endsWith('.png') || previewFile.name.endsWith('.jpg')) && (
                                                <>
                                                    <Tooltip content={t('ttCrop')}>
                                                        <button onClick={() => openEditor(previewFile, 'crop')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-black hover:shadow-neo-sm"><Crop size={16}/></button>
                                                    </Tooltip>
                                                    <Tooltip content={t('ttRotate')}>
                                                        <button onClick={() => openEditor(previewFile, 'draw')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-black hover:shadow-neo-sm"><RotateCw size={16}/></button>
                                                    </Tooltip>
                                                    <Tooltip content={t('ttAdjust')}>
                                                        <button onClick={() => openEditor(previewFile, 'adjust')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-black hover:shadow-neo-sm"><SlidersHorizontal size={16}/></button>
                                                    </Tooltip>
                                                    <div className="w-px bg-gray-300 mx-1"></div>
                                                    <Tooltip content={t('ttEdit')}>
                                                        <Button size="sm" onClick={() => openEditor(previewFile, 'draw')} className="h-7 px-3 text-xs">
                                                            <Pencil size={12} className="mr-1"/> {t('edit')}
                                                        </Button>
                                                    </Tooltip>
                                                </>
                                            )}
                                            <Tooltip content={t('ttClose')}>
                                                <button onClick={() => { setPreviewFile(null); setEditingFile(null); setIsResultsCollapsed(false); }} className="p-1.5 bg-black text-white rounded hover:bg-gray-800">
                                                    <X size={16} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-grow bg-gray-100 flex items-center justify-center p-4 overflow-hidden relative">
                                        {/* Image Editor Overlay */}
                                        {editingFile ? (
                                            <div className="absolute inset-0 z-20">
                                                <ImageEditor 
                                                    file={editingFile} 
                                                    onSave={handleEditorSave} 
                                                    onClose={() => setEditingFile(null)}
                                                    initialMode={editorInitialMode}
                                                />
                                            </div>
                                        ) : (
                                            previewFile && (
                                                (previewFile.name.endsWith('.png') || previewFile.name.endsWith('.jpg')) ? (
                                                    <img src={previewFile.url} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" />
                                                ) : (
                                                    <iframe src={previewFile.url} className="w-full h-full bg-white shadow-lg border border-gray-200" title="PDF Preview"></iframe>
                                                )
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
             <h2 className="text-2xl font-black uppercase mb-2">{t('footerTitle')}</h2>
             <p className="font-bold text-gray-500">{t('footerDesc')}</p>
        </div>
      </footer>

      {/* Modals */}
      {pendingPdf && (
         <PageSelectionModal 
            fileName={pendingPdf.file.name}
            fileSize={pendingPdf.file.size}
            totalPageCount={pendingPdf.count}
            onConfirm={handleModalConfirm}
            onCancel={() => setPendingPdf(null)}
            translations={{
                title: t('modalTitle'),
                desc: t('modalDesc'),
                placeholder: t('modalPlaceholder'),
                convert: t('modalConvert'),
                cancel: t('modalCancel'),
                invalid: t('modalInvalid'),
                selectAll: t('modalSelectAll'),
                empty: t('modalEmpty'),
                outOfRange: t('modalOutOfRange'),
                invalidChar: t('modalInvalidChar')
            }}
         />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
              <Toast 
                  key={toast.id}
                  id={toast.id}
                  message={toast.message}
                  type={toast.type}
                  onClose={removeToast}
              />
          ))}
      </div>
    </div>
  );
}
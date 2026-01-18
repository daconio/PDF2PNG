import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Images, FileText, CheckCircle, ArrowRight, Download, Github, FileArchive, X, Eye, Pencil, FileStack, Globe, Cog, Crop, RotateCw, SlidersHorizontal, Files, Layers, Plus, UploadCloud, Scissors, ChevronDown, ChevronUp, Clock, AlertCircle, FileType } from 'lucide-react';
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
import { convertPdfToImages, convertImagesToPdf, getPdfPageCount, rotateImage, mergePdfs, flattenPdfs, splitPdf } from './services/pdfService';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { DropZone } from './components/DropZone';
import { Pipeline } from './components/Pipeline';
import { ImageEditor, ToolMode } from './components/ImageEditor';
import { PageSelectionModal } from './components/PageSelectionModal';
import { SortableFileCard, FileCardOverlay } from './components/SortableFileCard';
import { Tooltip } from './components/Tooltip';
import JSZip from 'jszip';

type Language = 'ko' | 'en';
type OutputFormat = 'png' | 'jpg';

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
    workspace: "WORKSPACE",
    results: "QUEUE / RESULTS",
    preview: "PREVIEW",
    inputSource: "INPUT SOURCE",
    processing: "PROCESSING...",
    processingDesc: "Crunching data on your device.",
    ready: "FILES IN QUEUE",
    mergeBack: "MERGE TO PDF",
    flattenMerge: "FLATTEN & MERGE",
    downloadZip: "DOWNLOAD ZIP",
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
    // Modal
    modalTitle: "Select Pages",
    modalDesc: "Enter page numbers or ranges to extract (e.g. 1-3, 5, 8). Each selected page will be saved as a separate file.",
    modalPlaceholder: "e.g. 1-5, 8",
    modalConvert: "CONVERT",
    modalCancel: "CANCEL",
    modalInvalid: "Invalid format. Check page numbers.",
    modalSelectAll: "Select All",
    // Tooltips
    ttClientSide: "All processing happens in your browser. No uploads.",
    ttLang: "Switch Language / 언어 변경",
    ttGithub: "View Source Code",
    ttPdfToPng: "Extract images (PNG/JPG) from PDF pages",
    ttPngToPdf: "Combine multiple images into one PDF",
    ttSplitPdf: "Extract specific pages into separate PDFs",
    ttMergePdf: "Combine multiple PDFs into one",
    ttFlattenPdf: "Rasterize PDF pages into images then merge",
    ttAddFiles: "Add more files to the queue",
    ttDownload: "Download file",
    ttDelete: "Remove file",
    ttCrop: "Crop image",
    ttAdjust: "Adjust brightness & contrast",
    ttRotate: "Rotate 90° clockwise",
    ttEdit: "Open drawing editor",
    ttClose: "Close preview",
    ttDownloadZip: "Download all files as ZIP",
    ttMergeAction: "Process and Download PDF"
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
    workspace: "작업 공간",
    results: "대기열 / 결과물",
    preview: "미리보기",
    inputSource: "입력 파일",
    processing: "처리 중...",
    processingDesc: "기기에서 직접 처리하고 있습니다.",
    ready: "개의 파일 대기 중",
    mergeBack: "PDF로 합치기",
    flattenMerge: "평탄화 및 합치기",
    downloadZip: "ZIP 다운로드",
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
    // Modal
    modalTitle: "페이지 선택",
    modalDesc: "변환할 페이지 번호나 범위를 입력하세요 (예: 1-3, 5, 8). 선택한 페이지는 각각 별도의 파일로 저장됩니다.",
    modalPlaceholder: "예: 1-5, 8",
    modalConvert: "변환 시작",
    modalCancel: "취소",
    modalInvalid: "형식이 올바르지 않거나 페이지 범위를 벗어났습니다.",
    modalSelectAll: "전체 선택",
    // Tooltips
    ttClientSide: "모든 처리는 브라우저 내에서 이루어집니다.",
    ttLang: "언어 변경 / Switch Language",
    ttGithub: "소스 코드 보기",
    ttPdfToPng: "PDF 페이지를 이미지(PNG/JPG)로 추출합니다",
    ttPngToPdf: "여러 이미지를 하나의 PDF로 합칩니다",
    ttSplitPdf: "특정 페이지를 별도의 PDF로 분리합니다",
    ttMergePdf: "여러 PDF 파일을 하나로 합칩니다",
    ttFlattenPdf: "PDF를 이미지로 변환하여 병합합니다 (편집 방지)",
    ttAddFiles: "대기열에 파일 추가",
    ttDownload: "파일 다운로드",
    ttDelete: "파일 제거",
    ttCrop: "이미지 자르기",
    ttAdjust: "밝기 및 대비 조절",
    ttRotate: "시계 방향 90도 회전",
    ttEdit: "그리기 에디터 열기",
    ttClose: "미리보기 닫기",
    ttDownloadZip: "모든 파일 ZIP 다운로드",
    ttMergeAction: "처리 및 PDF 다운로드"
  }
};

interface GeneratedFile {
  id: string;
  name: string;
  url: string;
  blob: Blob;
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
  
  // Collapsed state for Results panel
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);

  // Hidden input ref for "Add More" functionality
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // New state for page selection
  const [pendingPdf, setPendingPdf] = useState<{ file: File, count: number } | null>(null);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

  // Helper to determine layout state
  const isPreviewMode = !!previewFile || !!editingFile;

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
    
    // Reset quality logic: Merge defaults to lossless (1.0), others to 0.9
    if (mode === ConversionMode.MERGE_PDF) {
        setQuality(1.0);
    } else {
        setQuality(0.9);
    }
  }, [mode]);

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

        // Update status to PROCESSING
        setQueue(prev => {
            const newQ = [...prev];
            newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.PROCESSING, progress: 0 };
            return newQ;
        });

        // Set overall app status
        setStatus(ProcessStatus.PROCESSING);

        try {
            let blobs: Blob[] = [];
            
            if (mode === ConversionMode.SPLIT_PDF) {
                // For Split, if we auto-queued, we assume "All Pages" (1 to count)
                // If it came from modal, we might have specific pages logic, but for batch queue let's default to all or single PDF logic
                // NOTE: To simplify batch processing, we split ALL pages for batch files.
                const count = await getPdfPageCount(item.file);
                const pages = Array.from({ length: count }, (_, i) => i + 1);
                
                blobs = await splitPdf(item.file, pages, (current, total) => {
                    setQueue(prev => {
                        const newQ = [...prev];
                        if (newQ[nextItemIndex]) {
                            newQ[nextItemIndex].progress = (current / total) * 100;
                        }
                        return newQ;
                    });
                });
            } else if (mode === ConversionMode.PDF_TO_PNG) {
                // Determine format
                const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
                
                // Default to all pages for queue items
                blobs = await convertPdfToImages(
                  item.file, 
                  (current, total) => {
                     setQueue(prev => {
                        const newQ = [...prev];
                        if (newQ[nextItemIndex]) {
                            newQ[nextItemIndex].progress = (current / total) * 100;
                        }
                        return newQ;
                    });
                  },
                  undefined, // all pages
                  mimeType,
                  quality
                );
            }

            // Determine extension based on mode and format
            let extension = 'dat';
            if (mode === ConversionMode.SPLIT_PDF) extension = 'pdf';
            else extension = outputFormat === 'png' ? 'png' : 'jpg';

            const newGeneratedFiles = blobs.map((blob, idx) => ({
                id: `page-${item.id}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                name: `${item.file.name.replace(/\.pdf$/i, '')}_${idx + 1}.${extension}`,
                url: URL.createObjectURL(blob),
                blob: blob
            }));

            // Add to results
            setGeneratedFiles(prev => [...prev, ...newGeneratedFiles]);
            
            // Mark item as COMPLETED
            setQueue(prev => {
                const newQ = [...prev];
                newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.COMPLETED, progress: 100 };
                return newQ;
            });

        } catch (error) {
            console.error(error);
            setQueue(prev => {
                const newQ = [...prev];
                newQ[nextItemIndex] = { ...newQ[nextItemIndex], status: ProcessStatus.ERROR };
                return newQ;
            });
        }
    };

    // Trigger processing if we have queued items
    if (queue.some(i => i.status === ProcessStatus.QUEUED)) {
        processNextInQueue();
    } else if (queue.length > 0 && queue.every(i => i.status === ProcessStatus.COMPLETED || i.status === ProcessStatus.ERROR)) {
        // All done
        setStatus(ProcessStatus.COMPLETED);
    }
  }, [queue, mode, outputFormat, quality]);


  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    // For PDF splitting or PDF to PNG
    if (mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF) {
        // If single file, show modal to allow specific page selection
        if (files.length === 1) {
            try {
                const pdfFile = files[0];
                const count = await getPdfPageCount(pdfFile);
                setPendingPdf({ file: pdfFile, count });
                return;
            } catch (error) {
                console.error(error);
                setStatus(ProcessStatus.ERROR);
                return;
            }
        }

        // Batch Mode / Add to Queue
        // Add all files to queue with status QUEUED
        const newQueueItems: FileItem[] = files.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            file: f,
            status: ProcessStatus.QUEUED,
            progress: 0
        }));

        setQueue(prev => [...prev, ...newQueueItems]);
        setStatus(ProcessStatus.PROCESSING);
        setPendingPdf(null); // Ensure modal is closed

    } else {
        // Queue Mode (Append to list for Merge/Flatten)
        // PNG_TO_PDF, MERGE_PDF, FLATTEN_PDF
        
        // If we were in IDLE, move to COMPLETED (Ready state) to show list
        if (status === ProcessStatus.IDLE) {
            setStatus(ProcessStatus.COMPLETED);
        }

        const newFiles = files.map((f, idx) => ({
            id: `file-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: f.name,
            url: URL.createObjectURL(f),
            blob: f
        }));
        
        setGeneratedFiles(prev => [...prev, ...newFiles]);
        
        // Auto-preview first added file if none selected
        if (!previewFile && newFiles.length > 0) {
            setPreviewFile(newFiles[0]);
        }
    }
  }, [mode, status, previewFile, generatedFiles.length, queue.length]);

  // --- Paste Support ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        // If user is editing text inside input (like in image editor), ignore
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
        }

        if (e.clipboardData && e.clipboardData.items) {
            const items = Array.from(e.clipboardData.items);
            const files: File[] = [];
            
            items.forEach(item => {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        // Check if file type matches current mode
                        const isImage = file.type.startsWith('image/');
                        const isPdf = file.type === 'application/pdf';

                        if (mode === ConversionMode.PNG_TO_PDF && isImage) {
                            files.push(file);
                        } else if ((mode === ConversionMode.MERGE_PDF || mode === ConversionMode.FLATTEN_PDF) && isPdf) {
                            files.push(file);
                        } else if ((mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF) && isPdf) {
                            files.push(file);
                        }
                    }
                }
            });

            if (files.length > 0) {
                handleFiles(files);
            }
        }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles, mode]);

  const handleAddFilesClick = () => {
    if (addFilesInputRef.current) {
        addFilesInputRef.current.click();
    }
  };

  const handlePageSelectionConfirm = async (pages: number[]) => {
    if (!pendingPdf) return;
    const { file } = pendingPdf;
    setPendingPdf(null); // Close modal

    setStatus(ProcessStatus.PROCESSING);
    
    // Create a special single-item queue for this manual selection
    const fileItem: FileItem = {
        id: Math.random().toString(36).substr(2, 9),
        file: file,
        status: ProcessStatus.PROCESSING,
        progress: 0,
    };
    
    // We use setQueue to visualize it
    setQueue([fileItem]);

    try {
        let blobs: Blob[] = [];
        
        if (mode === ConversionMode.SPLIT_PDF) {
            blobs = await splitPdf(file, pages, (current, total) => {
                setQueue([{...fileItem, progress: (current/total)*100}]);
            });
        } else {
            // PDF_TO_PNG (now PDF_TO_IMAGE)
            const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
            blobs = await convertPdfToImages(file, (current, total) => {
                setQueue([{...fileItem, progress: (current/total)*100}]);
            }, pages, mimeType, quality);
        }

        const extension = mode === ConversionMode.SPLIT_PDF ? 'pdf' : (outputFormat === 'png' ? 'png' : 'jpg');
        const newGeneratedFiles = blobs.map((blob, idx) => ({
          id: `page-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          name: `${file.name.replace(/\.pdf$/i, '')}_${pages[idx]}.${extension}`,
          url: URL.createObjectURL(blob),
          blob: blob
        }));
        
        setGeneratedFiles(prev => [...prev, ...newGeneratedFiles]);
        if (newGeneratedFiles.length > 0) setPreviewFile(newGeneratedFiles[0]);
        
        setQueue([{...fileItem, status: ProcessStatus.COMPLETED, progress: 100}]);
        setStatus(ProcessStatus.COMPLETED);
    } catch (error) {
        console.error(error);
        setQueue([{...fileItem, status: ProcessStatus.ERROR}]);
        setStatus(ProcessStatus.ERROR);
    }
  };

  const handleMerge = async () => {
    if (generatedFiles.length === 0) return;
    
    setStatus(ProcessStatus.PROCESSING);

    // Create a dummy queue item for the merge process
    const mergeItem: FileItem = {
      id: 'merging',
      file: new File([], 'Merging Files...'),
      status: ProcessStatus.PROCESSING,
      progress: 0
    };
    setQueue([mergeItem]);

    try {
      const blobs = generatedFiles.map(f => f.blob);
      let pdfBlob;
      
      if (mode === ConversionMode.MERGE_PDF) {
        pdfBlob = await mergePdfs(blobs, (current, total) => {
           setQueue([{...mergeItem, progress: (current / total) * 100}]);
        }, quality);
      } else if (mode === ConversionMode.FLATTEN_PDF) {
        pdfBlob = await flattenPdfs(blobs, (current, total) => {
           setQueue([{...mergeItem, progress: (current / total) * 100}]);
        }, quality);
      } else {
        // PNG_TO_PDF
        pdfBlob = await convertImagesToPdf(blobs, (current, total) => {
           setQueue([{...mergeItem, progress: (current / total) * 100}]);
        }, quality);
      }
      
      const url = URL.createObjectURL(pdfBlob);
      let filename = 'merged-document.pdf';
      if (generatedFiles.length > 0) {
        const first = generatedFiles[0].name;
        const base = first.replace(/\.[^/.]+$/, "");
        
        if (mode === ConversionMode.FLATTEN_PDF) {
            filename = `${base}_flattened.pdf`;
        } else if (mode === ConversionMode.MERGE_PDF && quality < 1.0) {
            filename = `${base}_merged_compressed.pdf`;
        } else {
            filename = `${base}_merged.pdf`;
        }
      }

      handleDownload(url, filename);
      
      setQueue([{...mergeItem, status: ProcessStatus.COMPLETED, progress: 100}]);
      setStatus(ProcessStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setQueue([{...mergeItem, status: ProcessStatus.ERROR}]);
      setStatus(ProcessStatus.ERROR);
    }
  };

  const handleDelete = (id: string) => {
    setGeneratedFiles((prev) => {
      const newFiles = [...prev];
      const index = newFiles.findIndex(f => f.id === id);
      if (index === -1) return prev;
      
      const removedFile = newFiles.splice(index, 1)[0];
      if (previewFile?.id === removedFile.id) setPreviewFile(null);
      URL.revokeObjectURL(removedFile.url);
      return newFiles;
    });
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadZip = async () => {
    if (generatedFiles.length === 0) return;
    const zip = new JSZip();
    generatedFiles.forEach(file => zip.file(file.name, file.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    handleDownload(url, `ParsePDF_Output.zip`);
  };

  const handleSaveEdit = (newBlob: Blob) => {
    if (!editingFile) return;
    const newUrl = URL.createObjectURL(newBlob);
    setGeneratedFiles(prev => prev.map(f => {
      if (f.id === editingFile.id) {
        URL.revokeObjectURL(f.url);
        return { ...f, blob: newBlob, url: newUrl };
      }
      return f;
    }));
    // Update preview if we are still viewing the edited file
    if (previewFile?.id === editingFile.id) {
      setPreviewFile({ ...editingFile, blob: newBlob, url: newUrl });
    }
    setEditingFile(null);
  };

  const handleQuickRotate = async () => {
    if (!previewFile) return;
    try {
        const rotatedBlob = await rotateImage(previewFile.blob);
        const newUrl = URL.createObjectURL(rotatedBlob);
        
        setGeneratedFiles(prev => prev.map(f => {
            if (f.id === previewFile.id) {
                URL.revokeObjectURL(f.url);
                return { ...f, blob: rotatedBlob, url: newUrl };
            }
            return f;
        }));
        setPreviewFile({ ...previewFile, blob: rotatedBlob, url: newUrl });
    } catch (e) {
        console.error("Rotation failed", e);
    }
  };

  const openEditor = (mode: ToolMode) => {
    if (!previewFile) return;
    setEditorInitialMode(mode);
    setEditingFile(previewFile);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGeneratedFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const getCardTitle = () => {
    if (editingFile) return t('editor');
    if (previewFile) return t('preview');
    return t('inputSource');
  };

  const getCardIcon = () => {
    if (editingFile) return Pencil;
    if (previewFile) return Eye;
    return FileText;
  };

  const isImage = (file: GeneratedFile) => {
     if (file.blob && file.blob.type.startsWith('image/')) return true;
     return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);
  };
  
  const getDropDesc = () => {
    switch (mode) {
        case ConversionMode.PDF_TO_PNG: return t('dropDescPdf');
        case ConversionMode.PNG_TO_PDF: return t('dropDescImg');
        case ConversionMode.MERGE_PDF: return t('dropDescMerge');
        case ConversionMode.FLATTEN_PDF: return t('dropDescFlatten');
        case ConversionMode.SPLIT_PDF: return t('dropDescSplit');
        default: return t('dropDescPdf');
    }
  };

  const getInputAccept = () => {
     if (mode === ConversionMode.PNG_TO_PDF) return "image/*";
     return "application/pdf";
  };
  
  const getDropzoneAccept = (): Accept => {
     if (mode === ConversionMode.PNG_TO_PDF) {
         return { 
            'image/jpeg': ['.jpg', '.jpeg'], 
            'image/png': ['.png'], 
            'image/webp': ['.webp'] 
         };
     }
     return { 'application/pdf': ['.pdf'] };
  };

  // --- Queue View Dropzone ---
  // This allows dropping files onto the "Results" card to append them
  const onQueueDrop = useCallback((acceptedFiles: File[]) => {
    handleFiles(acceptedFiles);
  }, [handleFiles]);

  const { getRootProps: getQueueRootProps, getInputProps: getQueueInputProps, isDragActive: isQueueDragActive } = useDropzone({
    onDrop: onQueueDrop,
    noClick: true, // Prevent clicking the container from opening file dialog
    noKeyboard: true,
    accept: getDropzoneAccept(),
    multiple: true,
    disabled: mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF // Disable queue dropping for split/extract modes
  });

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-black selection:bg-primary selection:text-black">
      {/* Hidden input for Add More functionality */}
      <input 
        type="file" 
        multiple 
        ref={addFilesInputRef}
        onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFiles(Array.from(e.target.files));
                // Reset input value to allow adding same files again if needed
                e.target.value = '';
            }
        }}
        accept={getInputAccept()}
        className="hidden" 
      />

      {pendingPdf && (
        <PageSelectionModal
          fileName={pendingPdf.file.name}
          fileSize={pendingPdf.file.size}
          totalPageCount={pendingPdf.count}
          onConfirm={handlePageSelectionConfirm}
          onCancel={() => setPendingPdf(null)}
          translations={{
            title: t('modalTitle'),
            desc: t('modalDesc'),
            placeholder: t('modalPlaceholder'),
            convert: t('modalConvert'),
            cancel: t('modalCancel'),
            invalid: t('modalInvalid'),
            selectAll: t('modalSelectAll')
          }}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b-2 border-black sticky top-0 z-40 shadow-neo-sm">
        <div className="max-w-7xl mx-auto px-6 h-18 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary border-2 border-black p-2 shadow-neo-sm rounded-lg">
              <Layout size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-black uppercase">ParsePDF</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Tooltip content={t('ttClientSide')} position="bottom">
              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-[#aaddaa] text-black rounded-lg border-2 border-black shadow-neo-sm font-bold cursor-help">
                 <span className="w-2 h-2 rounded-full bg-black"></span>
                 <span className="text-xs uppercase">{t('clientSide')}</span>
              </div>
            </Tooltip>
            
            <Tooltip content={t('ttLang')} position="bottom">
              <button 
                onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                className="flex items-center gap-2 text-sm font-bold text-black hover:bg-gray-100 transition-colors bg-white px-4 py-2 rounded-lg border-2 border-black shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Globe size={18} />
                {lang === 'ko' ? 'EN' : 'KO'}
              </button>
            </Tooltip>

            <Tooltip content={t('ttGithub')} position="bottom">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition-colors shadow-neo-sm inline-block">
                <Github size={20} />
              </a>
            </Tooltip>
          </div>
        </div>
      </nav>

      <main className="flex-grow w-full max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          <div className="absolute top-0 left-10 w-20 h-20 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>

          <div className="inline-block bg-[#ffcc00] border-2 border-black px-6 py-2 rounded-full text-sm font-black shadow-neo mb-8 rotate-[-2deg] relative z-10">
            {t('heroTag')}
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-black mb-8 leading-none relative z-10">
            {t('heroTitle')}<br/>
            <span className="text-primary">{t('heroTitleHighlight')}</span>
          </h1>
          <p className="text-xl font-medium text-gray-700 max-w-2xl mx-auto leading-relaxed mb-12 border-l-4 border-black pl-6 text-left md:text-center md:border-none md:pl-0 relative z-10">
            {t('heroDesc')}
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <Tooltip content={t('ttPdfToPng')}>
              <Button 
                onClick={() => setMode(ConversionMode.PDF_TO_PNG)}
                variant={mode === ConversionMode.PDF_TO_PNG ? 'primary' : 'secondary'}
                size="lg"
                className={mode === ConversionMode.PDF_TO_PNG ? 'ring-2 ring-primary ring-offset-2' : ''}
              >
                <FileText className="w-6 h-6" /> {t('pdfToPng')}
              </Button>
            </Tooltip>

            <Tooltip content={t('ttPngToPdf')}>
              <Button 
                onClick={() => setMode(ConversionMode.PNG_TO_PDF)}
                variant={mode === ConversionMode.PNG_TO_PDF ? 'primary' : 'secondary'}
                size="lg"
                className={mode === ConversionMode.PNG_TO_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
              >
                <Images className="w-6 h-6" /> {t('pngToPdf')}
              </Button>
            </Tooltip>

            <Tooltip content={t('ttSplitPdf')}>
              <Button 
                onClick={() => setMode(ConversionMode.SPLIT_PDF)}
                variant={mode === ConversionMode.SPLIT_PDF ? 'primary' : 'secondary'}
                size="lg"
                className={mode === ConversionMode.SPLIT_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
              >
                <Scissors className="w-6 h-6" /> {t('splitPdf')}
              </Button>
            </Tooltip>

            <Tooltip content={t('ttMergePdf')}>
              <Button 
                onClick={() => setMode(ConversionMode.MERGE_PDF)}
                variant={mode === ConversionMode.MERGE_PDF ? 'primary' : 'secondary'}
                size="lg"
                className={mode === ConversionMode.MERGE_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
              >
                <Files className="w-6 h-6" /> {t('mergePdf')}
              </Button>
            </Tooltip>

            <Tooltip content={t('ttFlattenPdf')}>
              <Button 
                onClick={() => setMode(ConversionMode.FLATTEN_PDF)}
                variant={mode === ConversionMode.FLATTEN_PDF ? 'primary' : 'secondary'}
                size="lg"
                className={mode === ConversionMode.FLATTEN_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
              >
                <Layers className="w-6 h-6" /> {t('flattenPdf')}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Workspace */}
        <div className={`grid gap-8 transition-all duration-300 ${isPreviewMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
          <div className={`space-y-8 ${isPreviewMode ? 'w-full' : 'lg:col-span-2'}`}>
            <Card title={getCardTitle()} icon={getCardIcon()} className="min-h-[600px]">
              {editingFile ? (
                 <div className="h-full min-h-[500px] -m-6 border-b-0 rounded-b-xl overflow-hidden">
                    <ImageEditor 
                      file={editingFile} 
                      onSave={handleSaveEdit} 
                      onClose={() => setEditingFile(null)} 
                      translations={translations[lang]}
                      initialMode={editorInitialMode}
                    />
                 </div>
              ) : previewFile ? (
                <div className="relative h-full flex flex-col">
                  <div className="absolute -top-14 right-0 z-10">
                    <Tooltip content={t('ttClose')} position="left">
                      <Button onClick={() => setPreviewFile(null)} variant="secondary" size="sm">
                        <X size={16} /> {t('closePreview')}
                      </Button>
                    </Tooltip>
                  </div>
                  <div className={`flex-grow flex items-center justify-center bg-gray-100 rounded-xl border-2 border-black p-8 mt-2 shadow-inner ${isPreviewMode ? 'min-h-[65vh]' : 'min-h-[400px]'}`}>
                    {previewFile.name.toLowerCase().endsWith('.pdf') ? (
                      <iframe src={previewFile.url} className="w-full h-full border-2 border-black rounded-lg" title="PDF Preview"></iframe>
                    ) : (
                      <img src={previewFile.url} alt="Preview" className="max-w-full max-h-[65vh] object-contain shadow-neo-lg rounded-lg border-2 border-black bg-white" />
                    )}
                  </div>
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl border-2 border-black shadow-neo-sm gap-4">
                    <div className="truncate w-full md:w-auto">
                      <p className="font-bold text-lg text-black truncate">{previewFile.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold border border-black">{t('size')}: {(previewFile.blob.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-center">
                      {isImage(previewFile) && (
                        <>
                          <Tooltip content={t('ttCrop')}>
                            <Button onClick={() => openEditor('crop')} size="sm" variant="secondary" title="" className="px-2">
                               <Crop size={16} /> <span className="hidden sm:inline">{t('crop')}</span>
                            </Button>
                          </Tooltip>

                          <Tooltip content={t('ttAdjust')}>
                            <Button onClick={() => openEditor('adjust')} size="sm" variant="secondary" title="" className="px-2">
                               <SlidersHorizontal size={16} /> <span className="hidden sm:inline">{t('adjust')}</span>
                            </Button>
                          </Tooltip>

                          <Tooltip content={t('ttRotate')}>
                            <Button onClick={handleQuickRotate} size="sm" variant="secondary" title="" className="px-2">
                               <RotateCw size={16} /> <span className="hidden sm:inline">{t('rotate')}</span>
                            </Button>
                          </Tooltip>

                          <div className="w-[1px] bg-gray-300 mx-1 h-8"></div>
                          
                          <Tooltip content={t('ttEdit')}>
                            <Button onClick={() => openEditor('draw')} size="sm" variant="secondary">
                              <Pencil size={16} /> {t('edit')}
                            </Button>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip content={t('ttDownload')}>
                        <Button onClick={() => handleDownload(previewFile.url, previewFile.name)} size="sm" variant="primary">
                          <Download size={16} /> {t('download')}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ) : queue.length > 0 ? (
                // QUEUE VIEW
                <div className="flex flex-col h-full min-h-[500px] p-2">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <Cog className={`text-primary ${status === ProcessStatus.PROCESSING ? 'animate-spin' : ''}`} size={24} />
                            <h3 className="text-xl font-black uppercase">{t('processing')}</h3>
                        </div>
                        <Button onClick={handleAddFilesClick} size="sm" variant="secondary" className="h-8 px-3 text-xs">
                           <Plus size={14} /> {t('addMore')}
                        </Button>
                    </div>

                    <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {queue.map((item, idx) => (
                            <div key={item.id} className="bg-white border-2 border-black rounded-lg p-4 shadow-sm flex items-center gap-4">
                                <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-md border-2 border-black">
                                    {item.status === ProcessStatus.COMPLETED ? (
                                        <CheckCircle className="text-green-600" size={24} />
                                    ) : item.status === ProcessStatus.PROCESSING ? (
                                        <Cog className="text-primary animate-spin" size={24} />
                                    ) : item.status === ProcessStatus.ERROR ? (
                                        <AlertCircle className="text-red-500" size={24} />
                                    ) : (
                                        <Clock className="text-gray-400" size={24} />
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-sm truncate">{item.file.name}</span>
                                        <span className={`text-xs font-bold ${item.status === ProcessStatus.COMPLETED ? 'text-green-600' : 'text-gray-500'}`}>
                                            {item.status === ProcessStatus.QUEUED ? 'WAITING' : 
                                             item.status === ProcessStatus.COMPLETED ? 'DONE' : 
                                             item.status === ProcessStatus.ERROR ? 'ERROR' : 
                                             `${Math.round(item.progress)}%`}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full border border-black/10 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-300 ${
                                                item.status === ProcessStatus.ERROR ? 'bg-red-400' :
                                                item.status === ProcessStatus.COMPLETED ? 'bg-green-500' : 'bg-primary'
                                            }`}
                                            style={{ width: `${item.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              ) : (
                <DropZone 
                  mode={mode} 
                  onFilesDropped={handleFiles} 
                  translations={{
                    dropTitle: t('dropTitle'),
                    dropDesc: getDropDesc(),
                    browse: t('browse')
                  }}
                />
              )}
            </Card>
            {!previewFile && !editingFile && <Pipeline status={status} />}
          </div>

          <div className={`${isPreviewMode ? 'w-full' : 'lg:col-span-1'}`}>
            <Card 
              title={t('results')} 
              icon={Download} 
              className={isResultsCollapsed ? 'h-auto' : 'h-full'}
              action={
                <button 
                  onClick={() => setIsResultsCollapsed(prev => !prev)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {isResultsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </button>
              }
            >
              {isResultsCollapsed ? (
                 <div 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-black/5 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setIsResultsCollapsed(false)}
                 >
                    <div className="flex items-center gap-2">
                       <CheckCircle size={16} className="text-green-600"/>
                       <span className="font-bold text-sm text-gray-700">{generatedFiles.length} {t('ready')}</span>
                    </div>
                    <span className="text-xs font-bold text-primary uppercase">{t('expand')}</span>
                 </div>
              ) : (
                  generatedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                      <div className="p-4 bg-white rounded-full mb-4 border-2 border-gray-300">
                        <Download size={32} className="opacity-40" />
                      </div>
                      <p className="text-sm font-bold text-center px-6">{lang === 'ko' ? '여기에 결과 파일이 나타납니다.' : 'Your files will appear here.'}</p>
                    </div>
                  ) : (
                    <div {...getQueueRootProps()} className="flex flex-col h-full relative">
                      {/* Drop Overlay for adding files to queue */}
                      {isQueueDragActive && (
                          <div className="absolute inset-0 z-50 bg-primary/90 rounded-xl flex flex-col items-center justify-center animate-in fade-in duration-200 border-2 border-black m-[-1rem]">
                              <UploadCloud size={48} className="text-white mb-2 animate-bounce" />
                              <p className="text-xl font-black text-white uppercase tracking-wider">{t('dropToAdd')}</p>
                          </div>
                      )}
                      <input {...getQueueInputProps()} />

                      <div className="flex items-center justify-between mb-6 bg-[#d1fae5] p-4 rounded-xl border-2 border-black shadow-neo-sm">
                        <span className="text-sm font-black text-black uppercase">{generatedFiles.length} {t('ready')}</span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleAddFilesClick} 
                                className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all text-xs font-bold"
                            >
                                <Plus size={14} /> {t('addMore')}
                            </button>
                            <div className="w-[1px] h-6 bg-black/10 mx-1"></div>
                            <CheckCircle size={20} className="text-black" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 mb-6">
                        {/* Format Selection for PDF_TO_PNG */}
                        {mode === ConversionMode.PDF_TO_PNG && (
                          <div className="mb-2 p-4 bg-gray-50 rounded-lg border-2 border-black/5 animate-in fade-in slide-in-from-top-2 duration-300">
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold uppercase text-gray-500">{t('format')}</label>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setOutputFormat('png')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg border-2 text-xs font-bold transition-all ${outputFormat === 'png' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black'}`}
                                >
                                    PNG
                                </button>
                                <button 
                                    onClick={() => setOutputFormat('jpg')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg border-2 text-xs font-bold transition-all ${outputFormat === 'jpg' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black'}`}
                                >
                                    JPG
                                </button>
                             </div>
                          </div>
                        )}

                        {/* Compression Slider */}
                        {(mode === ConversionMode.MERGE_PDF || mode === ConversionMode.FLATTEN_PDF || mode === ConversionMode.PNG_TO_PDF || (mode === ConversionMode.PDF_TO_PNG && outputFormat === 'jpg')) && (
                          <div className="mb-2 p-4 bg-gray-50 rounded-lg border-2 border-black/5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between mb-2 items-center">
                              <label className="text-xs font-bold uppercase text-gray-500">{t('quality')}</label>
                              <span className="text-xs font-black text-black bg-white px-2 py-0.5 rounded border border-black/10 shadow-sm">{Math.round(quality * 100)}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0.1" 
                              max="1.0" 
                              step="0.1" 
                              value={quality} 
                              onChange={(e) => setQuality(parseFloat(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">{t('qualityDesc')}</p>
                          </div>
                        )}

                        {/* Merge / Action Buttons */}
                        {(mode === ConversionMode.MERGE_PDF || mode === ConversionMode.PNG_TO_PDF || mode === ConversionMode.FLATTEN_PDF) ? (
                          <Tooltip content={t('ttMergeAction')} position="bottom">
                            <Button onClick={handleMerge} className="w-full justify-between group" variant="primary" size="sm">
                              <span className="flex items-center gap-2">
                                  {mode === ConversionMode.FLATTEN_PDF ? <Layers size={16} /> : <FileStack size={16} />}
                                  {mode === ConversionMode.FLATTEN_PDF ? t('flattenMerge') : t('mergeBack')}
                              </span>
                              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </Button>
                          </Tooltip>
                        ) : (
                          // For PDF_TO_PNG and SPLIT_PDF, we just offer ZIP download as we process immediately
                          <Tooltip content={t('ttDownloadZip')} position="bottom">
                            <Button onClick={handleDownloadZip} className="w-full justify-between group bg-black text-white hover:bg-gray-800" size="sm">
                              <span className="flex items-center gap-2"><FileArchive size={16} /> {t('downloadZip')}</span>
                              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>

                      {/* Sortable DND Context */}
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="overflow-y-auto max-h-[600px] pr-2 custom-scrollbar flex-grow">
                          <SortableContext 
                            items={generatedFiles.map(f => f.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className={`grid gap-3 pb-4 ${isPreviewMode ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2'}`}>
                              {generatedFiles.map((file) => (
                                <SortableFileCard 
                                  key={file.id} 
                                  id={file.id}
                                  file={file}
                                  isActive={previewFile?.id === file.id}
                                  onPreview={() => { setPreviewFile(file); setEditingFile(null); }}
                                  onDelete={() => handleDelete(file.id)}
                                  onDownload={() => handleDownload(file.url, file.name)}
                                  translations={{
                                    delete: t('ttDelete'),
                                    download: t('ttDownload')
                                  }}
                                />
                              ))}
                              
                              {/* Inline Add Button inside grid */}
                              <div 
                                onClick={handleAddFilesClick}
                                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-primary hover:border-primary hover:bg-blue-50 cursor-pointer transition-all"
                              >
                                <Plus size={24} />
                                <span className="text-[10px] font-bold uppercase mt-1">{t('addMore')}</span>
                              </div>

                            </div>
                          </SortableContext>
                        </div>

                        <DragOverlay>
                            {activeId ? (
                                <FileCardOverlay 
                                  id={activeId}
                                  file={generatedFiles.find(f => f.id === activeId)!} 
                                />
                            ) : null}
                        </DragOverlay>
                      </DndContext>

                    </div>
                  )
              )}
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t-2 border-black bg-white py-12 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-black text-xl text-black mb-2 uppercase tracking-tight">{t('footerTitle')}</p>
          <p className="text-gray-600 font-medium text-sm">{t('footerDesc')}</p>
        </div>
      </footer>
    </div>
  );
}
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Images, FileText, CheckCircle, ArrowRight, Download, Github, FileArchive, X, Eye, Pencil, FileStack, Globe, Cog, Crop, RotateCw, SlidersHorizontal, Files, Layers, Plus, UploadCloud } from 'lucide-react';
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
import { convertPdfToPng, convertImagesToPdf, getPdfPageCount, rotateImage, mergePdfs, flattenPdfs } from './services/pdfService';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { DropZone } from './components/DropZone';
import { Pipeline } from './components/Pipeline';
import { ImageEditor, ToolMode } from './components/ImageEditor';
import { PageSelectionModal } from './components/PageSelectionModal';
import { SortableFileCard, FileCardOverlay } from './components/SortableFileCard';
import JSZip from 'jszip';

type Language = 'ko' | 'en';

const translations = {
  en: {
    heroTag: "NO CLOUD • PRIVACY FIRST",
    heroTitle: "OWN YOUR ",
    heroTitleHighlight: "DOCUMENTS",
    heroDesc: "Convert PDFs to PNGs or merge images into PDFs directly in your browser. Brutally simple, fast, and secure.",
    pdfToPng: "PDF to PNG",
    pngToPdf: "PNG to PDF",
    mergePdf: "Merge PDF",
    flattenPdf: "Flatten PDF",
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
    dropDescPdf: "Upload a PDF to extract pages.",
    dropDescImg: "Upload images to merge. Drag to reorder.",
    dropDescMerge: "Upload multiple PDFs to merge. Drag to reorder.",
    dropDescFlatten: "Upload PDFs to flatten into images then merge.",
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
    // Modal
    modalTitle: "Select Pages",
    modalDesc: "Enter page numbers or ranges to extract (e.g. 1-3, 5, 8).",
    modalPlaceholder: "e.g. 1-5, 8",
    modalConvert: "CONVERT",
    modalCancel: "CANCEL",
    modalInvalid: "Invalid format. Check page numbers.",
    modalSelectAll: "Select All Pages"
  },
  ko: {
    heroTag: "클라우드 X • 개인정보 보호",
    heroTitle: "문서 관리의 ",
    heroTitleHighlight: "새로운 기준",
    heroDesc: "브라우저에서 직접 PDF를 이미지로 변환하거나 이미지를 PDF로 합치세요. 빠르고, 안전하고, 단순합니다.",
    pdfToPng: "PDF → PNG",
    pngToPdf: "PNG → PDF",
    mergePdf: "PDF 합치기",
    flattenPdf: "PDF 이미지 병합",
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
    dropDescPdf: "PDF를 업로드하여 이미지를 추출하세요.",
    dropDescImg: "이미지를 업로드하세요. 드래그하여 순서를 변경할 수 있습니다.",
    dropDescMerge: "합칠 PDF 파일들을 업로드하세요. 순서를 변경할 수 있습니다.",
    dropDescFlatten: "이미지로 변환하여 합칠 PDF들을 업로드하세요.",
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
    // Modal
    modalTitle: "페이지 선택",
    modalDesc: "변환할 페이지 번호나 범위를 입력하세요 (예: 1-3, 5, 8).",
    modalPlaceholder: "예: 1-5, 8",
    modalConvert: "변환 시작",
    modalCancel: "취소",
    modalInvalid: "형식이 올바르지 않거나 페이지 범위를 벗어났습니다.",
    modalSelectAll: "전체 페이지 선택"
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
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [editingFile, setEditingFile] = useState<GeneratedFile | null>(null);
  const [editorInitialMode, setEditorInitialMode] = useState<ToolMode>('draw');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hidden input ref for "Add More" functionality
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // New state for page selection
  const [pendingPdf, setPendingPdf] = useState<{ file: File, count: number } | null>(null);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

  // Helper to determine layout state
  const isPreviewMode = !!previewFile || !!editingFile;

  // Dnd Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
        coordinateGetter: (event, args) => {
            return { x: 0, y: 0 };
        }
    })
  );

  useEffect(() => {
    setStatus(ProcessStatus.IDLE);
    setCurrentFile(null);
    setGeneratedFiles([]);
    setPreviewFile(null);
    setEditingFile(null);
    setPendingPdf(null);
  }, [mode]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    // For PDF splitting, we only allow one file at a time (replace workflow)
    if (mode === ConversionMode.PDF_TO_PNG) {
        setStatus(ProcessStatus.IDLE);
        setGeneratedFiles([]);
        setPreviewFile(null);
        setPendingPdf(null);

        try {
            const pdfFile = files[0];
            const count = await getPdfPageCount(pdfFile);
            setPendingPdf({ file: pdfFile, count });
        } catch (error) {
            console.error(error);
            setStatus(ProcessStatus.ERROR);
        }
    } else {
        // Queue Mode (Append to list)
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
  }, [mode, status, previewFile]);

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
                        } else if (mode === ConversionMode.PDF_TO_PNG && isPdf) {
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
    
    const fileItem: FileItem = {
        id: Math.random().toString(36).substr(2, 9),
        file: file,
        status: ProcessStatus.PROCESSING,
        progress: 0,
    };
    setCurrentFile(fileItem);

    try {
        const blobs = await convertPdfToPng(file, (current, total) => {
          setCurrentFile(prev => prev ? { ...prev, progress: (current / total) * 100 } : null);
        }, pages);

        const newGeneratedFiles = blobs.map((blob, idx) => ({
          id: `page-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          name: `${file.name.replace(/\.pdf$/i, '')}_${pages[idx]}.png`,
          url: URL.createObjectURL(blob),
          blob: blob
        }));
        
        setGeneratedFiles(newGeneratedFiles);
        if (newGeneratedFiles.length > 0) setPreviewFile(newGeneratedFiles[0]);
        setStatus(ProcessStatus.COMPLETED);
    } catch (error) {
        console.error(error);
        setStatus(ProcessStatus.ERROR);
    }
  };

  const handleMerge = async () => {
    if (generatedFiles.length === 0) return;
    
    setStatus(ProcessStatus.PROCESSING);

    setCurrentFile({
      id: 'merging',
      file: new File([], 'merging.pdf'),
      status: ProcessStatus.PROCESSING,
      progress: 0
    });

    try {
      const blobs = generatedFiles.map(f => f.blob);
      let pdfBlob;
      
      if (mode === ConversionMode.MERGE_PDF) {
        pdfBlob = await mergePdfs(blobs, (current, total) => {
           setCurrentFile(prev => prev ? { ...prev, progress: (current / total) * 100 } : null);
        });
      } else if (mode === ConversionMode.FLATTEN_PDF) {
        pdfBlob = await flattenPdfs(blobs, (current, total) => {
           setCurrentFile(prev => prev ? { ...prev, progress: (current / total) * 100 } : null);
        });
      } else {
        // PNG_TO_PDF
        pdfBlob = await convertImagesToPdf(blobs, (current, total) => {
           setCurrentFile(prev => prev ? { ...prev, progress: (current / total) * 100 } : null);
        });
      }
      
      const url = URL.createObjectURL(pdfBlob);
      let filename = 'merged-document.pdf';
      if (generatedFiles.length > 0) {
        const first = generatedFiles[0].name;
        const base = first.replace(/\.[^/.]+$/, "");
        
        if (mode === ConversionMode.FLATTEN_PDF) {
            filename = `${base}_flattened.pdf`;
        } else {
            filename = `${base}_merged.pdf`;
        }
      }

      handleDownload(url, filename);
      setStatus(ProcessStatus.COMPLETED);
    } catch (error) {
      console.error(error);
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
    const name = file.name.toLowerCase();
    return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
  };
  
  const getDropDesc = () => {
    switch (mode) {
        case ConversionMode.PDF_TO_PNG: return t('dropDescPdf');
        case ConversionMode.PNG_TO_PDF: return t('dropDescImg');
        case ConversionMode.MERGE_PDF: return t('dropDescMerge');
        case ConversionMode.FLATTEN_PDF: return t('dropDescFlatten');
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
    disabled: mode === ConversionMode.PDF_TO_PNG // Disable queue dropping for split mode which is single file replacement
  });

  return (
    <div className="min-h-screen bg-background font-sans text-black selection:bg-primary selection:text-black">
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
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-[#aaddaa] text-black rounded-lg border-2 border-black shadow-neo-sm font-bold">
               <span className="w-2 h-2 rounded-full bg-black"></span>
               <span className="text-xs uppercase">{t('clientSide')}</span>
            </div>
            
            <button 
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              className="flex items-center gap-2 text-sm font-bold text-black hover:bg-gray-100 transition-colors bg-white px-4 py-2 rounded-lg border-2 border-black shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Globe size={18} />
              {lang === 'ko' ? 'EN' : 'KO'}
            </button>

            <a href="https://github.com" target="_blank" rel="noreferrer" className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition-colors shadow-neo-sm">
              <Github size={20} />
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
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
            <Button 
              onClick={() => setMode(ConversionMode.PDF_TO_PNG)}
              variant={mode === ConversionMode.PDF_TO_PNG ? 'primary' : 'secondary'}
              size="lg"
              className={mode === ConversionMode.PDF_TO_PNG ? 'ring-2 ring-primary ring-offset-2' : ''}
            >
              <FileText className="w-6 h-6" /> {t('pdfToPng')}
            </Button>
            <Button 
              onClick={() => setMode(ConversionMode.PNG_TO_PDF)}
              variant={mode === ConversionMode.PNG_TO_PDF ? 'primary' : 'secondary'}
              size="lg"
              className={mode === ConversionMode.PNG_TO_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
            >
              <Images className="w-6 h-6" /> {t('pngToPdf')}
            </Button>
             <Button 
              onClick={() => setMode(ConversionMode.MERGE_PDF)}
              variant={mode === ConversionMode.MERGE_PDF ? 'primary' : 'secondary'}
              size="lg"
              className={mode === ConversionMode.MERGE_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
            >
              <Files className="w-6 h-6" /> {t('mergePdf')}
            </Button>
             <Button 
              onClick={() => setMode(ConversionMode.FLATTEN_PDF)}
              variant={mode === ConversionMode.FLATTEN_PDF ? 'primary' : 'secondary'}
              size="lg"
              className={mode === ConversionMode.FLATTEN_PDF ? 'ring-2 ring-primary ring-offset-2' : ''}
            >
              <Layers className="w-6 h-6" /> {t('flattenPdf')}
            </Button>
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
                    <Button onClick={() => setPreviewFile(null)} variant="secondary" size="sm">
                      <X size={16} /> {t('closePreview')}
                    </Button>
                  </div>
                  <div className="flex-grow flex items-center justify-center bg-gray-100 rounded-xl border-2 border-black p-8 mt-2 min-h-[400px] shadow-inner">
                    {previewFile.name.endsWith('.pdf') ? (
                      <iframe src={previewFile.url} className="w-full h-full border-2 border-black rounded-lg" title="PDF Preview"></iframe>
                    ) : (
                      <img src={previewFile.url} alt="Preview" className="max-w-full max-h-[500px] object-contain shadow-neo-lg rounded-lg border-2 border-black bg-white" />
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
                          <Button onClick={() => openEditor('crop')} size="sm" variant="secondary" title={t('crop')} className="px-2">
                             <Crop size={16} /> <span className="hidden sm:inline">{t('crop')}</span>
                          </Button>
                          <Button onClick={() => openEditor('adjust')} size="sm" variant="secondary" title={t('adjust')} className="px-2">
                             <SlidersHorizontal size={16} /> <span className="hidden sm:inline">{t('adjust')}</span>
                          </Button>
                          <Button onClick={handleQuickRotate} size="sm" variant="secondary" title={t('rotate')} className="px-2">
                             <RotateCw size={16} /> <span className="hidden sm:inline">{t('rotate')}</span>
                          </Button>
                          <div className="w-[1px] bg-gray-300 mx-1 h-8"></div>
                          <Button onClick={() => openEditor('draw')} size="sm" variant="secondary">
                            <Pencil size={16} /> {t('edit')}
                          </Button>
                        </>
                      )}
                      <Button onClick={() => handleDownload(previewFile.url, previewFile.name)} size="sm" variant="primary">
                        <Download size={16} /> {t('download')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : status === ProcessStatus.PROCESSING ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
                  <div className="relative mb-8 p-4">
                     <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                     <Cog size={80} className="text-black animate-spin duration-3000 relative z-10" /> 
                  </div>
                  
                  <h3 className="text-2xl font-black text-black mb-2 uppercase tracking-tight">{t('processing')}</h3>
                  <p className="text-gray-600 font-medium mb-10 max-w-xs mx-auto leading-relaxed">{t('processingDesc')}</p>
                  
                  {currentFile && (
                    <div className="w-full max-w-sm space-y-2">
                      <div className="flex justify-between items-end px-1">
                        <span className="text-xs font-bold uppercase tracking-wider">Progress</span>
                        <span className="text-xl font-black font-mono">{Math.round(currentFile.progress)}%</span>
                      </div>
                      <div className="h-8 bg-white border-2 border-black rounded-lg overflow-hidden p-1 shadow-neo-sm">
                        <div 
                          className="h-full bg-primary rounded-md border-2 border-black transition-all duration-300 relative overflow-hidden" 
                          style={{ width: `${Math.max(2, currentFile.progress)}%` }}
                        >
                           <div className="absolute top-0 left-0 w-full h-full bg-white/20"></div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-2">{currentFile.file.name}</p>
                    </div>
                  )}
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
            <Card title={t('results')} icon={Download} className="h-full">
              {generatedFiles.length === 0 ? (
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
                    <div className="flex gap-2">
                        <button onClick={handleAddFilesClick} className="p-1 hover:bg-black/10 rounded-full transition-colors" title={t('addMore')}>
                            <Plus size={20} className="text-black" />
                        </button>
                        <CheckCircle size={20} className="text-black" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    {/* Merge / Action Buttons */}
                    {(mode === ConversionMode.MERGE_PDF || mode === ConversionMode.PNG_TO_PDF || mode === ConversionMode.FLATTEN_PDF) ? (
                      <Button onClick={handleMerge} className="w-full justify-between group" variant="primary" size="sm">
                        <span className="flex items-center gap-2">
                            {mode === ConversionMode.FLATTEN_PDF ? <Layers size={16} /> : <FileStack size={16} />}
                            {mode === ConversionMode.FLATTEN_PDF ? t('flattenMerge') : t('mergeBack')}
                        </span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                    ) : (
                       // For PDF_TO_PNG, we just offer ZIP download as we process immediately
                       <Button onClick={handleDownloadZip} className="w-full justify-between group bg-black text-white hover:bg-gray-800" size="sm">
                        <span className="flex items-center gap-2"><FileArchive size={16} /> {t('downloadZip')}</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
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
              )}
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t-2 border-black bg-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-black text-xl text-black mb-2 uppercase tracking-tight">{t('footerTitle')}</p>
          <p className="text-gray-600 font-medium text-sm">{t('footerDesc')}</p>
        </div>
      </footer>
    </div>
  );
}
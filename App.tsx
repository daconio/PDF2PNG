import React, { useState, useEffect } from 'react';
import { Layout, Images, FileText, CheckCircle, ArrowRight, Download, Github, FileArchive, X, Eye, Pencil, FileStack, Globe, Cog } from 'lucide-react';
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
import { convertPdfToPng, convertImagesToPdf, getPdfPageCount } from './services/pdfService';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { DropZone } from './components/DropZone';
import { Pipeline } from './components/Pipeline';
import { ImageEditor } from './components/ImageEditor';
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
    workspace: "WORKSPACE",
    results: "RESULTS",
    preview: "PREVIEW",
    inputSource: "INPUT SOURCE",
    processing: "PROCESSING...",
    processingDesc: "Crunching data on your device.",
    ready: "FILES READY",
    mergeBack: "MERGE TO PDF",
    downloadZip: "DOWNLOAD ZIP",
    closePreview: "CLOSE",
    size: "Size",
    clientSide: "CLIENT-SIDE",
    footerTitle: "ParsePDF",
    footerDesc: "Handcrafted with <3 and lots of caffeine.",
    dropTitle: "DROP FILES HERE",
    dropDescPdf: "Upload a PDF to extract pages.",
    dropDescImg: "Upload images to merge. Drag to reorder.",
    browse: "BROWSE FILES",
    delete: "DEL",
    edit: "EDIT",
    download: "DL",
    editor: "EDITOR",
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
    workspace: "작업 공간",
    results: "결과물",
    preview: "미리보기",
    inputSource: "입력 파일",
    processing: "처리 중...",
    processingDesc: "기기에서 직접 처리하고 있습니다.",
    ready: "완료됨",
    mergeBack: "PDF로 합치기",
    downloadZip: "ZIP 다운로드",
    closePreview: "닫기",
    size: "크기",
    clientSide: "클라이언트 전용",
    footerTitle: "ParsePDF",
    footerDesc: "개인정보 보호를 위해 정성껏 만들었습니다.",
    dropTitle: "파일을 여기에 놓으세요",
    dropDescPdf: "PDF를 업로드하여 이미지를 추출하세요.",
    dropDescImg: "이미지를 업로드하세요. 드래그하여 순서를 변경할 수 있습니다.",
    browse: "파일 찾기",
    delete: "삭제",
    edit: "편집",
    download: "다운",
    editor: "이미지 편집",
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
  const [activeId, setActiveId] = useState<string | null>(null);

  // New state for page selection
  const [pendingPdf, setPendingPdf] = useState<{ file: File, count: number } | null>(null);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

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

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    // Reset previous state
    setStatus(ProcessStatus.IDLE);
    setGeneratedFiles([]);
    setPreviewFile(null);
    setPendingPdf(null);

    try {
      if (mode === ConversionMode.PDF_TO_PNG) {
        const pdfFile = files[0];
        // 1. Get Page Count first
        const count = await getPdfPageCount(pdfFile);
        
        // 2. Open Modal
        setPendingPdf({ file: pdfFile, count });
        
      } else {
        // PNG_TO_PDF: Load images but DO NOT merge yet. Allow sorting.
        setStatus(ProcessStatus.PROCESSING);
        const fileItem: FileItem = {
            id: Math.random().toString(36).substr(2, 9),
            file: files[0], // Representative file
            status: ProcessStatus.PROCESSING,
            progress: 0,
        };
        setCurrentFile(fileItem);
        
        const newFiles = files.map((f, idx) => ({
          id: `img-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          name: f.name,
          url: URL.createObjectURL(f),
          blob: f
        }));
        
        // Simulate a small delay for "processing" UX
        setCurrentFile(prev => prev ? { ...prev, progress: 100 } : null);
        await new Promise(r => setTimeout(r, 500));
        
        setGeneratedFiles(newFiles);
        if (newFiles.length > 0) setPreviewFile(newFiles[0]);
        setStatus(ProcessStatus.COMPLETED);
      }
    } catch (error) {
      console.error(error);
      setStatus(ProcessStatus.ERROR);
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
          // Fix: Use case-insensitive regex for extension replacement
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
    
    const previousStatus = status;
    setStatus(ProcessStatus.PROCESSING);

    setCurrentFile({
      id: 'merging',
      file: new File([], 'merging.pdf'),
      status: ProcessStatus.PROCESSING,
      progress: 0
    });

    try {
      const blobs = generatedFiles.map(f => f.blob);
      const pdfBlob = await convertImagesToPdf(blobs, (current, total) => {
         setCurrentFile(prev => prev ? { ...prev, progress: (current / total) * 100 } : null);
      });
      
      const url = URL.createObjectURL(pdfBlob);
      let filename = 'merged-document.pdf';
      if (generatedFiles.length > 0) {
        // Try to base name on first file
        const first = generatedFiles[0].name;
        // Simple extension removal
        const base = first.replace(/\.[^/.]+$/, "");
        filename = `${base}_merged.pdf`;
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

  // Drag and Drop Handlers
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

  // Determine card title/icon
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

  return (
    <div className="min-h-screen bg-background font-sans text-black selection:bg-primary selection:text-black">
      {pendingPdf && (
        <PageSelectionModal
          fileName={pendingPdf.file.name}
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
          {/* Decorative Elements */}
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
          
          <div className="flex flex-col md:flex-row justify-center gap-6 relative z-10">
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
          </div>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card title={getCardTitle()} icon={getCardIcon()} className="min-h-[600px]">
              {editingFile ? (
                 <div className="h-full min-h-[500px] -m-6 border-b-0 rounded-b-xl overflow-hidden">
                    <ImageEditor 
                      file={editingFile} 
                      onSave={handleSaveEdit} 
                      onClose={() => setEditingFile(null)} 
                      translations={translations[lang]}
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
                  <div className="mt-6 flex items-center justify-between bg-white p-4 rounded-xl border-2 border-black shadow-neo-sm">
                    <div className="truncate pr-4">
                      <p className="font-bold text-lg text-black">{previewFile.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold border border-black">{t('size')}: {(previewFile.blob.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      {(previewFile.name.toLowerCase().endsWith('.png') || previewFile.name.toLowerCase().endsWith('.jpg') || previewFile.name.toLowerCase().endsWith('.jpeg')) && (
                        <Button onClick={() => setEditingFile(previewFile)} size="sm" variant="secondary">
                          <Pencil size={16} /> {t('edit')}
                        </Button>
                      )}
                      <Button onClick={() => handleDownload(previewFile.url, previewFile.name)} size="sm" variant="primary">
                        <Download size={16} /> {t('download')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : status === ProcessStatus.PROCESSING ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
                  {/* Spinning Gear */}
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
                           {/* Simple shine effect */}
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
                    dropDesc: mode === ConversionMode.PDF_TO_PNG ? t('dropDescPdf') : t('dropDescImg'),
                    browse: t('browse')
                  }}
                />
              )}
            </Card>
            {!previewFile && !editingFile && <Pipeline status={status} />}
          </div>

          <div className="lg:col-span-1">
            <Card title={t('results')} icon={Download} className="h-full">
              {generatedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                  <div className="p-4 bg-white rounded-full mb-4 border-2 border-gray-300">
                    <Download size={32} className="opacity-40" />
                  </div>
                  <p className="text-sm font-bold text-center px-6">{lang === 'ko' ? '여기에 결과 파일이 나타납니다.' : 'Your files will appear here.'}</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6 bg-[#d1fae5] p-4 rounded-xl border-2 border-black shadow-neo-sm">
                    <span className="text-sm font-black text-black uppercase">{generatedFiles.length} {t('ready')}</span>
                    <CheckCircle size={20} className="text-black" />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    {(mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.PNG_TO_PDF) && (
                      <Button onClick={handleMerge} className="w-full justify-between group" variant="secondary" size="sm">
                        <span className="flex items-center gap-2"><FileStack size={16} /> {t('mergeBack')}</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                    )}
                    <Button onClick={handleDownloadZip} className="w-full justify-between group bg-black text-white hover:bg-gray-800" size="sm">
                      <span className="flex items-center gap-2"><FileArchive size={16} /> {t('downloadZip')}</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Button>
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
                        <div className="grid grid-cols-2 gap-3 pb-4">
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
import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, Images, FileText, CheckCircle, ArrowRight, Download, Github, 
  X, Eye, Pencil, FileStack, Globe, Cog, Crop, RotateCw, 
  SlidersHorizontal, Files, Layers, Plus, UploadCloud, Scissors, 
  AlertCircle, FileType, Presentation, BrainCircuit, Trash2, Menu
} from 'lucide-react';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragOverlay 
} from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, rectSortingStrategy 
} from '@dnd-kit/sortable';

import { ConversionMode, ProcessStatus, FileItem, PptxSlide } from './types';
import { 
  convertPdfToImages, convertImagesToPdf, getPdfPageCount, 
  rotateImage, mergePdfs, flattenPdfs, splitPdf, 
  analyzePdfToPptxData, generatePptxFromData 
} from './services/pdfService';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { DropZone } from './components/DropZone';
import { Pipeline } from './components/Pipeline';
import { PageSelectionModal } from './components/PageSelectionModal';
import { SortableFileCard, FileCardOverlay } from './components/SortableFileCard';
import { Tooltip } from './components/Tooltip';
import { Toast, ToastType } from './components/Toast';
import { PptxEditor } from './components/PptxEditor';
import JSZip from 'jszip';

type Language = 'ko' | 'en';
const translations = {
  en: {
    heroTitle: "OWN YOUR DOCUMENTS",
    heroDesc: "Convert PDFs locally in your browser. Privacy first, always.",
    pdfToPng: "PDF to Image",
    pngToPdf: "Image to PDF",
    mergePdf: "Merge PDF",
    flattenPdf: "Flatten PDF",
    splitPdf: "Split PDF",
    pdfToPptx: "PDF to PPTX",
    processing: "Processing...",
    analyzing: "AI Analysis...",
    reading: "Reading PDF...",
    ready: "Files in queue",
    pptxEditable: "AI Intelligent Reconstruction",
    pptxEditableDesc: "Use Gemini AI to recreate slides with editable text blocks.",
    downloadZip: "DOWNLOAD ZIP",
    addMore: "ADD FILES",
    dropTitle: "DROP FILES HERE",
    dropDesc: "All files stay on your device.",
    browse: "BROWSE FILES",
    modalTitle: "Select Pages",
    modalDesc: "Enter page ranges (e.g., 1-5).",
    modalConvert: "CONVERT",
    modalCancel: "CANCEL",
    modalInvalid: "Invalid page range.",
    modalSelectAll: "Select All",
    modalPlaceholder: "e.g. 1-10",
    ttLang: "Switch Language",
    ttGithub: "Source Code"
  },
  ko: {
    heroTitle: "문서 관리의 새로운 기준",
    heroDesc: "브라우저에서 직접 PDF를 변환하세요. 개인정보는 완벽하게 보호됩니다.",
    pdfToPng: "PDF → 이미지",
    pngToPdf: "이미지 → PDF",
    mergePdf: "PDF 합치기",
    flattenPdf: "PDF 이미지 병합",
    splitPdf: "PDF 분할",
    pdfToPptx: "PDF → PPTX",
    processing: "처리 중...",
    analyzing: "AI 분석 중...",
    reading: "PDF 읽는 중...",
    ready: "개의 파일 대기 중",
    pptxEditable: "AI 지능형 구조 재구성",
    pptxEditableDesc: "Gemini AI를 사용하여 편집 가능한 텍스트 블록으로 재구성합니다.",
    downloadZip: "ZIP 다운로드",
    addMore: "파일 추가",
    dropTitle: "파일을 여기에 놓으세요",
    dropDesc: "모든 파일은 기기 내에서만 처리됩니다.",
    browse: "파일 찾기",
    modalTitle: "페이지 선택",
    modalDesc: "변환할 페이지 범위를 입력하세요 (예: 1-5).",
    modalConvert: "변환 시작",
    modalCancel: "취소",
    modalInvalid: "페이지 범위를 확인해주세요.",
    modalSelectAll: "전체 선택",
    modalPlaceholder: "예: 1-10",
    ttLang: "언어 변경",
    ttGithub: "소스 코드"
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
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [pptxEditable, setPptxEditable] = useState(true);
  const [detailedStatus, setDetailedStatus] = useState<string>('');
  const [pendingPdf, setPendingPdf] = useState<{ file: File, count: number } | null>(null);
  const [toasts, setToasts] = useState<{id:string, message:string, type:ToastType}[]>([]);
  
  // New state for PPTX Editor
  const [pptxSlides, setPptxSlides] = useState<PptxSlide[]>([]);
  const [pptxTotalPages, setPptxTotalPages] = useState<number>(0);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  useEffect(() => {
    setStatus(ProcessStatus.IDLE);
    setQueue([]);
    setGeneratedFiles([]);
    setDetailedStatus('');
    setPptxSlides([]);
    setPptxTotalPages(0);
    setPendingPdf(null);
  }, [mode]);

  const onFilesDropped = async (files: File[]) => {
    if (files.length === 0) return;

    if (mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF || mode === ConversionMode.PDF_TO_PPTX) {
        try {
            setDetailedStatus(t('reading'));
            const count = await getPdfPageCount(files[0]);
            setPendingPdf({ file: files[0], count });
            setDetailedStatus('');
        } catch (e: any) {
            console.error(e);
            setToasts(prev => [...prev, { 
                id: Date.now().toString(), 
                message: `Failed to read PDF: ${e.message}. Is it encrypted?`, 
                type: 'error' 
            }]);
            setDetailedStatus('');
        }
    } else {
        const newItems = files.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            file: f,
            status: ProcessStatus.QUEUED,
            progress: 0
        }));
        setQueue(prev => [...prev, ...newItems]);
    }
  };

  const startConversion = async (pages?: number[]) => {
    if (!pendingPdf) return;
    const item = {
        id: Math.random().toString(36).substr(2, 9),
        file: pendingPdf.file,
        status: ProcessStatus.PROCESSING,
        progress: 0
    };
    setQueue([item]);
    setPendingPdf(null);
    setStatus(ProcessStatus.PROCESSING);

    try {
        let blobs: Blob[] = [];
        const progressCb = (c: number, tCount: number, sText?: string) => {
            if (sText) setDetailedStatus(sText);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: (c/tCount)*100 } : q));
        };

        if (mode === ConversionMode.PDF_TO_PPTX) {
            // Phase 1: Analyze and get data (Streaming)
            setStatus(ProcessStatus.ANALYZING_PPTX);
            setPptxSlides([]); // Reset
            setPptxTotalPages(pendingPdf.count); // Set expected total for progress bar

            // This promise will resolve when ALL pages are done, 
            // but onSlideAvailable will fire for each page.
            await analyzePdfToPptxData(
                item.file, 
                progressCb, 
                pptxEditable,
                (newSlide) => {
                    setPptxSlides(prev => {
                        const newState = [...prev, newSlide];
                        // As soon as we have at least one slide, switch to Editor mode
                        // Note: Using functional state update ensures we don't lose updates
                        if (newState.length === 1) {
                            setStatus(ProcessStatus.EDITING_PPTX);
                        }
                        return newState;
                    });
                }
            );
            
            // Just in case status didn't switch (e.g. 0 pages?), force it here if we have slides
            // or handle empty result
            if (pptxSlides.length > 0) {
                 setStatus(ProcessStatus.EDITING_PPTX);
            }
            return; // Stop here, wait for user interaction in Editor
        } else if (mode === ConversionMode.PDF_TO_PNG) {
            blobs = await convertPdfToImages(item.file, progressCb, pages);
        } else if (mode === ConversionMode.SPLIT_PDF) {
            blobs = await splitPdf(item.file, pages || [], progressCb);
        }

        const res = blobs.map((b, i) => ({
            id: `res-${i}`,
            name: `${item.file.name.split('.')[0]}_${i+1}.${mode === 'PDF_TO_PNG' ? 'png' : 'pdf'}`,
            url: URL.createObjectURL(b),
            blob: b
        }));
        setGeneratedFiles(res);
        setStatus(ProcessStatus.COMPLETED);
    } catch (e: any) {
        setStatus(ProcessStatus.ERROR);
        setDetailedStatus(`Error: ${e.message}`);
        setToasts(prev => [...prev, { id: Date.now().toString(), message: e.message, type: 'error' }]);
    }
  };

  const handlePptxDownload = async (updatedSlides: PptxSlide[]) => {
      setStatus(ProcessStatus.PROCESSING);
      setDetailedStatus("Generating PPTX...");
      try {
          const blob = await generatePptxFromData(updatedSlides, (c, t) => setDetailedStatus(`Generating... ${c}/${t}`));
          const res = [{
              id: 'pptx-result',
              name: 'converted.pptx',
              url: URL.createObjectURL(blob),
              blob: blob
          }];
          setGeneratedFiles(res);
          setPptxSlides([]); // Clear slides to close editor
          setStatus(ProcessStatus.COMPLETED);
      } catch (e: any) {
          setStatus(ProcessStatus.ERROR);
          setDetailedStatus(`Error generating PPTX: ${e.message}`);
          setToasts(prev => [...prev, { id: Date.now().toString(), message: e.message, type: 'error' }]);
      }
  };

  const downloadAll = async () => {
    if (generatedFiles.length === 1) {
        const link = document.createElement('a');
        link.href = generatedFiles[0].url;
        link.download = generatedFiles[0].name;
        link.click();
    } else {
        const zip = new JSZip();
        generatedFiles.forEach(f => zip.file(f.name, f.blob));
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'parsepdf_results.zip';
        link.click();
    }
  };

  // Render Editor Overlay if status is EDITING_PPTX
  if (status === ProcessStatus.EDITING_PPTX) {
      return (
          <PptxEditor 
            slides={pptxSlides}
            totalFiles={pptxTotalPages} 
            onDownload={handlePptxDownload} 
            onCancel={() => { setStatus(ProcessStatus.IDLE); setPptxSlides([]); }} 
          />
      );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans text-black">
      {/* Sidebar Navigation */}
      <aside className="w-80 bg-white border-r-4 border-black flex flex-col fixed inset-y-0 z-50 overflow-y-auto">
        <div className="p-6 border-b-4 border-black bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-primary border-4 border-black p-2 shadow-neo-sm">
                <FileText size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter">PARSE<span className="text-primary">PDF</span></h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-3">
          {[
              { id: ConversionMode.PDF_TO_PNG, icon: Images, label: t('pdfToPng') },
              { id: ConversionMode.PNG_TO_PDF, icon: FileStack, label: t('pngToPdf') },
              { id: ConversionMode.MERGE_PDF, icon: Files, label: t('mergePdf') },
              { id: ConversionMode.FLATTEN_PDF, icon: Layers, label: t('flattenPdf') },
              { id: ConversionMode.SPLIT_PDF, icon: Scissors, label: t('splitPdf') },
              { id: ConversionMode.PDF_TO_PPTX, icon: Presentation, label: t('pdfToPptx') },
          ].map(m => (
              <button 
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`w-full flex items-center gap-3 p-4 font-bold border-2 transition-all duration-200 rounded-lg ${
                    mode === m.id 
                      ? 'bg-primary border-black shadow-neo-sm translate-x-[2px] translate-y-[2px]' 
                      : 'bg-white border-transparent hover:bg-gray-100 hover:border-black/10'
                  }`}
              >
                  <m.icon size={20} />
                  <span className="uppercase text-sm">{m.label}</span>
                  {mode === m.id && <ArrowRight size={16} className="ml-auto" />}
              </button>
          ))}
        </nav>

        <div className="p-4 border-t-4 border-black bg-gray-50 space-y-3">
           <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 bg-white" onClick={() => setLang(l => l === 'ko' ? 'en' : 'ko')}>
                  <Globe size={16} /> {lang.toUpperCase()}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 bg-white" onClick={() => window.open('https://github', '_blank')}>
                  <Github size={16} />
              </Button>
           </div>
           <p className="text-[10px] text-gray-500 font-mono text-center">
              Client-side only. No uploads.
           </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-80 p-8 min-h-screen">
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Page Title */}
          <div className="flex flex-col gap-2 border-b-2 border-black/10 pb-6">
            <h2 className="text-4xl font-black uppercase tracking-tight">
              {mode === ConversionMode.PDF_TO_PNG && t('pdfToPng')}
              {mode === ConversionMode.PNG_TO_PDF && t('pngToPdf')}
              {mode === ConversionMode.MERGE_PDF && t('mergePdf')}
              {mode === ConversionMode.FLATTEN_PDF && t('flattenPdf')}
              {mode === ConversionMode.SPLIT_PDF && t('splitPdf')}
              {mode === ConversionMode.PDF_TO_PPTX && t('pdfToPptx')}
            </h2>
            <p className="text-gray-600 font-medium text-lg">
                {mode === ConversionMode.PDF_TO_PPTX ? t('pptxEditableDesc') : t('heroDesc')}
            </p>
          </div>

          <Pipeline status={status === ProcessStatus.ANALYZING_PPTX ? ProcessStatus.PROCESSING : status} />

          {status === ProcessStatus.IDLE && (
              <section className="space-y-6">
                  <DropZone mode={mode} onFilesDropped={onFilesDropped} translations={{ dropTitle: t('dropTitle'), dropDesc: t('dropDesc'), browse: t('browse') }} />
                  
                  {detailedStatus && (
                      <div className="flex items-center justify-center p-4 bg-yellow-50 border-2 border-black rounded-lg animate-pulse">
                          <BrainCircuit className="mr-2 animate-spin" />
                          <span className="font-bold">{detailedStatus}</span>
                      </div>
                  )}

                  {mode === ConversionMode.PDF_TO_PPTX && (
                      <Card title={t('pptxEditable')} icon={BrainCircuit}>
                          <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-600">{t('pptxEditableDesc')}</p>
                              <button 
                                  onClick={() => setPptxEditable(!pptxEditable)}
                                  className={`w-16 h-8 rounded-full border-2 border-black relative transition-colors ${pptxEditable ? 'bg-green-400' : 'bg-gray-200'}`}
                              >
                                  <div className={`absolute top-1 w-5 h-5 bg-white border-2 border-black rounded-full transition-all ${pptxEditable ? 'left-9' : 'left-1'}`} />
                              </button>
                          </div>
                      </Card>
                  )}
              </section>
          )}

          {(status === ProcessStatus.PROCESSING || status === ProcessStatus.ANALYZING_PPTX || status === ProcessStatus.COMPLETED) && (
              <Card title={status === ProcessStatus.COMPLETED ? t('ready') : t('processing')} icon={status === ProcessStatus.COMPLETED ? CheckCircle : Cog}>
                  <div className="space-y-6">
                      {(status === ProcessStatus.PROCESSING || status === ProcessStatus.ANALYZING_PPTX) && (
                          <div className="flex flex-col items-center gap-4 py-8">
                              <div className="w-16 h-16 bg-primary border-4 border-black rounded-full flex items-center justify-center animate-spin">
                                  <Cog size={32} />
                              </div>
                              <p className="font-black text-xl flex items-center gap-2">
                                  {detailedStatus.includes('AI') && <BrainCircuit className="text-primary" />}
                                  {detailedStatus || (status === ProcessStatus.ANALYZING_PPTX ? t('analyzing') : t('processing'))}
                              </p>
                          </div>
                      )}

                      {generatedFiles.length > 0 && status === ProcessStatus.COMPLETED && (
                          <>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                  {generatedFiles.map(f => (
                                      <div key={f.id} className="border-4 border-black bg-white shadow-neo-sm overflow-hidden group">
                                          <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                              {f.name.endsWith('png') ? <img src={f.url} className="w-full h-full object-cover" /> : <FileText size={32} />}
                                          </div>
                                          <div className="p-2 border-t-4 border-black bg-white truncate font-bold text-[10px]">{f.name}</div>
                                      </div>
                                  ))}
                              </div>
                              <div className="flex justify-center gap-4">
                                  <Button size="lg" onClick={downloadAll}>
                                      <Download size={24} /> {t('downloadZip')}
                                  </Button>
                                  <Button variant="outline" size="lg" onClick={() => setStatus(ProcessStatus.IDLE)}>
                                      <Plus size={24} /> {t('addMore')}
                                  </Button>
                              </div>
                          </>
                      )}
                  </div>
              </Card>
          )}
        </div>
      </main>

      {pendingPdf && (
        <PageSelectionModal 
            fileName={pendingPdf.file.name}
            totalPageCount={pendingPdf.count}
            onConfirm={startConversion}
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

      {toasts.map(toast => (
        <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      ))}
    </div>
  );
}

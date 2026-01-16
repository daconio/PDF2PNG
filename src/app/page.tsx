'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { loadPDF, renderPageToBlob, imagesToPDF, createZipBlob } from '@/lib/pdf-processor';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from './components/SortableItem';

declare global {
  interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }
}

interface ProcessedPage {
  pageNumber: number;
  status: 'pending' | 'processing' | 'saving' | 'completed' | 'error';
  path?: string;
  error?: string;
}


const translations = {
  en: {
    title: "PDF SUITE",
    subtitle: "Instant PDF & Image conversion, right in your browser.",
    tagline: "Scaling New Heights in PDF Productivity",
    modePdf: "PDF to PNG",
    modePng: "PNG to PDF",
    autoSave: "Auto-Save Folder",
    autoSaveDesc: "(Optional - otherwise files download individually)",
    connectFolder: "Connect to a local folder for automatic saving",
    connected: "Connected: ",
    uploadPdfTitle: "Upload PDF to Extract PNGs",
    uploadPngTitle: "Upload Images to Merge into PDF",
    dragPdf: "Drag & Drop PDF files here",
    dragPng: "PNG, JPG, BMP, etc.",
    processing: "Processing...",
    dropHere: "Drop it here!",
    pageRange: "Page Range (Optional)",
    pageRangePlaceholder: "e.g. 1-5, 8, 11-13",
    leaveEmpty: "Leave empty to process all pages",
    startSeparation: "Start Separation",
    mergePdf: "Merge to PDF & Download",
    generating: "Generating PDF...",
    clearImages: "Clear all images",
    status: "Processing Status",
    downloadZip: "Download all ZIP",
    completed: "Completed",
    addMore: "Add More",
    switchLang: "한글로 전환",
    howToUse: "How to Use",
    howToPdfContent: "Upload a PDF, select pages (optional), and extract high-quality PNGs instantly.",
    howToPngContent: "Upload multiple images, reorder them via drag & drop, and merge into a single PDF.",
    previewTitle: "Preview (First 4 Pages)",
    loadingPreviews: "Generating thumbnails..."
  },
  ko: {
    title: "PDF 스위트",
    subtitle: "브라우저에서 바로 처리하는 PDF 및 이미지 변환 도구.",
    tagline: "문서 작업의 새로운 기준",
    modePdf: "PDF → 이미지",
    modePng: "이미지 → PDF",
    autoSave: "자동 저장 폴더",
    autoSaveDesc: "(선택 사항 - 미설정 시 개별 다운로드)",
    connectFolder: "자동 저장을 위한 로컬 폴더 연결",
    connected: "연결됨: ",
    uploadPdfTitle: "PDF를 업로드하여 이미지 추출",
    uploadPngTitle: "이미지를 합쳐서 PDF로 변환",
    dragPdf: "여기에 PDF 파일을 드래그하세요",
    dragPng: "PNG, JPG, BMP 등 지원",
    processing: "처리 중...",
    dropHere: "여기에 놓으세요!",
    pageRange: "페이지 범위 (선택)",
    pageRangePlaceholder: "예: 1-5, 8, 11-13",
    leaveEmpty: "비워두면 전체 페이지 변환",
    startSeparation: "변환 시작",
    mergePdf: "PDF 병합 및 다운로드",
    generating: "PDF 생성 중...",
    clearImages: "이미지 전체 삭제",
    status: "처리 상태",
    downloadZip: "전체 ZIP 다운로드",
    completed: "완료됨",
    addMore: "추가하기",
    switchLang: "Switch to English",
    howToUse: "사용 방법",
    howToPdfContent: "PDF를 업로드하고 원하는 페이지를 선택해 고화질 이미지로 변환하세요.",
    howToPngContent: "여러 이미지를 업로드하고 드래그 앤 드롭으로 순서를 바꿔 PDF로 병합하세요.",
    previewTitle: "미리보기 (첫 4페이지)",
    loadingPreviews: "썸네일 생성 중..."
  }
};

export default function Home() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const t = translations[lang];
  const [mode, setMode] = useState<'pdf2png' | 'png2pdf'>('pdf2png');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState(''); // Keep for fallback display
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [processedBlobs, setProcessedBlobs] = useState<{ filename: string, blob: Blob }[]>([]);
  const [pageRange, setPageRange] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Preview Generation Effect

  // We need to inject useEffect at the top level imports or just modify this block
  // Let's add the effect hook here
  useEffect(() => {
    if (!pdfFile) {
      setPreviewUrls([]);
      return;
    };

    let active = true;
    const generatePreviews = async () => {
      setIsPreviewLoading(true);
      try {
        const pdf = await loadPDF(pdfFile);
        const limit = Math.min(pdf.numPages, 4); // Preview first 4 pages
        const urls: string[] = [];

        for (let i = 1; i <= limit; i++) {
          if (!active) break;
          const blob = await renderPageToBlob(pdf, i);
          if (blob) {
            urls.push(URL.createObjectURL(blob));
          }
        }
        if (active) setPreviewUrls(urls);
      } catch (err) {
        console.error("Preview generation failed", err);
      } finally {
        if (active) setIsPreviewLoading(false);
      }
    };

    generatePreviews();

    return () => {
      active = false;
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [pdfFile]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    if (mode === 'pdf2png') {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.type !== 'application/pdf') {
        setUploadError('Please upload a valid PDF file.');
        return;
      }

      setPdfFile(selectedFile);
      setUploadError(null);
      setPages([]);
      setProcessedBlobs([]);
    } else {
      // PNG to PDF
      const validImages = acceptedFiles.filter(f => f.type.startsWith('image/'));
      if (validImages.length === 0) {
        setUploadError('Please upload valid image files (PNG, JPG, etc).');
        return;
      }
      setImageFiles(prev => [...prev, ...validImages]);
      setUploadError(null);
    }
  }, [mode]); // Removed dirHandle from deps to avoid re-triggering, simplified logic

  const parsePageRange = (rangeStr: string, maxPage: number): number[] => {
    if (!rangeStr.trim()) {
      return Array.from({ length: maxPage }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    const parts = rangeStr.split(',');

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, maxPage));
          const e = Math.max(1, Math.min(end, maxPage));
          for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
            pages.add(i);
          }
        }
      } else {
        const p = parseInt(part.trim());
        if (!isNaN(p) && p >= 1 && p <= maxPage) {
          pages.add(p);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleStartPdfConversion = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    setUploadError(null);
    setPages([]);
    setProcessedBlobs([]);

    try {
      const pdf = await loadPDF(pdfFile);
      const numPages = pdf.numPages;
      const pagesToProcess = parsePageRange(pageRange, numPages);

      if (pagesToProcess.length === 0) {
        throw new Error('No valid pages selected to process.');
      }

      const initialPages: ProcessedPage[] = pagesToProcess.map(p => ({
        pageNumber: p,
        status: 'pending'
      }));
      setPages(initialPages);

      for (const pageNum of pagesToProcess) {
        await processPage(pdf, pageNum, pdfFile.name);
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to process PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setImageFiles((items) => {
        const oldIndex = items.findIndex(item => item.name === active.id);
        const newIndex = items.findIndex(item => item.name === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleConvertImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    setIsProcessing(true);
    setUploadError(null);

    try {
      const pdfBlob = await imagesToPDF(imageFiles);
      const filename = 'converted.pdf';

      if (dirHandle) {
        // @ts-ignore
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        alert(`Successfully saved to your folder as ${filename}!`);
      } else {
        // Simple download fallback
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      setUploadError('Failed to generate PDF: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    if (processedBlobs.length === 0) return;
    setIsProcessing(true);
    try {
      const zipBlob = await createZipBlob(processedBlobs);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = pdfFile ? pdfFile.name.replace(/\.pdf$/i, '') : 'converted_pages';
      a.download = `${baseName}_all_pages.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setUploadError('Failed to create ZIP: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processPage = async (pdf: PDFDocumentProxy, pageNumber: number, originalFilename: string) => {
    try {
      updatePageStatus(pageNumber, 'processing');

      const blob = await renderPageToBlob(pdf, pageNumber);
      if (!blob) throw new Error('Failed to render page');

      updatePageStatus(pageNumber, 'saving');

      const baseName = originalFilename.replace(/\.pdf$/i, '');
      const filename = `${baseName}_page_${pageNumber}.png`;

      if (dirHandle) {
        try {
          // @ts-ignore
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          setProcessedBlobs(prev => [...prev, { filename, blob }]);
          updatePageStatus(pageNumber, 'completed', filename);
        } catch (err: any) {
          console.error('File System API Error:', err);
          throw new Error('Failed to write to selected folder. ' + err.message);
        }
      } else {
        // Fallback or automatic download? 
        // For static GH Pages, we'll just download if no folder selected
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setProcessedBlobs(prev => [...prev, { filename, blob }]);
        updatePageStatus(pageNumber, 'completed', filename);
      }

    } catch (err: any) {
      console.error(`Error processing page ${pageNumber}:`, err);
      updatePageStatus(pageNumber, 'error', undefined, err.message || 'Unknown error');
    }
  };

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
    } catch (err) {
      console.log('Folder selection cancelled or failed', err);
    }
  };

  const updatePageStatus = (pageNumber: number, status: ProcessedPage['status'], path?: string, error?: string) => {
    setPages(prev => prev.map(p =>
      p.pageNumber === pageNumber ? { ...p, status, path, error } : p
    ));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: mode === 'pdf2png' ? { 'application/pdf': ['.pdf'] } : { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: mode === 'png2pdf',
    disabled: isProcessing,
    noClick: (mode === 'pdf2png' && !!pdfFile) || (mode === 'png2pdf' && imageFiles.length > 0)
  });

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-start py-12 px-4 md:py-20 md:px-24 relative overflow-hidden bg-[--background] text-[--foreground]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #e5e5e5 1px, transparent 0)',
        backgroundSize: '20px 20px'
      }}
    >
      <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-10">

        {/* Language Toggle */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
          <button
            onClick={() => setLang(prev => prev === 'en' ? 'ko' : 'en')}
            className="group tooltip-trigger relative bg-white border-[3px] border-black px-4 py-2 font-bold shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] transition-all hover-spring"
          >
            {lang === 'en' ? 'KO' : 'EN'}
            <span className="tooltip-content absolute top-full right-0 mt-2 px-3 py-1 bg-black text-white text-xs whitespace-nowrap font-bold shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)] z-50">
              {t.switchLang}
            </span>
          </button>
        </div>

        {/* Header content with mountaineering theme context */}
        <div className="text-center space-y-6 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[--secondary] border-[3px] border-black text-black text-xs font-bold uppercase tracking-widest mb-2 shadow-[4px_4px_0px_0px_#000]">
            ✅ {t.tagline}
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-black drop-shadow-[5px_5px_0px_rgba(0,0,0,0.2)]">
            {t.title}
          </h1>
          <p className="text-[--foreground] text-lg md:text-2xl max-w-2xl mx-auto font-bold leading-relaxed border-b-4 border-[--primary] inline-block pb-2">
            {t.subtitle}
          </p>

          {/* Detailed Explanation */}
          <div className="max-w-xl mx-auto mt-4 p-4 bg-white/50 border-[2px] border-black border-dashed">
            <h3 className="text-sm font-black uppercase mb-1 flex items-center justify-center gap-2">
              ℹ️ {t.howToUse}
            </h3>
            <p className="text-sm font-medium opacity-80">
              {mode === 'pdf2png' ? t.howToPdfContent : t.howToPngContent}
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-2 bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] w-full max-w-md gap-2">
          <button
            onClick={() => {
              setMode('pdf2png');
              setPages([]);
              setPdfFile(null);
              setImageFiles([]);
              setUploadError(null);
              setProcessedBlobs([]);
              setPageRange('');
            }}
            className={`flex-1 py-3 px-6 transition-all duration-200 flex items-center justify-center gap-2 font-bold border-[3px] border-black hover-spring ${mode === 'pdf2png' ? 'bg-[--primary] text-white shadow-[2px_2px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-gray-100 text-black hover:bg-gray-200'}`}
          >
            📄 {t.modePdf}
          </button>
          <button
            onClick={() => { setMode('png2pdf'); setPages([]); setPdfFile(null); setImageFiles([]); setUploadError(null); setProcessedBlobs([]); }}
            className={`flex-1 py-3 px-6 transition-all duration-200 flex items-center justify-center gap-2 font-bold border-[3px] border-black hover-spring ${mode === 'png2pdf' ? 'bg-[--primary] text-white shadow-[2px_2px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-gray-100 text-black hover:bg-gray-200'}`}
          >
            🖼️ {t.modePng}
          </button>
        </div>

        <div className="w-full flex flex-col items-center gap-8">
          {/* Folder Selection (Native) */}
          <div className="w-full max-w-2xl flex flex-col gap-2">
            <label className="text-sm font-medium text-[--foreground] opacity-90 flex items-center gap-2">
              📂 {t.autoSave}
              <span className="text-xs font-normal opacity-70 ml-1">
                {dirHandle ? '' : t.autoSaveDesc}
              </span>
            </label>
            <button
              onClick={handleSelectFolder}
              className={`
                w-full p-5 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]
                flex items-center justify-between
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] transition-all text-left
                ${dirHandle ? 'bg-[--secondary]' : ''}
              `}
              disabled={isProcessing}
            >
              <span className={`flex items-center gap-3 font-bold text-black`}>
                {dirHandle ? (
                  <>
                    <span className="text-xl">📁</span>
                    {/* @ts-ignore */}
                    Connected: {dirHandle.name}
                  </>
                ) : (
                  <>
                    <span className="text-xl">📁</span>
                    <span className="opacity-100">{t.connectFolder}</span>
                  </>
                )}
              </span>
              <span className="ml-2">
                {dirHandle ? "✅" : "👉"}
              </span>
            </button>
          </div>

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`
              w-full max-w-2xl min-h-[400px] flex flex-col items-center justify-center 
              transition-all duration-200 border-[3px] border-dashed border-black
              bg-white relative shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] p-10
              ${isDragActive ? 'bg-[--secondary] border-solid scale-[1.01]' : 'hover:bg-gray-50 hover:border-gray-800'}
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              ${(mode === 'pdf2png' && !!pdfFile) || (mode === 'png2pdf' && imageFiles.length > 0) ? 'cursor-default border-solid shadow-[8px_8px_0px_0px_#000]' : 'cursor-pointer'}
            `}
          >
            {isDragActive && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[--secondary] bg-opacity-90 backdrop-blur-sm border-[5px] border-black animate-in fade-in zoom-in duration-200 pointer-events-none">
                <div className="text-center transform scale-110">
                  <span className="text-8xl block mb-4 animate-bounce">📥</span>
                  <p className="text-4xl font-black uppercase text-black drop-shadow-[2px_2px_0px_white]">{t.dropHere}</p>
                </div>
              </div>
            )}
            <input {...getInputProps()} />

            {/* Clear Button */}
            {((mode === 'pdf2png' && pdfFile) || (mode === 'png2pdf' && imageFiles.length > 0)) && !isProcessing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfFile(null);
                  setImageFiles([]);
                  setPages([]);
                  setProcessedBlobs([]);
                  setPageRange('');
                }}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-20"
                title="Clear selection"
              >
                <span className="text-xl">❌</span>
              </button>
            )}

            <div className="flex flex-col items-center gap-6 p-8 text-center w-full">
              {!pdfFile && imageFiles.length === 0 ? (
                <>
                  <div className={`
                        p-6 bg-black border-[3px] border-black text-white
                        ${isDragActive || isProcessing ? 'animate-bounce' : ''}
                        shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]
                    `}>
                    {isProcessing ? (
                      <span className="text-4xl animate-spin block">⏳</span>
                    ) : (
                      <span className="text-4xl">📤</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-2xl font-bold tracking-tight">
                      {isProcessing ? t.processing : isDragActive ? t.dropHere : mode === 'pdf2png' ? t.uploadPdfTitle : t.uploadPngTitle}
                    </p>
                    <p className="text-base text-[--foreground] opacity-80 font-medium">
                      {mode === 'pdf2png'
                        ? t.dragPdf
                        : t.dragPng
                      }
                    </p>
                  </div>
                </>
              ) : (
                /* Processing / Selection UI */
                <div className="w-full flex flex-col items-center gap-6">
                  {mode === 'pdf2png' && pdfFile && (
                    <div className="w-full max-w-md space-y-4">
                      <div className="flex items-center justify-center gap-3 p-4 bg-[--secondary] border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
                        <span className="text-3xl">📄</span>
                        <div className="text-left">
                          <p className="font-bold text-black truncate max-w-[200px]">{pdfFile.name}</p>
                          <p className="text-xs text-black font-mono">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>

                      {/* PDF Preview Grid */}
                      {!pages.length && (
                        <div className="w-full bg-gray-50 border-[2px] border-black border-dashed p-4 rounded-lg">
                          <p className="text-xs font-bold uppercase mb-2 text-gray-500">{t.previewTitle}</p>
                          {isPreviewLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <span className="text-2xl animate-spin block opacity-50">⏳</span>
                              <span className="ml-2 text-xs font-mono">{t.loadingPreviews}</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              {previewUrls.map((url, idx) => (
                                <div key={idx} className="aspect-[1/1.4] bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden relative group">
                                  <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                                  <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] px-1 font-mono">
                                    {idx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!pages.length && (
                        <div className="flex flex-col gap-2 text-left">
                          <label className="text-sm font-bold border-b-2 border-black inline-block w-fit">{t.pageRange}</label>
                          <input
                            type="text"
                            placeholder={t.pageRangePlaceholder}
                            value={pageRange}
                            onChange={(e) => setPageRange(e.target.value)}
                            className="w-full px-4 py-3 bg-white border-[3px] border-black focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] outline-none transition-all font-mono placeholder:text-gray-400"
                          />
                          <p className="text-xs font-bold text-gray-500">{t.leaveEmpty}</p>
                        </div>
                      )}

                      {!pages.length && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartPdfConversion(); }}
                          className="w-full py-4 bg-[--primary] border-[3px] border-black text-white font-black text-lg uppercase tracking-wider shadow-[6px_6px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all flex items-center justify-center gap-2 hover-spring"
                        >
                          <span className="font-emoji text-xl">▶️</span>
                          {t.startSeparation}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-[--error] bg-[rgba(239,68,68,0.1)] px-4 py-2 rounded-lg border border-[--error]">
              <span className="text-xl">⚠️</span>
              <span>{uploadError}</span>
            </div>
          )}

          {/* Action Button for PNG to PDF */}
          {mode === 'png2pdf' && imageFiles.length > 0 && (
            <div className="w-full max-w-2xl flex flex-col gap-4 items-center">
              <button
                onClick={handleConvertImagesToPdf}
                disabled={isProcessing}
                className="w-full py-4 bg-[--primary] border-[3px] border-black text-white font-black text-xl uppercase tracking-wider shadow-[6px_6px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed hover-spring"
              >
                {isProcessing ? t.generating : t.mergePdf}
              </button>
              <button
                onClick={() => setImageFiles([])}
                className="text-sm opacity-50 hover:opacity-100 transition-opacity font-bold"
              >
                {t.clearImages}
              </button>
            </div>
          )}

          {/* Results List for PDF to PNG */}
          {mode === 'pdf2png' && pages.length > 0 && (
            <div className="w-full max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  {t.status}
                </h2>
                <div className="flex items-center gap-4">
                  {processedBlobs.length > 0 && (
                    <button
                      onClick={handleDownloadZip}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-white border-[2px] border-black text-black text-sm font-bold shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
                    >
                      💾
                      {t.downloadZip}
                    </button>
                  )}
                  <span className="text-sm opacity-50">
                    {pages.filter(p => p.status === 'completed').length} / {pages.length} {t.completed}
                  </span>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex items-center justify-between group transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.1)] flex items-center justify-center">
                        <span className="text-xl opacity-70 group-hover:opacity-100 transition-opacity">🖼️</span>
                      </div>
                      <div>
                        <p className="font-medium">Page {page.pageNumber}</p>
                        <p className="text-xs opacity-50 capitalize">{page.status}...</p>
                      </div>
                    </div>

                    <div>
                      {page.status === 'completed' && <span className="text-2xl animate-in zoom-in">✅</span>}
                      {page.status === 'error' && <span className="text-xl">❌</span>}
                      {(page.status === 'processing' || page.status === 'saving') && <span className="text-xl animate-spin block">⏳</span>}
                      {page.status === 'pending' && <div className="w-3 h-3 rounded-full bg-gray-300 border border-black" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Previews for PNG to PDF with Drag & Drop */}
          {mode === 'png2pdf' && imageFiles.length > 0 && (
            <div className="w-full max-w-2xl space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">Selected Images ({imageFiles.length})</h2>
                <p className="text-xs opacity-50 flex items-center gap-1">
                  <span className="text-lg">⠿</span>
                  Drag to reorder
                </p>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={imageFiles.map(f => f.name)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imageFiles.map((file) => (
                      <SortableItem key={file.name} id={file.name} file={file} />
                    ))}

                    {/* Add More Button */}
                    <div
                      onClick={(_) => {
                        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (input) input.click();
                      }}
                      className="aspect-square bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex flex-col items-center justify-center cursor-pointer transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] group animate-pop"
                    >
                      <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">➕</span>
                      <span className="text-xs font-bold mt-2 text-black opacity-50 group-hover:opacity-100">{t.addMore}</span>
                    </div>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>
    </main >
  );
}

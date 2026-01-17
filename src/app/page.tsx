'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { loadPDF, renderPageToBlob, imagesToPDF } from '@/lib/pdf-processor';
import {
  Upload, FileText, CheckCircle, Loader2, AlertCircle,
  Image as ImageIcon, Folder, ArrowRight, Layers, Sparkles,
  Download, X, File
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

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
  blobUrl?: string;
}

export default function Home() {
  const [mode, setMode] = useState<'pdf2png' | 'png2pdf'>('pdf2png');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

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
      setIsProcessing(true);

      try {
        const pdf = await loadPDF(selectedFile);
        const numPages = pdf.numPages;

        const initialPages: ProcessedPage[] = Array.from({ length: numPages }, (_, i) => ({
          pageNumber: i + 1,
          status: 'pending'
        }));
        setPages(initialPages);

        for (let i = 1; i <= numPages; i++) {
          await processPage(pdf, i, selectedFile.name);
        }
      } catch (err) {
        console.error(err);
        setUploadError('Failed to load PDF. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    } else {
      const validImages = acceptedFiles.filter(f => f.type.startsWith('image/'));
      if (validImages.length === 0) {
        setUploadError('Please upload valid image files (PNG, JPG, etc).');
        return;
      }
      setImageFiles(prev => [...prev, ...validImages]);
      setUploadError(null);
    }
  }, [mode, dirHandle]);

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
          updatePageStatus(pageNumber, 'completed', filename);
        } catch (err: any) {
          console.error('File System API Error:', err);
          throw new Error('Failed to write to selected folder: ' + err.message);
        }
      } else {
        // Create Object URL for manual download
        const url = URL.createObjectURL(blob);
        updatePageStatus(pageNumber, 'completed', filename, undefined, url);
      }

    } catch (err: any) {
      console.error(`Error processing page ${pageNumber}:`, err);
      updatePageStatus(pageNumber, 'error', undefined, err.message || 'Unknown error');
    }
  };

  const updatePageStatus = (
    pageNumber: number,
    status: ProcessedPage['status'],
    path?: string,
    error?: string,
    blobUrl?: string
  ) => {
    setPages(prev => prev.map(p =>
      p.pageNumber === pageNumber ? { ...p, status, path, error, blobUrl } : p
    ));
  };

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
    } catch (err) {
      console.log('Folder selection cancelled', err);
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
        alert(`Saved ${filename} to folder!`);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setUploadError('Failed to generate PDF: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: mode === 'pdf2png' ? { 'application/pdf': ['.pdf'] } : { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: mode === 'png2pdf',
    disabled: isProcessing
  });

  const reset = () => {
    setPdfFile(null);
    setImageFiles([]);
    setPages([]);
    setUploadError(null);
  };

  // --- Render Sections ---

  const renderHero = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-8 max-w-2xl mx-auto mt-20 p-6">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[--foreground]">
          Parse<span className="text-[--primary]">PDF</span>
        </h1>
        <p className="text-xl text-[--muted] max-w-lg mx-auto leading-relaxed">
          The modern, intelligent way to convert documents. <br />
          Secure, fast, and local.
        </p>
      </div>

      <div className="flex bg-[--secondary] p-1 rounded-lg border border-[--border]">
        <button
          onClick={() => { setMode('pdf2png'); reset(); }}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'pdf2png' ? 'bg-white shadow text-[--primary]' : 'text-[--muted] hover:text-[--foreground]'
            }`}
        >
          PDF to PNG
        </button>
        <button
          onClick={() => { setMode('png2pdf'); reset(); }}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'png2pdf' ? 'bg-white shadow text-[--primary]' : 'text-[--muted] hover:text-[--foreground]'
            }`}
        >
          PNG to PDF
        </button>
      </div>

      <div
        {...getRootProps()}
        className={`
          w-full max-w-lg min-h-[240px] flex flex-col items-center justify-center 
          rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300
          ${isDragActive
            ? 'border-[--primary] bg-[--primary-light]/10 scale-[1.02]'
            : 'border-[--border] bg-white hover:border-[--primary]/50 hover:bg-[--secondary]/50'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="p-4 rounded-full bg-[--secondary] mb-4">
          <Upload className={`w-8 h-8 text-[--muted] ${isDragActive ? 'text-[--primary]' : ''}`} />
        </div>
        <p className="text-lg font-semibold text-[--foreground]">
          {isDragActive ? 'Drop file here' : 'Click or Drag to Upload'}
        </p>
        <p className="text-sm text-[--muted] mt-2">
          {mode === 'pdf2png' ? 'Supports PDF files' : 'Supports PNG, JPG'}
        </p>
      </div>

      {/* Optional Folder Connect */}
      <button
        onClick={handleSelectFolder}
        className="flex items-center gap-2 text-sm text-[--muted] hover:text-[--primary] transition-colors"
      >
        <Folder className="w-4 h-4" />
        {dirHandle ? `Saving to: ${dirHandle.name}` : 'Set auto-save folder (Optional)'}
        {dirHandle && <CheckCircle className="w-3 h-3 text-[--success]" />}
      </button>

      {uploadError && (
        <div className="flex items-center gap-2 text-[--error] bg-red-50 px-4 py-2 rounded-lg text-sm mt-4">
          <AlertCircle className="w-4 h-4" />
          {uploadError}
        </div>
      )}
    </div>
  );

  const renderPipeline = () => (
    <div className="w-full max-w-7xl mx-auto px-4 py-12 flex flex-col gap-8 animate-fade-in-up">

      {/* Header / Nav */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2 select-none cursor-pointer" onClick={reset}>
          Parse<span className="text-[--primary]">PDF</span> <span className="text-[--muted] font-normal text-lg">/ Processor</span>
        </h2>
        <button onClick={reset} className="p-2 hover:bg-[--secondary] rounded-full transition-colors">
          <X className="w-5 h-5 text-[--muted]" />
        </button>
      </div>

      {/* Main Pipeline Visualization */}
      <div className="flex flex-col lg:flex-row items-stretch gap-0 border border-[--border] rounded-3xl overflow-hidden glass-panel">

        {/* Source Column */}
        <div className="flex-1 bg-[--secondary]/30 p-8 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-[--border] min-h-[300px]">
          <div className="text-xs font-bold tracking-widest text-[--muted] uppercase mb-8">Input Source</div>
          <div className="relative group">
            <div className="w-32 h-40 bg-white border border-[--border] rounded-xl shadow-sm flex flex-col items-center justify-center p-4 transition-all group-hover:shadow-md group-hover:-translate-y-1">
              {mode === 'pdf2png' ? <FileText className="w-12 h-12 text-[--primary] mb-2" /> : <ImageIcon className="w-12 h-12 text-[--primary] mb-2" />}
              <div className="text-xs text-center font-medium text-[--foreground] truncate w-full">
                {pdfFile ? pdfFile.name : `${imageFiles.length} Images`}
              </div>
              <div className="text-[10px] text-[--muted] mt-1">
                {mode === 'pdf2png' ? (filesize(pdfFile?.size || 0)) : ''}
              </div>
            </div>
            {/* Connection Dot */}
            <div className="hidden lg:block absolute -right-12 top-1/2 w-4 h-4 bg-[--primary] rounded-full z-10 translate-x-1/2 ring-4 ring-white"></div>
          </div>
        </div>

        {/* Processing Node (Center) */}
        <div className="relative flex-none w-full lg:w-48 bg-white flex flex-col items-center justify-center py-8 z-0">
          {/* Animated Connectors only visible on Desktop for horizontal flow */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[--border] hidden lg:block overflow-hidden">
            {isProcessing && <div className="absolute inset-0 bg-[--primary] animate-[flow-animation_1s_infinite_linear]" />}
          </div>

          <div className="z-10 w-20 h-20 bg-white border-2 border-[--primary] rounded-2xl flex items-center justify-center shadow-lg relative">
            {isProcessing && (
              <div className="absolute inset-0 border-2 border-[--primary] rounded-2xl animate-ping opacity-20" />
            )}
            <Sparkles className={`w-8 h-8 text-[--primary] ${isProcessing ? 'animate-spin-slow' : ''}`} />
          </div>
          <div className="mt-4 text-center z-10 bg-white px-2">
            <div className="font-semibold text-sm">Engine Core</div>
            <div className="text-xs text-[--muted]">
              {isProcessing ? 'Processing chunks...' : 'Idle'}
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex-[2] bg-[--secondary]/30 p-8 flex flex-col border-t lg:border-t-0 lg:border-l border-[--border]">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-bold tracking-widest text-[--muted] uppercase">Output Result</div>
            {pages.length > 0 && <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-[--border]">{pages.filter(p => p.status === 'completed').length} / {pages.length}</span>}
          </div>

          <div className="flex-1 min-h-[300px] max-h-[600px] overflow-y-auto custom-scrollbar p-2 -m-2">
            {pages.length === 0 && !isProcessing && (
              <div className="h-full flex items-center justify-center text-[--muted] text-sm">
                Waiting for input...
              </div>
            )}

            {mode === 'pdf2png' && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className={`group relative bg-white border border-[--border] rounded-lg p-3 aspect-[3/4] flex flex-col items-center justify-center shadow-sm transition-all hover:shadow-md ${page.blobUrl ? 'cursor-pointer hover:border-[--primary]' : ''}`}
                    onClick={() => {
                      if (page.blobUrl && page.path) {
                        const a = document.createElement('a');
                        a.href = page.blobUrl;
                        a.download = page.path;
                        a.click();
                      }
                    }}
                  >
                    {page.status === 'completed' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${page.blobUrl ? 'bg-[--primary-light]/20 text-[--primary] group-hover:scale-110' : 'bg-green-50 text-green-500'}`}>
                          {page.blobUrl ? <Download className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        <span className="text-xs font-medium">Page {page.pageNumber}</span>
                        {page.blobUrl && <span className="text-[10px] text-[--primary] opacity-0 group-hover:opacity-100 transition-opacity font-medium">Click to Download</span>}
                        {!page.blobUrl && <span className="text-[10px] text-[--success] opacity-0 group-hover:opacity-100 transition-opacity">Auto-Saved</span>}
                      </div>
                    ) : page.status === 'error' ? (
                      <div className="text-[--error] flex flex-col items-center text-center p-2">
                        <AlertCircle className="w-6 h-6 mb-2" />
                        <span className="text-[10px] leading-tight">{page.error || 'Error'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[--primary]" />
                        <span className="text-xs text-[--muted] capitalize">{page.status}...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* PNG to PDF Output placeholder */}
            {mode === 'png2pdf' && isProcessing && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-[--primary]" />
                <p className="text-sm font-medium">Merging images...</p>
              </div>
            )}

            {mode === 'png2pdf' && !isProcessing && imageFiles.length > 0 && (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="p-6 bg-green-50 rounded-full mb-4 ring-8 ring-green-100">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <p className="font-medium text-lg mb-4">Ready to Merge</p>
                <button
                  onClick={handleConvertImagesToPdf}
                  className="px-6 py-3 bg-[--primary] text-white rounded-xl font-medium shadow-lg hover:bg-[--primary-hover] transition-all"
                >
                  Downoad PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen w-full relative">
      {/* Background Grid is handled in CSS on body */}

      <div className="relative z-10 w-full">
        {(pdfFile || imageFiles.length > 0) ? renderPipeline() : renderHero()}
      </div>

    </main>
  );
}

// Utility
function filesize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

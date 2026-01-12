'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { loadPDF, renderPageToBlob } from '@/lib/pdf-processor';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Image as ImageIcon, FolderInput, Folder, ChevronRight } from 'lucide-react';
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
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState(''); // Keep for fallback display
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const selectedFile = acceptedFiles[0];
    if (selectedFile.type !== 'application/pdf') {
      setUploadError('Please upload a valid PDF file.');
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
    setPages([]);
    setIsProcessing(true);

    try {
      const pdf = await loadPDF(selectedFile);
      const numPages = pdf.numPages;

      // Initialize pages state
      const initialPages: ProcessedPage[] = Array.from({ length: numPages }, (_, i) => ({
        pageNumber: i + 1,
        status: 'pending'
      }));
      setPages(initialPages);

      // Process pages sequentially or in parallel?
      // Sequential is safer for memory, but parallel is faster.
      // Let's do batches or sequential for stability.
      for (let i = 1; i <= numPages; i++) {
        await processPage(pdf, i, selectedFile.name);
      }
    } catch (err) {
      console.error(err);
      setUploadError('Failed to load PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [dirHandle]);

  const processPage = async (pdf: PDFDocumentProxy, pageNumber: number, originalFilename: string) => {
    try {
      updatePageStatus(pageNumber, 'processing');

      const blob = await renderPageToBlob(pdf, pageNumber);
      if (!blob) throw new Error('Failed to render page');

      updatePageStatus(pageNumber, 'saving');

      // Prepare filename: original_page_X.png
      const baseName = originalFilename.replace(/\.pdf$/i, '');
      const filename = `${baseName}_page_${pageNumber}.png`;

      if (dirHandle) {
        // --- Client-side Saving (Native) ---
        try {
          // Get file handle in the selected directory
          // @ts-ignore
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          updatePageStatus(pageNumber, 'completed', filename);
        } catch (err: any) {
          console.error('File System API Error:', err);
          throw new Error('Failed to write to selected folder. ' + err.message);
        }
      } else {
        // --- Fallback: Server-side Saving (Default) ---
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('filename', filename);
        if (outputDir.trim()) {
          formData.append('outputDir', outputDir.trim());
        }

        const response = await fetch('/api/save-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to save file');

        const data = await response.json();
        updatePageStatus(pageNumber, 'completed', data.path);
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
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 relative overflow-hidden">
      <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[--primary] to-[--secondary] neon-text pb-2">
            PDF to PNG
          </h1>
          <p className="text-[--foreground] opacity-70 text-lg md:text-xl max-w-2xl mx-auto">
            Drag & Drop your PDF to instantly convert pages into high-quality PNG images.
          </p>
        </div>

        {/* Folder Selection (Native) */}
        <div className="w-full max-w-2xl flex flex-col gap-2">
          <label className="text-sm text-[--foreground] opacity-70 flex items-center gap-2">
            <FolderInput className="w-4 h-4" />
            Output Destination
          </label>
          <button
            onClick={handleSelectFolder}
            className={`
               w-full p-4 rounded-xl glass-panel border-[--card-border] 
               flex items-center justify-between
               hover:bg-[rgba(255,255,255,0.05)] transition-colors text-left
               ${dirHandle ? 'border-[--success]' : ''}
             `}
            disabled={isProcessing}
          >
            <span className={`flex items-center gap-2 ${dirHandle ? 'text-[--success]' : 'opacity-50'}`}>
              {dirHandle ? (
                <>
                  <Folder className="w-5 h-5" />
                  {/* @ts-ignore */}
                  Saving to: {dirHandle.name}
                </>
              ) : (
                'Select Output Folder (Optional - defaults to server ./pdf_output)'
              )}
            </span>
            {dirHandle ? <CheckCircle className="w-5 h-5 text-[--success]" /> : <ChevronRight className="w-5 h-5 opacity-50" />}
          </button>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            w-full max-w-2xl min-h-[300px] flex flex-col items-center justify-center 
            rounded-3xl cursor-pointer transition-all duration-300 border-2 border-dashed
            glass-panel
            ${isDragActive ? 'border-[--primary] scale-105 shadow-[0_0_30px_var(--primary-glow)]' : 'border-[--card-border] hover:border-[--secondary] hover:shadow-[0_0_20px_var(--secondary-glow)]'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-6 p-8 text-center">
            <div className={`
                p-6 rounded-full bg-gradient-to-br from-[--primary] to-[--secondary]
                ${isDragActive || isProcessing ? 'animate-pulse-glow' : ''}
            `}>
              {isProcessing ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-white" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-semibold">
                {isProcessing ? 'Processing PDF...' : isDragActive ? 'Drop it here!' : 'Click or Drag PDF'}
              </p>
              <p className="text-sm opacity-50">
                {file ? `Selected: ${file.name}` : 'Supports PDF files only'}
              </p>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 text-[--error] bg-[rgba(239,68,68,0.1)] px-4 py-2 rounded-lg border border-[--error]">
            <AlertCircle className="w-5 h-5" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Results List */}
        {pages.length > 0 && (
          <div className="w-full max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[--secondary]" />
                Processing Status
              </h2>
              <span className="text-sm opacity-50">
                {pages.filter(p => p.status === 'completed').length} / {pages.length} Completed
              </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {pages.map((page) => (
                <div
                  key={page.pageNumber}
                  className="glass-panel p-4 rounded-xl flex items-center justify-between group hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.1)] flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <p className="font-medium">Page {page.pageNumber}</p>
                      <p className="text-xs opacity-50 capitalize">{page.status}...</p>
                    </div>
                  </div>

                  <div>
                    {page.status === 'completed' && <CheckCircle className="w-6 h-6 text-[--success] animate-in zoom-in" />}
                    {page.status === 'error' && <AlertCircle className="w-6 h-6 text-[--error]" />}
                    {(page.status === 'processing' || page.status === 'saving') && <Loader2 className="w-5 h-5 animate-spin opacity-50" />}
                    {page.status === 'pending' && <div className="w-3 h-3 rounded-full bg-[rgba(255,255,255,0.2)]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main >
  );
}

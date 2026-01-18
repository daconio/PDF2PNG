import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Compatibility layer for different module loaders (ESM/CJS)
// In some environments (like esm.sh), pdfjs-dist is exported as a default object wrapped in the module namespace.
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

// Ensure strict version matching for the worker to avoid runtime errors.
const PDFJS_VERSION = '3.11.174';

// Initialize worker
if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
}

/**
 * Gets the total number of pages in a PDF file.
 */
export const getPdfPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
  });

  const pdf = await loadingTask.promise;
  return pdf.numPages;
};

/**
 * Converts a PDF file into an array of PNG Blobs.
 * Optionally converts only specified pages.
 */
export const convertPdfToPng = async (
  file: File,
  onProgress: (page: number, total: number) => void,
  pagesToConvert?: number[]
): Promise<Blob[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  
  // Determine which pages to convert
  const targetPages = pagesToConvert || Array.from({ length: totalPages }, (_, i) => i + 1);
  const validPages = targetPages.filter(p => p >= 1 && p <= totalPages);
  
  const pngBlobs: Blob[] = [];

  for (let i = 0; i < validPages.length; i++) {
    const pageNum = validPages[i];
    const page = await pdf.getPage(pageNum);
    
    // Use a scale of 2.0 for higher quality images (Retina-like)
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error('Could not create canvas context');

    // Render the page into the canvas context
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;

    // Convert canvas to Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (blob) {
      pngBlobs.push(blob);
    }
    
    onProgress(i + 1, validPages.length);
  }

  return pngBlobs;
};

/**
 * Merges multiple image files (or blobs) into a single PDF.
 */
export const convertImagesToPdf = async (
  files: Blob[],
  onProgress: (current: number, total: number) => void
): Promise<Blob> => {
  // Handle jsPDF import potential issues similarly if needed
  const doc = new jsPDF();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageUrl = URL.createObjectURL(file);
    
    // Load image to get dimensions
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
    });

    const imgProps = doc.getImageProperties(img);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    
    // Calculate aspect ratio to fit page
    const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
    const width = imgProps.width * ratio;
    const height = imgProps.height * ratio;
    const x = (pdfWidth - width) / 2;
    const y = (pdfHeight - height) / 2;

    if (i > 0) {
      doc.addPage();
    }
    
    doc.addImage(img, x, y, width, height);
    onProgress(i + 1, files.length);
    URL.revokeObjectURL(imageUrl);
  }

  return doc.output('blob');
};
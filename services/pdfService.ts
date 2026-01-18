import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

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
export const getPdfPageCount = async (file: Blob): Promise<number> => {
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
  file: Blob,
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

/**
 * Merges multiple PDF files into a single PDF.
 */
export const mergePdfs = async (
  files: Blob[],
  onProgress: (current: number, total: number) => void
): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    copiedPages.forEach((page) => mergedPdf.addPage(page));
    onProgress(i + 1, files.length);
  }
  
  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
};

/**
 * Memory-efficiently converts PDFs to Images and then immediately into a single PDF.
 * This effectively "flattens" the PDFs.
 */
export const flattenPdfs = async (
    files: Blob[],
    onProgress: (current: number, total: number) => void
): Promise<Blob> => {
    const doc = new jsPDF();
    let totalPagesProcessed = 0;
    
    // First pass: calculate total pages for accurate progress bar
    let totalAllPages = 0;
    for(const file of files) {
        totalAllPages += await getPdfPageCount(file);
    }

    for (let fIndex = 0; fIndex < files.length; fIndex++) {
        const file = files[fIndex];
        const arrayBuffer = await file.arrayBuffer();
        
        const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
        });

        const pdf = await loadingTask.promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            
            // Use 1.5 scale - good balance between quality and memory for large docs
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (!context) continue;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            // Add to PDF
            // Note: We use the canvas data directly to avoid creating Blob URL overhead
            const imgData = canvas.toDataURL('image/jpeg', 0.95); // JPEG 0.95 is efficient
            
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            
            const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
            const width = imgProps.width * ratio;
            const height = imgProps.height * ratio;
            const x = (pdfWidth - width) / 2;
            const y = (pdfHeight - height) / 2;

            if (totalPagesProcessed > 0) {
                doc.addPage();
            }
            
            doc.addImage(imgData, 'JPEG', x, y, width, height);
            
            // Force cleanup
            canvas.width = 0; 
            canvas.height = 0;
            
            totalPagesProcessed++;
            onProgress(totalPagesProcessed, totalAllPages);
        }
    }
    
    return doc.output('blob');
}

/**
 * Rotates an image Blob by 90 degrees clockwise.
 */
export const rotateImage = async (blob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Swap dimensions for 90deg rotation
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (b) resolve(b);
        else reject(new Error('Conversion to Blob failed'));
      }, blob.type);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    
    img.src = url;
  });
};

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { PDFDocument, PDFPage } from 'pdf-lib';
// Use wildcard import to avoid "does not provide an export named default" error in some ESM environments
import * as PptxGenJSLib from 'pptxgenjs';

// Compatibility layer for different module loaders (ESM/CJS)
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

// Ensure strict version matching for the worker to avoid runtime errors.
const PDFJS_VERSION = '3.11.174';

// Initialize worker
if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
}

// Helper to remove control characters that break XML/PPTX generation
const sanitizeText = (str: string): string => {
    // Remove non-printable control characters, preserving common ones like newlines/tabs if needed (though usually handled by items)
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
};

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
 * Converts a PDF file into an array of Image Blobs (PNG or JPEG).
 */
export const convertPdfToImages = async (
  file: Blob,
  onProgress: (page: number, total: number) => void,
  pagesToConvert?: number[],
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.95
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
  
  const targetPages = pagesToConvert || Array.from({ length: totalPages }, (_, i) => i + 1);
  const validPages = targetPages.filter(p => p >= 1 && p <= totalPages);
  
  const imageBlobs: Blob[] = [];

  for (let i = 0; i < validPages.length; i++) {
    const pageNum = validPages[i];
    const page = await pdf.getPage(pageNum);
    
    // Render at 1.5 scale (down from 2.0) to prevent UI freeze on large PDFs
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error('Could not create canvas context');

    if (format === 'image/jpeg') {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), format, quality);
    });

    if (blob) {
      imageBlobs.push(blob);
    }
    
    onProgress(i + 1, validPages.length);
    
    // Explicit clean up
    canvas.width = 0;
    canvas.height = 0;
    context = null;

    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }

  return imageBlobs;
};

/**
 * Merges multiple image files (or blobs) into a single PDF.
 */
export const convertImagesToPdf = async (
  files: Blob[],
  onProgress: (current: number, total: number) => void,
  quality: number = 0.95
): Promise<Blob> => {
  const doc = new jsPDF();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageUrl = URL.createObjectURL(file);
    
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const imgData = canvas.toDataURL('image/jpeg', quality);
        
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        
        const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
        const width = imgProps.width * ratio;
        const height = imgProps.height * ratio;
        const x = (pdfWidth - width) / 2;
        const y = (pdfHeight - height) / 2;

        if (i > 0) {
          doc.addPage();
        }
        
        doc.addImage(imgData, 'JPEG', x, y, width, height);
    }
    
    onProgress(i + 1, files.length);
    URL.revokeObjectURL(imageUrl);
    
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }

  return doc.output('blob');
};

/**
 * Merges multiple PDF files into a single PDF.
 */
export const mergePdfs = async (
  files: Blob[],
  onProgress: (current: number, total: number) => void,
  quality: number = 1.0
): Promise<Blob> => {
  if (quality < 1.0) {
      return flattenPdfs(files, onProgress, quality);
  }

  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    copiedPages.forEach((page: PDFPage) => mergedPdf.addPage(page));
    onProgress(i + 1, files.length);
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }
  
  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Splits a PDF file into individual PDF files for specified pages.
 */
export const splitPdf = async (
  file: Blob,
  pages: number[],
  onProgress: (current: number, total: number) => void
): Promise<Blob[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const resultBlobs: Blob[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i];
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    resultBlobs.push(new Blob([pdfBytes as any], { type: 'application/pdf' }));
    onProgress(i + 1, pages.length);
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }
  return resultBlobs;
};

/**
 * Memory-efficiently converts PDFs to Images and then immediately into a single PDF.
 */
export const flattenPdfs = async (
    files: Blob[],
    onProgress: (current: number, total: number) => void,
    quality: number = 0.95
): Promise<Blob> => {
    const doc = new jsPDF();
    let totalPagesProcessed = 0;
    
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
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (!context) continue;

            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            const imgData = canvas.toDataURL('image/jpeg', quality); 
            
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
            
            canvas.width = 0; 
            canvas.height = 0;
            
            totalPagesProcessed++;
            onProgress(totalPagesProcessed, totalAllPages);
            
            // Yield to main thread
            await new Promise(r => setTimeout(r, 0));
        }
    }
    
    return doc.output('blob');
}

export const rotateImage = async (blob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
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

/**
 * Converts a PDF to a PPTX file with optional text extraction for editing.
 */
export const convertPdfToPptx = async (
    file: Blob,
    onProgress: (current: number, total: number) => void,
    pagesToConvert?: number[],
    isEditable: boolean = false
): Promise<Blob> => {
    // Determine constructor safely: default export or the object itself
    const PptxGen = (PptxGenJSLib as any).default || PptxGenJSLib;
    const pptx = new PptxGen();
    
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjs.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const targetPages = pagesToConvert || Array.from({ length: totalPages }, (_, i) => i + 1);
    const validPages = targetPages.filter(p => p >= 1 && p <= totalPages);

    // DYNAMIC LAYOUT: Set layout based on the first page dimensions
    if (totalPages > 0) {
        const firstPage = await pdf.getPage(1);
        const view1 = firstPage.getViewport({ scale: 1.0 });
        const pdfW = view1.width / 72; // Points to Inches
        const pdfH = view1.height / 72;
        
        pptx.defineLayout({ name: 'PDF_LAYOUT', width: pdfW, height: pdfH });
        pptx.layout = 'PDF_LAYOUT';
    }

    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;

    for (let i = 0; i < validPages.length; i++) {
        try {
            const pageNum = validPages[i];
            const page = await pdf.getPage(pageNum);
            
            // Unscaled viewport (Points)
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            
            // Render high quality background image (scale 2.0)
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            
            canvas = document.createElement('canvas');
            context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (!context) throw new Error('Could not create canvas context');
            
            // White background
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Render full page to canvas
            const renderTask = page.render({
                canvasContext: context,
                viewport: viewport,
            });

            await renderTask.promise;

            let imgData: string | null = canvas.toDataURL('image/jpeg', 0.6);
            const slide = pptx.addSlide();
            
            // Add background image
            slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
            imgData = null;

            // TEXT EXTRACTION & OVERLAY
            if (isEditable) {
                try {
                    const textContent = await page.getTextContent();
                    
                    const items = (textContent.items as any[])
                        .filter(item => item.str && item.str.trim().length > 0)
                        .map(item => ({...item, str: sanitizeText(item.str)}));
                    
                    // Grouping Logic: Aggregate close text items into lines
                    // Sort primarily by Y (descending, because PDF Y is bottom-up), then X
                    items.sort((a, b) => {
                        const yDiff = b.transform[5] - a.transform[5];
                        if (Math.abs(yDiff) < 4) return a.transform[4] - b.transform[4];
                        return yDiff;
                    });

                    const groups = [];
                    let currentGroup: any = null;

                    for (const item of items) {
                        const tx = item.transform[4]; // x
                        const ty = item.transform[5]; // y (baseline)
                        // Font size calculation from transform matrix
                        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
                        const str = item.str;
                        const width = item.width;

                        if (!str.trim()) continue;

                        if (currentGroup) {
                            // Check if on same line (allow small Y variance)
                            const sameLine = Math.abs(currentGroup.ty - ty) < (fontSize * 0.6);
                            // Check X continuity
                            const expectedX = currentGroup.tx + currentGroup.width;
                            const gap = tx - expectedX;
                            // Allow some gap for spacing, but not too far (e.g. 2x font size)
                            const isContinuous = gap > -5 && gap < (fontSize * 3);

                            if (sameLine && isContinuous) {
                                // Add space if gap suggests it
                                const spacer = (gap > (fontSize * 0.2) && !currentGroup.text.endsWith(' ') && !str.startsWith(' ')) ? ' ' : '';
                                currentGroup.text += spacer + str;
                                currentGroup.width += gap + width;
                                continue;
                            }
                        }

                        if (currentGroup) groups.push(currentGroup);
                        
                        currentGroup = {
                            text: str,
                            tx: tx,
                            ty: ty,
                            width: width,
                            fontSize: fontSize
                        };
                    }
                    if (currentGroup) groups.push(currentGroup);

                    // Render Text Boxes
                    groups.forEach(g => {
                        // Coordinates:
                        // PDF: Bottom-Left origin. Units: Points.
                        // PPTX: Top-Left origin. Units: Inches.
                        
                        // X conversion
                        const xInch = g.tx / 72;
                        
                        // Y conversion
                        // PDF Y is baseline from bottom.
                        // PPTX Y is Top-Left box corner from top.
                        // Page Height in points: unscaledViewport.height
                        // Top-Left Y in points = (PageHeight - PDF_Y) - FontAscent
                        // We approximate FontAscent as fontSize for the box top.
                        
                        // Using viewport utility to flip Y safely:
                        // convertToViewportPoint(x, y) returns [x, y] from Top-Left.
                        // However, input y is PDF y (bottom-up).
                        const [vx, vy] = unscaledViewport.convertToViewportPoint(g.tx, g.ty);
                        
                        // vy is the Y position of the BASELINE relative to Top.
                        // We need Top of the box. 
                        const yInch = (vy - g.fontSize) / 72; 
                        const wInch = g.width / 72;
                        
                        // Adding "White-out" (solid white background) to the text box
                        // to cover the baked-in text from the background image.
                        slide.addText(g.text, {
                            x: Math.max(0, xInch),
                            y: Math.max(0, yInch),
                            w: wInch + 0.3, // Extra buffer width to prevent wrapping
                            h: (g.fontSize * 1.2) / 72, // Height buffer
                            fontSize: Math.max(8, g.fontSize),
                            color: '000000',
                            fill: { color: 'FFFFFF' }, // Vital: Covers the underlying image text
                            fontFace: 'Arial',
                            margin: 0,
                            valign: 'top',
                            autoFit: false,
                            wrap: false // Keep single lines separate for better layout preservation
                        });
                    });

                } catch (e) {
                    console.warn("Text extraction failed for page " + pageNum, e);
                }
            }
        } catch (pageError) {
            console.error(`Page ${validPages[i]} failed to render`, pageError);
            const errSlide = pptx.addSlide();
            errSlide.addText(`Error on Page ${validPages[i]}`, { x: 0.5, y: 0.5 });
        } finally {
            if (canvas) { canvas.width = 1; canvas.height = 1; }
            context = null;
            onProgress(i + 1, validPages.length);
            await new Promise(r => setTimeout(r, 50));
        }
    }

    const blob = await pptx.write({ outputType: 'blob' }) as Blob;
    return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
};

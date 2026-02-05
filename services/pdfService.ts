import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { PDFDocument, PDFPage } from 'pdf-lib';
import * as PptxGenJSLib from 'pptxgenjs';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { PptxSlide, PptxElement } from '../types';

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;
const PDFJS_VERSION = '3.11.174';

if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
}

const sanitizeText = (str: string): string => {
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
};

// Helper to enforce timeout on promises
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
    ]);
};

// Helper to crop image from canvas
const cropImageFromCanvas = (
    sourceCanvas: HTMLCanvasElement, 
    x: number, y: number, w: number, h: number
): string => {
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.min(Math.floor(w), sourceCanvas.width - sx);
    const sh = Math.min(Math.floor(h), sourceCanvas.height - sy);

    if (sw <= 0 || sh <= 0) return '';

    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = sw;
    hiddenCanvas.height = sh;
    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return hiddenCanvas.toDataURL('image/png'); 
};

/**
 * Phase 1: Analyze PDF and return editable Slide Data
 */
export const analyzePdfToPptxData = async (
    file: Blob,
    onProgress: (current: number, total: number, status?: string) => void,
    isAiEnabled: boolean = true,
    onSlideAvailable?: (slide: PptxSlide) => void // New Callback for Streaming
): Promise<PptxSlide[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const slides: PptxSlide[] = [];

    for (let i = 1; i <= totalPages; i++) {
        onProgress(i, totalPages, isAiEnabled ? `AI 분석 중 (${i}/${totalPages})...` : `렌더링 중 (${i}/${totalPages})...`);
        
        try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (!context) continue;
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;

            const base64FullPage = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            const slideData: PptxSlide = {
                id: `slide-${i}`,
                pageNumber: i,
                backgroundImage: `data:image/jpeg;base64,${base64FullPage}`,
                elements: [],
                width: viewport.width,
                height: viewport.height
            };

            if (isAiEnabled) {
                try {
                    // Optimized prompt for strict text extraction with Korean support
                    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: [
                            {
                                parts: [
                                    { inlineData: { mimeType: 'image/jpeg', data: base64FullPage } },
                                    { text: "Analyze this presentation slide. Extract ALL visible text, especially Korean (Hangul) characters. Identify layout elements with precise bounding boxes." }
                                ]
                            }
                        ],
                        config: {
                            systemInstruction: `
                            You are a high-precision OCR and Slide Layout Analyzer.
                            
                            **CORE MISSION:**
                            Reconstruct this slide into structured data. You must extract text exactly as it appears.
                            
                            **CRITICAL INSTRUCTIONS FOR KOREAN (HANGUL):**
                            1. **Korean Text Priority:** This document likely contains Korean. Detect it even if the font is stylized, bold, or has shadows.
                            2. **Exact Transcription:** Return the Hangul characters exactly. Do not translate.
                            3. **Do NOT Ignore Large Text:** Large headers or titles are often mistaken for images. You MUST classify them as "text" and extract the content.
                            
                            **CLASSIFICATION RULES:**
                            - **"text"**: Any element containing readable letters, numbers, or characters. This includes headers, body text, lists, and text inside buttons/shapes.
                            - **"image"**: Only photographs, icons, or complex data visualizations (charts) that cannot be represented as text.
                            
                            **BOUNDING BOXES (box_2d):**
                            - Returns [ymin, xmin, ymax, xmax] integers on a 0-1000 scale.
                            - **Tight Fit:** The box should hug the text or image closely. Do not include excessive whitespace.
                            - **Separation:** Detect separate text blocks (e.g., title vs subtitle) as separate elements.

                            **ATTRIBUTES:**
                            - fontSize: Estimate size in points (e.g. Title=40, Body=18).
                            - color: Dominant hex color (e.g. #000000).

                            Output valid JSON matching the schema provided.
                            `,
                            responseMimeType: 'application/json',
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    elements: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                type: { type: Type.STRING, enum: ["text", "image"] },
                                                content: { type: Type.STRING },
                                                box_2d: { 
                                                    type: Type.ARRAY,
                                                    items: { type: Type.NUMBER }
                                                },
                                                fontSize: { type: Type.NUMBER, description: "Estimated font size in points (e.g. 12, 24)" },
                                                color: { type: Type.STRING, description: "Hex color code e.g. #000000" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }), 45000);

                    const data = JSON.parse(response.text || '{"elements":[]}');
                    
                    data.elements?.forEach((el: any, idx: number) => {
                        const [ymin, xmin, ymax, xmax] = el.box_2d || [0,0,0,0];
                        
                        // Percentage coordinates (0-100)
                        const perX = (xmin / 1000) * 100;
                        const perY = (ymin / 1000) * 100;
                        const perW = ((xmax - xmin) / 1000) * 100;
                        const perH = ((ymax - ymin) / 1000) * 100;
                        
                        // Pixel coordinates for cropping
                        const x = (xmin / 1000) * canvas.width;
                        const y = (ymin / 1000) * canvas.height;
                        const w = ((xmax - xmin) / 1000) * canvas.width;
                        const h = ((ymax - ymin) / 1000) * canvas.height;

                        if (el.type === 'image') {
                             if (w > 10 && h > 10) {
                                const croppedData = cropImageFromCanvas(canvas, x, y, w, h);
                                if (croppedData) {
                                    slideData.elements.push({
                                        id: `el-${i}-${idx}`,
                                        type: 'image',
                                        image: croppedData,
                                        x: perX, y: perY, w: perW, h: perH
                                    });
                                }
                            }
                        } else if (el.type === 'text' && el.content) {
                            slideData.elements.push({
                                id: `el-${i}-${idx}`,
                                type: 'text',
                                content: sanitizeText(el.content),
                                x: perX, y: perY, w: perW, h: perH,
                                style: {
                                    fontSize: el.fontSize || 12,
                                    color: el.color || '#000000',
                                    align: 'left' // Default to left
                                }
                            });
                        }
                    });

                } catch (err) {
                    console.warn(`Page ${i} AI Analysis failed:`, err);
                }
            }

            slides.push(slideData);
            
            // Streaming: Emit the slide immediately
            if (onSlideAvailable) {
                onSlideAvailable(slideData);
            }
            
            // Clean up
            canvas.width = 1; 
            canvas.height = 1;

        } catch (pageErr) {
            console.error(`Error processing page ${i}:`, pageErr);
        }
        
        await new Promise(r => setTimeout(r, 50));
    }

    return slides;
};

/**
 * Phase 2: Generate PPTX Blob from Slide Data
 */
export const generatePptxFromData = async (
    slides: PptxSlide[],
    onProgress: (current: number, total: number, status?: string) => void
): Promise<Blob> => {
    const PptxGen = (PptxGenJSLib as any).default || PptxGenJSLib;
    const pptx = new PptxGen();

    // Determine layout from first slide
    let slideW_in = 10;
    let slideH_in = 5.625;

    if (slides.length > 0) {
        const firstSlide = slides[0];
        // PDF points are usually 72 DPI. Our viewport was scale 2.0.
        // So pixels = points * 2. 
        // Inches = points / 72 = (pixels / 2) / 72 = pixels / 144.
        if (firstSlide.width && firstSlide.height) {
            slideW_in = firstSlide.width / 144;
            slideH_in = firstSlide.height / 144;
            
            // Define custom layout matching the source PDF aspect ratio
            pptx.defineLayout({ name: 'CUSTOM', width: slideW_in, height: slideH_in });
            pptx.layout = 'CUSTOM';
        } else {
            pptx.layout = 'LAYOUT_16x9'; 
        }
    }

    slides.forEach((slideData, idx) => {
        onProgress(idx + 1, slides.length, 'PPTX 생성 중...');
        const slide = pptx.addSlide();

        // 1. Background Image (Always present)
        slide.addImage({ 
            data: slideData.backgroundImage, 
            x: 0, y: 0, w: '100%', h: '100%' 
        });

        // Sort elements: Images first, then Text
        const sortedElements = [...slideData.elements].sort((a, b) => (a.type === 'image' ? -1 : 1));

        sortedElements.forEach(el => {
            const x = (el.x / 100) * slideW_in;
            const y = (el.y / 100) * slideH_in;
            const w = (el.w / 100) * slideW_in;
            const h = (el.h / 100) * slideH_in;

            if (el.type === 'image' && el.image) {
                slide.addImage({
                    data: el.image,
                    x: x, y: y, w: w, h: h
                });
            } else if (el.type === 'text' && el.content) {
                slide.addText(el.content, {
                    x: x, y: y, w: w, h: Math.max(h, 0.3),
                    fontSize: el.style?.fontSize || 12,
                    color: el.style?.color?.replace('#', '') || '000000',
                    fill: { color: 'FFFFFF' }, // Text box needs white background to cover original text
                    align: el.style?.align || 'left',
                    fontFace: 'Arial',
                    valign: 'top'
                });
            }
        });
    });

    return await pptx.write({ outputType: 'blob' }) as Blob;
};

// ... keep existing functions ...
export const getPdfPageCount = async (file: Blob): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  // FIXED: Use the configured 'pdfjs' object instead of raw 'pdfjsLib' to ensure worker is loaded
  const loadingTask = pdfjs.getDocument({ 
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true, 
  });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
};

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
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const targetPages = pagesToConvert || Array.from({ length: totalPages }, (_, i) => i + 1);
  const imageBlobs: Blob[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i];
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, format, quality));
        if (blob) imageBlobs.push(blob);
    }
    onProgress(i + 1, targetPages.length);
    await new Promise(r => setTimeout(r, 0));
  }
  return imageBlobs;
};

export const convertImagesToPdf = async (files: Blob[], onProgress: (c: number, t: number) => void): Promise<Blob> => {
  const doc = new jsPDF();
  for (let i = 0; i < files.length; i++) {
    const imgData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(files[i]);
    });
    if (i > 0) doc.addPage();
    const pdfW = doc.internal.pageSize.getWidth();
    const pdfH = doc.internal.pageSize.getHeight();
    doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    onProgress(i + 1, files.length);
  }
  return doc.output('blob');
};

export const mergePdfs = async (files: Blob[], onProgress: (c: number, t: number) => void): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const pdf = await PDFDocument.load(await files[i].arrayBuffer());
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(p => mergedPdf.addPage(p));
    onProgress(i + 1, files.length);
  }
  return new Blob([await mergedPdf.save()], { type: 'application/pdf' });
};

export const splitPdf = async (file: Blob, pages: number[], onProgress: (c: number, t: number) => void): Promise<Blob[]> => {
  const srcPdf = await PDFDocument.load(await file.arrayBuffer());
  const results: Blob[] = [];
  for (let i = 0; i < pages.length; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(srcPdf, [pages[i] - 1]);
    newPdf.addPage(page);
    results.push(new Blob([await newPdf.save()], { type: 'application/pdf' }));
    onProgress(i + 1, pages.length);
  }
  return results;
};

export const flattenPdfs = async (files: Blob[], onProgress: (c: number, t: number) => void): Promise<Blob> => {
    const images: Blob[] = [];
    for(const f of files) {
        const pageImgs = await convertPdfToImages(f, () => {});
        images.push(...pageImgs);
    }
    return convertImagesToPdf(images, onProgress);
};

export const rotateImage = async (blob: Blob): Promise<Blob> => {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await new Promise(r => img.onload = r);
  const canvas = document.createElement('canvas');
  canvas.width = img.height; canvas.height = img.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return new Promise(r => canvas.toBlob(b => r(b || blob), blob.type));
};

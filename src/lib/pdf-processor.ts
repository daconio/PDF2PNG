import type { PDFDocumentProxy } from 'pdfjs-dist';

// Helper to load pdfjs-dist dynamically
const getPdfJs = async () => {
    // @ts-ignore
    const pdfjs = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
        // Handle basePath for GitHub Pages or other subpath deployments
        const basePath = (window as any).__NEXT_DATA__?.basePath || '';
        pdfjs.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
    }
    return pdfjs;
};

export const loadPDF = async (file: File): Promise<PDFDocumentProxy> => {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    return loadingTask.promise;
};

export const renderPageToBlob = async (
    pdf: PDFDocumentProxy,
    pageNumber: number
): Promise<Blob | null> => {
    const page = await pdf.getPage(pageNumber);

    // Scale 2.0 provides good quality for PNGs
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return null;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport: viewport,
    };

    // @ts-ignore - Types might be mismatched for RenderParameters
    await page.render(renderContext).promise;

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};

export const imagesToPDF = async (files: File[]): Promise<Blob> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });

        // Add a new page if it's not the first one
        if (i > 0) {
            doc.addPage();
        }

        // Get page dimensions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Find image dimensions to maintain aspect ratio
        const img = new Image();
        img.src = imageData;
        await new Promise((resolve) => {
            img.onload = resolve;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;
        const ratio = imgWidth / imgHeight;

        let finalWidth = pageWidth;
        let finalHeight = pageWidth / ratio;

        if (finalHeight > pageHeight) {
            finalHeight = pageHeight;
            finalWidth = pageHeight * ratio;
        }

        // Center on page
        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;

        doc.addImage(imageData, 'PNG', x, y, finalWidth, finalHeight);
    }

    return doc.output('blob');
};


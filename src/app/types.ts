import React from 'react';

export enum ConversionMode {
    PDF_TO_PNG = 'PDF_TO_PNG',
    PNG_TO_PDF = 'PNG_TO_PDF',
}

export enum ProcessStatus {
    IDLE = 'IDLE',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

export interface FileItem {
    id: string;
    file: File;
    previewUrl?: string;
    status: ProcessStatus;
    progress: number; // 0 to 100
    outputFiles?: Blob[]; // For PDF to PNG
    outputPdf?: Blob;     // For PNG to PDF
}

export interface PipelineStep {
    id: string;
    label: string;
    icon: React.ElementType;
    status: 'pending' | 'active' | 'completed';
}

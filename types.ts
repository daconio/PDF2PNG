import React from 'react';

export enum ConversionMode {
  PDF_TO_PNG = 'PDF_TO_PNG',
  PNG_TO_PDF = 'PNG_TO_PDF',
  MERGE_PDF = 'MERGE_PDF',
  FLATTEN_PDF = 'FLATTEN_PDF',
  SPLIT_PDF = 'SPLIT_PDF',
  PDF_TO_PPTX = 'PDF_TO_PPTX',
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  ANALYZING_PPTX = 'ANALYZING_PPTX', // New status for AI analysis phase
  EDITING_PPTX = 'EDITING_PPTX',     // New status for Editor phase
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
  errorMessage?: string;
  estimatedRemaining?: number; // Seconds remaining
}

export interface PipelineStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'completed';
}

// New Types for PPTX Editor
export interface PptxElement {
  id: string;
  type: 'text' | 'image';
  content?: string; // for text
  image?: string; // base64 for image element
  x: number; // percentage 0-100 relative to slide width
  y: number; // percentage 0-100 relative to slide height
  w: number; // percentage 0-100
  h: number; // percentage 0-100
  style?: {
    fontSize?: number; // approx pt
    color?: string; // hex
    bg?: string; // hex
    isBold?: boolean;
    align?: 'left' | 'center' | 'right';
  };
}

export interface PptxSlide {
  id: string;
  pageNumber: number;
  backgroundImage: string; // base64 (The original full page)
  elements: PptxElement[];
  width: number; // points
  height: number; // points
}

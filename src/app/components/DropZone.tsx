import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType } from 'lucide-react';
import { ConversionMode } from '../types';

interface DropZoneProps {
    mode: ConversionMode;
    onFilesDropped: (files: File[]) => void;
    disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ mode, onFilesDropped, disabled }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        onFilesDropped(acceptedFiles);
    }, [onFilesDropped]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled,
        accept: mode === ConversionMode.PDF_TO_PNG
            ? { 'application/pdf': ['.pdf'] }
            : { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        multiple: mode === ConversionMode.PNG_TO_PDF,
    });

    return (
        <div
            {...getRootProps()}
            className={`
        border-4 border-dashed border-black bg-white p-12 text-center cursor-pointer transition-all
        hover:bg-gray-50 flex flex-col items-center justify-center h-64
        ${isDragActive ? 'bg-blue-50 border-primary' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            <input {...getInputProps()} />
            <div className="bg-accent p-4 rounded-full border-2 border-black mb-4">
                {isDragActive ? <FileType className="w-10 h-10 animate-bounce" /> : <UploadCloud className="w-10 h-10" />}
            </div>

            <h3 className="text-xl font-bold mb-2">
                {isDragActive ? 'Drop it like it\'s hot!' : 'Drag & Drop files here'}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto">
                {mode === ConversionMode.PDF_TO_PNG
                    ? 'Upload a single PDF to extract pages as images.'
                    : 'Upload multiple images to merge into a single PDF.'}
            </p>
            <span className="mt-4 inline-block bg-black text-white px-3 py-1 text-sm font-bold">
                BROWSE FILES
            </span>
        </div>
    );
};

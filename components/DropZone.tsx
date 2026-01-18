import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType } from 'lucide-react';
import { ConversionMode } from '../types';

interface DropZoneProps {
  mode: ConversionMode;
  onFilesDropped: (files: File[]) => void;
  disabled?: boolean;
  translations: {
    dropTitle: string;
    dropDesc: string;
    browse: string;
  };
}

export const DropZone: React.FC<DropZoneProps> = ({ mode, onFilesDropped, disabled, translations }) => {
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
        relative border-2 border-dashed border-black rounded-xl p-12 text-center cursor-pointer transition-all duration-200
        flex flex-col items-center justify-center min-h-[400px] group bg-white
        ${isDragActive 
          ? 'bg-[#e0e7ff] border-solid shadow-neo' 
          : 'hover:bg-gray-50 hover:shadow-neo'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className={`
        w-24 h-24 rounded-xl border-2 border-black flex items-center justify-center mb-6 transition-all duration-200
        ${isDragActive ? 'bg-primary shadow-neo-sm rotate-3' : 'bg-[#fff59d] shadow-neo group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:shadow-neo-lg'}
      `}>
        {isDragActive ? <FileType className="w-12 h-12 text-black animate-bounce" /> : <UploadCloud className="w-12 h-12 text-black" />}
      </div>
      
      <h3 className="text-2xl font-bold text-black mb-3 uppercase tracking-tight">
        {isDragActive ? 'Drop it here!' : translations.dropTitle}
      </h3>
      <p className="text-gray-600 font-medium max-w-sm mx-auto mb-8 leading-relaxed">
        {translations.dropDesc}
      </p>
      
      <div className="bg-black text-white px-8 py-3 rounded-lg text-sm font-bold shadow-neo border-2 border-black transition-all group-hover:bg-primary group-hover:text-black">
        {translations.browse}
      </div>
    </div>
  );
};
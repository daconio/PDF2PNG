import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Eye, Trash2, Download, GripVertical } from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

interface SortableFileCardProps {
  id: string;
  file: {
    name: string;
    url: string;
    blob: Blob;
  };
  isActive?: boolean; // Is currently being viewed
  onPreview: () => void;
  onDelete: () => void;
  onDownload: () => void;
  translations?: {
    delete: string;
    download: string;
  };
}

export const SortableFileCard: React.FC<SortableFileCardProps> = ({
  id,
  file,
  isActive,
  onPreview,
  onDelete,
  onDownload,
  translations
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 border-black rounded-lg bg-white overflow-hidden transition-all hover:shadow-neo ${
        isActive ? 'bg-blue-50 ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
        {/* Drag Handle */}
        <div 
            {...attributes} 
            {...listeners}
            className="absolute top-2 left-2 z-20 p-1.5 bg-white/80 backdrop-blur border border-black rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        >
            <GripVertical size={16} />
        </div>

      <div 
        onClick={onPreview}
        className="aspect-square bg-gray-100 flex items-center justify-center relative border-b-2 border-black cursor-pointer"
      >
        {file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') ? (
          <img src={file.url} alt="Thumbnail" className="w-full h-full object-cover" />
        ) : (
          <FileText size={32} className="text-gray-400" />
        )}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <Eye size={24} className="text-white drop-shadow-md" />
        </div>
      </div>
      
      <div className="p-2 space-y-2">
        <div className="truncate">
          <p className="text-xs font-bold text-black truncate">{file.name}</p>
          <p className="text-[10px] text-gray-600 font-mono">{(file.blob.size / 1024).toFixed(0)} KB</p>
        </div>
        <div className="flex gap-1">
          <Tooltip content={translations?.delete || "Delete"} className="flex-1">
            <button
              className="w-full flex items-center justify-center bg-[#fca5a5] border border-black rounded py-1 hover:bg-[#f87171] transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 size={12} className="text-black" />
            </button>
          </Tooltip>
          
          <Tooltip content={translations?.download || "Download"} className="flex-1">
            <button
              className="w-full flex items-center justify-center bg-white border border-black rounded py-1 hover:bg-gray-50 transition-colors"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
            >
              <Download size={12} className="text-black" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// Simple Overlay component for the item while dragging
export const FileCardOverlay: React.FC<Omit<SortableFileCardProps, 'onPreview' | 'onDelete' | 'onDownload'>> = ({ file }) => {
  return (
    <div className="border-2 border-black rounded-lg bg-white overflow-hidden shadow-neo-lg scale-105 cursor-grabbing">
      <div className="aspect-square bg-gray-100 flex items-center justify-center relative border-b-2 border-black">
        {(file.name.endsWith('.png') || file.name.endsWith('.jpg')) ? (
          <img src={file.url} alt="Thumbnail" className="w-full h-full object-cover" />
        ) : (
          <FileText size={32} className="text-gray-400" />
        )}
      </div>
      <div className="p-2 space-y-2">
        <div className="truncate">
          <p className="text-xs font-bold text-black truncate">{file.name}</p>
        </div>
      </div>
    </div>
  );
};
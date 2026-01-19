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

// Robust image check: checks blob type or file extension (case-insensitive)
const isImageFile = (file: { name: string; blob: Blob }) => {
  if (file.blob && file.blob.type && file.blob.type !== 'application/octet-stream') {
     return file.blob.type.startsWith('image/');
  }
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);
};

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

  const showThumbnail = isImageFile(file);

  const handleAction = (e: React.MouseEvent | React.PointerEvent, action: () => void) => {
    e.stopPropagation();
    // Prevent dnd-kit from catching this event
    e.preventDefault();
    action();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 border-black rounded-lg bg-white overflow-hidden transition-all duration-300 hover:shadow-neo-lg ${
        isActive ? 'bg-blue-50 ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      {/* 
         DRAG HANDLE 
         Listeners are applied only here to separate "Dragging" from "Clicking to Preview".
         Touch action none is required for touch devices.
      */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 backdrop-blur border border-black rounded text-black cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors shadow-sm touch-none"
        title="Drag to reorder"
      >
          <GripVertical size={16} />
      </div>

      <div 
        onClick={onPreview}
        className="aspect-square bg-gray-100 flex items-center justify-center relative border-b-2 border-black overflow-hidden cursor-pointer"
      >
        {showThumbnail ? (
          <img src={file.url} alt={file.name} className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <FileText size={32} className="text-gray-400 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary" />
        )}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none backdrop-blur-[1px]">
          <Eye size={24} className="text-white drop-shadow-md transform scale-50 group-hover:scale-100 transition-transform duration-200" />
        </div>
      </div>
      
      {/* Footer Area */}
      <div className="p-2 space-y-2 cursor-default bg-white relative z-10" onPointerDown={(e) => e.stopPropagation()}>
        <div className="truncate">
          <p className="text-xs font-bold text-black truncate select-none transition-colors group-hover:text-primary" title={file.name}>{file.name}</p>
          <p className="text-[10px] text-gray-600 font-mono select-none">{(file.blob.size / 1024).toFixed(0)} KB</p>
        </div>
        <div className="flex gap-1">
          <Tooltip content={translations?.delete || "Delete"} className="flex-1">
            <button
              className="w-full flex items-center justify-center bg-[#fca5a5] border border-black rounded py-1 hover:bg-[#f87171] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
              onClick={(e) => handleAction(e, onDelete)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Trash2 size={12} className="text-black" />
            </button>
          </Tooltip>
          
          <Tooltip content={translations?.download || "Download"} className="flex-1">
            <button
              className="w-full flex items-center justify-center bg-white border border-black rounded py-1 hover:bg-gray-50 transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
              onClick={(e) => handleAction(e, onDownload)}
              onPointerDown={(e) => e.stopPropagation()}
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
  const showThumbnail = isImageFile(file);
  
  return (
    <div className="border-2 border-black rounded-lg bg-white overflow-hidden shadow-neo-lg scale-110 cursor-grabbing rotate-3 transition-transform">
      <div className="aspect-square bg-gray-100 flex items-center justify-center relative border-b-2 border-black overflow-hidden">
        {showThumbnail ? (
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
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
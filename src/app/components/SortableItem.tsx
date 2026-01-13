
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem({ id, file }: { id: string, file: File }) {
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
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="aspect-square bg-white border-[3px] border-black p-2 relative group cursor-move touch-none shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] transition-all">
            <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-full h-full object-cover border border-black pointer-events-none"
                onLoad={(e) => URL.revokeObjectURL((e.target as any).src)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                <p className="text-xs font-bold text-white bg-black/80 px-2 py-1 truncate max-w-[90%] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">{file.name}</p>
            </div>
        </div>
    );
}

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ElementType;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon: Icon }) => {
  return (
    <div className={`bg-white border-2 border-black rounded-xl shadow-neo p-6 flex flex-col h-full ${className}`}>
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-black/10">
          {Icon && (
            <div className="p-2.5 bg-primary border-2 border-black rounded-lg shadow-neo-sm">
              <Icon className="w-5 h-5 text-black" />
            </div>
          )}
          {title && <h3 className="text-xl font-bold text-black uppercase tracking-tight">{title}</h3>}
        </div>
      )}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
};
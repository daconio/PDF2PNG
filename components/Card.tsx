import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon: Icon, action }) => {
  return (
    <div className={`bg-white border-2 border-black rounded-xl shadow-neo p-6 flex flex-col h-full ${className}`}>
      {(title || Icon || action) && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-black/10">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2.5 bg-primary border-2 border-black rounded-lg shadow-neo-sm">
                <Icon className="w-5 h-5 text-black" />
              </div>
            )}
            {title && <h3 className="text-xl font-bold text-black uppercase tracking-tight">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
};
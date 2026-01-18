import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    icon?: React.ElementType;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon: Icon }) => {
    return (
        <div className={`bg-white border-2 border-black shadow-neo p-6 flex flex-col h-full ${className}`}>
            {(title || Icon) && (
                <div className="flex items-center gap-3 mb-4">
                    {Icon && (
                        <div className="p-2 bg-accent rounded-full border border-black">
                            <Icon className="w-6 h-6 text-black" />
                        </div>
                    )}
                    {title && <h3 className="text-xl font-bold">{title}</h3>}
                </div>
            )}
            {children}
        </div>
    );
};

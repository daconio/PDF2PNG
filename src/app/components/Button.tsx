import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}) => {
    const baseStyles = "font-bold border-2 border-black transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-primary text-white shadow-neo hover:bg-blue-600",
        secondary: "bg-white text-black shadow-neo hover:bg-gray-50", // Modified 'surface' to 'white' to match globals.css likely or just use white
        outline: "bg-transparent text-black border-2 border-black hover:bg-black/5",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

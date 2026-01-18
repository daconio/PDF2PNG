import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 border-2 border-black rounded-lg active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-black hover:bg-primary-hover shadow-neo",
    secondary: "bg-white text-black hover:bg-gray-50 shadow-neo",
    outline: "bg-transparent text-black border-2 border-black hover:bg-gray-100 shadow-neo",
    ghost: "bg-transparent text-black border-transparent shadow-none hover:bg-gray-100 active:translate-x-0 active:translate-y-0",
    danger: "bg-[#fca5a5] text-black hover:bg-[#f87171] shadow-neo",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  // Ghost variant overrides for border/shadow
  const finalClassName = variant === 'ghost' 
    ? `inline-flex items-center justify-center gap-2 font-bold transition-colors duration-200 rounded-lg ${sizes[size]} ${variants[variant]} ${className}`
    : `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      className={finalClassName}
      {...props}
    >
      {children}
    </button>
  );
};
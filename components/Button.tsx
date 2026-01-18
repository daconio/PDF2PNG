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
  // Base: Bold font, transitions, border.
  // Hover: Lift up (-translate) and increase shadow size (shadow-neo-lg).
  // Active: Press down (+translate) and remove shadow.
  const baseStyles = "group inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 border-2 border-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-neo-lg active:shadow-none active:translate-x-[4px] active:translate-y-[4px]";
  
  const variants = {
    primary: "bg-primary text-black hover:bg-primary-hover shadow-neo",
    secondary: "bg-white text-black hover:bg-gray-50 shadow-neo",
    outline: "bg-transparent text-black border-2 border-black hover:bg-gray-100 shadow-neo",
    ghost: "bg-transparent text-black border-transparent shadow-none hover:bg-gray-100 hover:shadow-none hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0",
    danger: "bg-[#fca5a5] text-black hover:bg-[#f87171] shadow-neo",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  // Ghost variant overrides for border/shadow logic
  const finalClassName = variant === 'ghost' 
    ? `inline-flex items-center justify-center gap-2 font-bold transition-colors duration-200 rounded-lg ${sizes[size]} ${variants[variant]} ${className}`
    : `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      className={finalClassName}
      {...props}
    >
      {/* Wrap children to apply icon animations if needed */}
      <span className="flex items-center gap-2 group-hover:[&>svg]:animate-wiggle">
        {children}
      </span>
    </button>
  );
};
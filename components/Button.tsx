import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-syko-black text-syko-white dark:bg-syko-white dark:text-syko-black hover:opacity-80",
    ghost: "text-syko-black dark:text-syko-white hover:bg-black/5 dark:hover:bg-white/10",
    danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
    outline: "border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
};

import React from 'react';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactElement;
}

const Button: React.FC<ButtonProps> = ({
  children,
  isLoading = false,
  variant = 'primary',
  icon,
  className = '',
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center px-6 py-3 text-base font-bold rounded-full focus:outline-none focus:ring-4 focus:ring-offset-2 transition-all duration-300 ease-out transform active:scale-95 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  
  const variantClasses = {
    primary: 'text-white bg-rose-400 hover:bg-rose-500 focus:ring-rose-200 shadow-lg shadow-rose-200 border-2 border-transparent',
    secondary: 'text-rose-500 bg-white hover:bg-rose-50 focus:ring-rose-100 border-2 border-rose-100 shadow-sm',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Spinner size="sm" className={variant === 'primary' ? 'text-white' : 'text-rose-400'} />
      ) : (
        <>
            {icon && <span className="mr-2 -ml-1">{icon}</span>}
            {children}
        </>
      )}
    </button>
  );
};

export default Button;

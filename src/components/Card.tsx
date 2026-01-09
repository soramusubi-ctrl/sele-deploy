
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-100 p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
};

export default Card;

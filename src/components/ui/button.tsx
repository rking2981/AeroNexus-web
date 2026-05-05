import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'w-full rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2',
        variant === 'primary' && 'bg-[#00D1FF] text-black hover:brightness-110 disabled:opacity-50',
        variant === 'ghost' && 'text-gray-400 hover:text-white',
        variant === 'outline' && 'border border-white/20 text-white hover:bg-white/5 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}

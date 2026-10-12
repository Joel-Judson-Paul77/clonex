'use client';
import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FlowButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Label text (or pass children). */
  text?: string;
  children?: ReactNode;
  /** "md" is the original size; "sm" fits next to a text field. */
  size?: 'sm' | 'md';
}

// Arrows slide across and a filled circle expands on hover. Colours are inverted from the original
// (which assumed a light page): white outline and a white fill on hover, to match the dark monochrome theme.
export function FlowButton({ text = 'Modern Button', children, size = 'md', className = '', type = 'button', ...props }: FlowButtonProps) {
  const pad = size === 'sm' ? 'px-7 py-2.5' : 'px-8 py-3';
  return (
    <button
      type={type}
      {...props}
      className={`group relative flex items-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] border-white/20 bg-transparent ${pad} text-sm font-semibold whitespace-nowrap text-white cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-transparent hover:text-black hover:rounded-[12px] active:scale-[0.95] focus-visible:rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {/* Left arrow (arr-2) */}
      <ArrowRight
        aria-hidden="true"
        className="absolute w-4 h-4 left-[-25%] stroke-white fill-none z-[9] group-hover:left-4 group-hover:stroke-black transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      />

      {/* Text */}
      <span className="relative z-[1] -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out">
        {children ?? text}
      </span>

      {/* Circle */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-[50%] opacity-0 group-hover:w-[220px] group-hover:h-[220px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]"
      ></span>

      {/* Right arrow (arr-1) */}
      <ArrowRight
        aria-hidden="true"
        className="absolute w-4 h-4 right-4 stroke-white fill-none z-[9] group-hover:right-[-25%] group-hover:stroke-black transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      />
    </button>
  );
}

export default FlowButton;

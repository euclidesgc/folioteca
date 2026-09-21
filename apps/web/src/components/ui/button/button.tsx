import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';

import { cn } from '@/utils/cn';

export const buttonVariants = cva(
  'inline-flex h-10 items-center justify-center gap-2 px-4 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600',
        secondary:
          'border border-gray-300 text-gray-900 hover:bg-gray-50 focus-visible:outline-blue-600',
        ghost:
          'text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
      },
      // The default size is the one already in the base classes (`h-10 px-4`),
      // so `md` adds nothing and every existing button keeps its exact
      // classes; `icon` overrides both, giving a 40px square with no
      // horizontal breathing room around a single icon.
      size: {
        md: '',
        icon: 'size-10 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean;
  };

export const Button = ({
  className,
  variant,
  size,
  type = 'button',
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element => {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {children}
    </button>
  );
};

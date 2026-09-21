import type React from 'react';
import { useId } from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';

import { cn } from '@/utils/cn';

import {
  FieldWrapper,
  type FieldWrapperPassThroughProps,
  getFieldA11yProps,
} from './field-wrapper';

export type InputProps = Omit<React.ComponentProps<'input'>, 'id'> &
  FieldWrapperPassThroughProps & {
    registration: Partial<UseFormRegisterReturn>;
  };

export const Input = ({
  label,
  error,
  description,
  registration,
  className,
  type = 'text',
  ...props
}: InputProps): React.JSX.Element => {
  const id = useId();

  return (
    <FieldWrapper id={id} label={label} error={error} description={description}>
      <input
        type={type}
        className={cn(
          'mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 aria-[invalid=true]:border-red-500',
          className,
        )}
        {...props}
        {...getFieldA11yProps(id, error, description)}
        // registration carries name, onChange, onBlur and the ref RHF uses to focus the first invalid field
        {...registration}
      />
    </FieldWrapper>
  );
};

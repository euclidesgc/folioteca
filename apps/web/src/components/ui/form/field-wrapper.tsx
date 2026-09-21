import type React from 'react';
import { type FieldError } from 'react-hook-form';

type FieldWrapperProps = {
  // same id given to the control; comes from useId() in the field component
  id: string;
  label: string;
  error?: FieldError;
  description?: string;
  children: React.ReactNode;
};

export type FieldWrapperPassThroughProps = Omit<
  FieldWrapperProps,
  'id' | 'children'
>;

// spread on the control (<input>, <select>, <textarea>) so label, description
// and error are linked to it
export const getFieldA11yProps = (
  id: string,
  error?: FieldError,
  description?: string,
) => {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
};

export const FieldWrapper = ({
  id,
  label,
  error,
  description,
  children,
}: FieldWrapperProps): React.JSX.Element => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      {children}
      {description ? (
        <p id={`${id}-description`} className="mt-1 text-sm text-gray-600">
          {description}
        </p>
      ) : null}
      {error?.message ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}
    </div>
  );
};

import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import {
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
  useForm,
} from 'react-hook-form';
import { type z } from 'zod';

import { cn } from '@/utils/cn';

type FormProps<TFormValues extends FieldValues> = {
  schema: z.ZodType<TFormValues, TFormValues>;
  // receives the form too, so the caller can reset it after a successful mutation
  onSubmit: (values: TFormValues, form: UseFormReturn<TFormValues>) => void;
  options?: UseFormProps<TFormValues>;
  children: (form: UseFormReturn<TFormValues>) => React.ReactNode;
  className?: string;
  id?: string;
};

export const Form = <TFormValues extends FieldValues>({
  schema,
  onSubmit,
  options,
  children,
  className,
  id,
}: FormProps<TFormValues>): React.JSX.Element => {
  const form = useForm<TFormValues>({
    ...options,
    resolver: zodResolver(schema),
  });

  return (
    <form
      id={id}
      // noValidate: Zod validates, not the browser (no native bubbles in another language)
      noValidate
      className={cn('space-y-4', className)}
      onSubmit={(event) => {
        void form.handleSubmit((values) => onSubmit(values, form))(event);
      }}
    >
      {children(form)}
    </form>
  );
};

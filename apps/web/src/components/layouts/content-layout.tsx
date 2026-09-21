import type React from 'react';
import type { ReactNode } from 'react';

type ContentLayoutProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function ContentLayout({
  title,
  description,
  children,
}: ContentLayoutProps): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-gray-600">{description}</p>
      {children}
    </main>
  );
}

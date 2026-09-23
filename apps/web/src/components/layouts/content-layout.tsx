import type React from 'react';
import type { ReactNode } from 'react';

type ContentLayoutProps = {
  title: string;
  description: string;
  children?: ReactNode;
  // Both reach the `<main>`: a page that must receive the focus by code (after
  // a navigation) passes `tabIndex={-1}`, which lets it take the focus without
  // entering the Tab order.
  ref?: React.Ref<HTMLElement>;
  tabIndex?: number;
};

export function ContentLayout({
  title,
  description,
  children,
  ref,
  tabIndex,
}: ContentLayoutProps): React.JSX.Element {
  return (
    <main
      ref={ref}
      id="main-content"
      tabIndex={tabIndex}
      // The page itself is not an action: no outline when it takes the focus
      // by code, only its content shows the focus.
      className="mx-auto max-w-2xl p-8 focus:outline-none"
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-gray-600">{description}</p>
      {children}
    </main>
  );
}

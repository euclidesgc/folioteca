import type React from 'react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';

const navItems = [
  { label: 'Favoritos', href: paths.favorites.getHref() },
  { label: 'Meus documentos', href: paths.myDocuments.getHref() },
  { label: 'Espaços', href: paths.spaces.getHref() },
  { label: 'Lixeira', href: paths.trash.getHref() },
];

const sidebarItemClassName = ({
  isActive,
}: {
  isActive: boolean;
}): string =>
  [
    'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
    isActive ? 'bg-gray-200 text-gray-900' : '',
  ]
    .filter(Boolean)
    .join(' ');

const panelId = 'app-layout-sidebar-panel';

type AppLayoutProps = {
  // Optional slots of the collapsible panel: actions above the main
  // navigation and a section below it. The layout knows nothing about what
  // goes in them.
  sidebarActions?: ReactNode;
  sidebarSection?: ReactNode;
  sidebarFooter: ReactNode;
  children: ReactNode;
};

export function AppLayout({
  sidebarActions,
  sidebarSection,
  sidebarFooter,
  children,
}: AppLayoutProps): React.JSX.Element {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Closes the panel when the route changes, adjusting state during
  // rendering instead of in an effect (react.dev/learn/you-might-not-need-an-effect).
  const [lastPathname, setLastPathname] = useState(location.pathname);
  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname);
    setIsPanelOpen(false);
  }

  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setIsPanelOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen]);

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-600 focus:outline-2 focus:outline-blue-600"
      >
        Pular para o conteúdo
      </a>

      <div className="flex items-center justify-between gap-4 p-4 md:hidden">
        <span className="font-semibold">Folioteca</span>
        <Button
          ref={menuButtonRef}
          variant="secondary"
          aria-expanded={isPanelOpen}
          aria-controls={panelId}
          onClick={() => setIsPanelOpen((current) => !current)}
        >
          {isPanelOpen ? 'Fechar menu' : 'Abrir menu'}
        </Button>
      </div>

      <aside className="border-b border-gray-200 bg-gray-50 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="p-4">
          <Link to={paths.home.getHref()} className="font-semibold">
            Folioteca
          </Link>
        </div>

        <div
          id={panelId}
          className={`${isPanelOpen ? 'block' : 'hidden'} md:flex md:flex-1 md:flex-col md:justify-between`}
        >
          <div>
            {sidebarActions ? <div className="p-4">{sidebarActions}</div> : null}

            <nav aria-label="Navegação principal" className="p-4">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <NavLink to={item.href} className={sidebarItemClassName}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {sidebarSection}
          </div>

          <div className="p-4">{sidebarFooter}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

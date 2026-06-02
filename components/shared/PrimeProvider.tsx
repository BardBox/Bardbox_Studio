'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { PrimeReactProvider } from 'primereact/api';

const OVERRIDE_CSS = `
/* PrimeReact DataTable — match app design system */

.p-datatable .p-datatable-thead > tr > th,
.p-datatable .p-datatable-thead > tr > th.p-sortable-column {
  background: var(--card) !important;
  color: var(--muted-foreground) !important;
  border: none !important;
  border-bottom: 2px solid var(--border) !important;
  font-size: 0.7rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.07em !important;
  text-transform: uppercase !important;
  padding: 0.65rem 1rem !important;
  white-space: nowrap !important;
}

.p-datatable .p-datatable-thead > tr > th.p-sortable-column:hover {
  background: var(--muted) !important;
  color: var(--foreground) !important;
  box-shadow: none !important;
}

.p-datatable .p-datatable-thead > tr > th.p-highlight {
  background: var(--muted) !important;
  color: var(--foreground) !important;
}

.p-datatable .p-datatable-tbody > tr,
.p-datatable .p-datatable-tbody > tr.p-row-odd {
  background: var(--background) !important;
  color: var(--foreground) !important;
  border: none !important;
  transition: background-color 0.1s !important;
}

.p-datatable .p-datatable-tbody > tr > td {
  background: transparent !important;
  color: var(--foreground) !important;
  border: none !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 0.65rem 1rem !important;
}

.p-datatable .p-datatable-tbody > tr:hover > td {
  background: var(--muted) !important;
}

.p-datatable .p-datatable-tbody > tr:last-child > td {
  border-bottom: none !important;
}

.p-datatable .p-datatable-emptymessage > td {
  text-align: center !important;
  color: var(--muted-foreground) !important;
  border: none !important;
  padding: 2.5rem 1rem !important;
}

/* Sort icon */
.p-sortable-column-icon {
  color: var(--muted-foreground) !important;
  font-size: 0.65rem !important;
}
.p-sortable-column.p-highlight .p-sortable-column-icon {
  color: var(--primary) !important;
}

/* Filter funnel icon */
.p-column-filter-menu-button,
.p-column-filter-menu-button.p-link {
  color: var(--muted-foreground) !important;
  background: transparent !important;
  border-radius: 4px !important;
  width: 1.5rem !important;
  height: 1.5rem !important;
  transition: background-color 0.1s, color 0.1s !important;
}
.p-column-filter-menu-button:hover {
  background: var(--muted) !important;
  color: var(--foreground) !important;
}
.p-column-filter-menu-button.p-column-filter-menu-button-active {
  color: var(--primary) !important;
  background: transparent !important;
}

/* Filter overlay */
.p-column-filter-overlay {
  background: var(--popover) !important;
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12) !important;
  color: var(--popover-foreground) !important;
  min-width: 14rem !important;
}
.p-column-filter-overlay .p-column-filter-row-item {
  color: var(--popover-foreground) !important;
  border-radius: 4px !important;
  font-size: 0.875rem !important;
}
.p-column-filter-overlay .p-column-filter-row-item:hover {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
}
.p-column-filter-overlay .p-column-filter-row-item.p-highlight {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
}
.p-column-filter-buttonbar {
  background: var(--muted) !important;
  border-top: 1px solid var(--border) !important;
  display: flex !important;
  gap: 0.5rem !important;
  padding: 0.5rem 0.75rem !important;
}

/* Clear / Apply buttons inside filter popup */
.p-column-filter-buttonbar .p-button {
  font-size: 0.75rem !important;
  padding: 0.3rem 0.75rem !important;
  border-radius: 6px !important;
  border: 1px solid var(--border) !important;
  cursor: pointer !important;
  font-family: inherit !important;
}
.p-column-filter-buttonbar .p-button-outlined,
.p-column-filter-buttonbar .p-button.p-button-outlined {
  background: transparent !important;
  color: var(--foreground) !important;
}
.p-column-filter-buttonbar .p-button:not(.p-button-outlined) {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: var(--primary-foreground) !important;
}
.p-column-filter-buttonbar .p-button:hover {
  opacity: 0.9 !important;
}

/* Match-mode dropdown (the "Equals / Contains / …" selector at the top of the popup) */
.p-column-filter-matchmode-dropdown {
  background: var(--background) !important;
  border-color: var(--border) !important;
  border-radius: 6px !important;
  font-size: 0.8rem !important;
  margin-bottom: 0.5rem !important;
}
.p-column-filter-matchmode-dropdown .p-dropdown-label {
  color: var(--foreground) !important;
  font-size: 0.8rem !important;
}
.p-column-filter-matchmode-dropdown .p-dropdown-trigger {
  color: var(--muted-foreground) !important;
}

/* Dropdown (inside filter popup & paginator) */
.p-dropdown,
.p-dropdown.p-component {
  background: var(--background) !important;
  border-color: var(--border) !important;
  border-radius: 6px !important;
}
.p-dropdown:not(.p-disabled):hover { border-color: var(--ring) !important; }
.p-dropdown .p-dropdown-label { color: var(--foreground) !important; font-size: 0.875rem !important; }
.p-dropdown .p-dropdown-trigger { color: var(--muted-foreground) !important; }
.p-dropdown-panel {
  background: var(--popover) !important;
  border: 1px solid var(--border) !important;
  border-radius: 6px !important;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12) !important;
}
.p-dropdown-items-wrapper {
  padding: 0.25rem !important;
}
.p-dropdown-items {
  padding: 0 !important;
  margin: 0 !important;
  list-style: none !important;
}
.p-dropdown-item {
  color: var(--popover-foreground) !important;
  font-size: 0.875rem !important;
  border-radius: 4px !important;
  padding: 0.45rem 0.75rem !important;
  cursor: pointer !important;
}
.p-dropdown-item:hover, .p-dropdown-item.p-focus {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
}
.p-dropdown-item.p-highlight {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
}

/* Paginator */
.p-paginator {
  background: var(--background) !important;
  border: none !important;
  border-top: 1px solid var(--border) !important;
  color: var(--muted-foreground) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  padding: 0.5rem 1rem !important;
  flex-wrap: wrap !important;
}
.p-paginator .p-paginator-first,
.p-paginator .p-paginator-prev,
.p-paginator .p-paginator-next,
.p-paginator .p-paginator-last,
.p-paginator .p-paginator-pages .p-paginator-page {
  color: var(--foreground) !important;
  background: transparent !important;
  border: none !important;
  border-radius: 6px !important;
  min-width: 2rem !important;
  height: 2rem !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 0.875rem !important;
  cursor: pointer !important;
  padding: 0 0.25rem !important;
}
.p-paginator .p-paginator-first:hover,
.p-paginator .p-paginator-prev:hover,
.p-paginator .p-paginator-next:hover,
.p-paginator .p-paginator-last:hover,
.p-paginator .p-paginator-pages .p-paginator-page:hover {
  background: var(--muted) !important;
}
.p-paginator .p-paginator-pages .p-paginator-page.p-highlight {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
}
.p-paginator .p-paginator-pages {
  display: flex !important;
  align-items: center !important;
  gap: 0.125rem !important;
}
.p-paginator-current {
  font-size: 0.8rem !important;
  color: var(--muted-foreground) !important;
  padding: 0 0.5rem !important;
  white-space: nowrap !important;
}

/* Rows-per-page dropdown in paginator */
.p-paginator .p-paginator-rpp-options,
.p-paginator .p-dropdown {
  background: var(--background) !important;
  border: 1px solid var(--border) !important;
  border-radius: 6px !important;
  height: 2rem !important;
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 0.25rem !important;
}
.p-paginator .p-dropdown .p-dropdown-label {
  color: var(--foreground) !important;
  font-size: 0.8rem !important;
  padding: 0 0.5rem !important;
  line-height: 2rem !important;
}
.p-paginator .p-dropdown .p-dropdown-trigger {
  color: var(--muted-foreground) !important;
  width: 1.5rem !important;
}
.p-paginator .p-dropdown:hover {
  border-color: var(--ring) !important;
}
`;

export function PrimeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Swap lara theme (light/dark)
    let themeLink = document.getElementById('primereact-theme') as HTMLLinkElement | null;
    if (!themeLink) {
      themeLink = document.createElement('link');
      themeLink.id = 'primereact-theme';
      themeLink.rel = 'stylesheet';
      document.head.appendChild(themeLink);
    }
    themeLink.href = resolvedTheme === 'dark'
      ? '/primereact-dark.css'
      : '/primereact-light.css';

    // Inject override <style> once, after the theme link
    if (!document.getElementById('primereact-override')) {
      const style = document.createElement('style');
      style.id = 'primereact-override';
      style.textContent = OVERRIDE_CSS;
      document.head.appendChild(style);
    }
  }, [resolvedTheme]);

  return (
    <PrimeReactProvider value={{ ripple: false }}>
      {children}
    </PrimeReactProvider>
  );
}

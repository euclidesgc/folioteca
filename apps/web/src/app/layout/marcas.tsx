import type { ReactElement, SVGProps } from "react";

export function HomeMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2 7.5 8 2l6 5.5" />
      <path d="M3.5 6.5V14h9V6.5" />
    </svg>
  );
}

export function SearchMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="6.8" cy="6.8" r="4.3" />
      <line x1="10" y1="10" x2="14" y2="14" />
    </svg>
  );
}

export function StructureMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="5.5" y="1.5" width="5" height="3.5" rx="0.5" />
      <rect x="1" y="11" width="5" height="3.5" rx="0.5" />
      <rect x="10" y="11" width="5" height="3.5" rx="0.5" />
      <path d="M8 5v3M3.5 11V8h9v3" />
    </svg>
  );
}

export function StarMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 1.5 9.8 5.6l4.5.4-3.4 3 1 4.4L8 11.1l-3.9 2.3 1-4.4-3.4-3 4.5-.4Z" />
    </svg>
  );
}

export function TrashMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M6.5 7v4M9.5 7v4" />
      <path d="M3.5 4 4.2 13.5h7.6L12.5 4" />
    </svg>
  );
}

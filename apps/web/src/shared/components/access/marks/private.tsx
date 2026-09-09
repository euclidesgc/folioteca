import type { ReactElement, SVGProps } from "react";

export function PrivateMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="2" width="8" height="12" rx="0.5" />
      <line x1="6.5" y1="2" x2="6.5" y2="14" />
      <line x1="9.5" y1="2" x2="9.5" y2="14" />
    </svg>
  );
}

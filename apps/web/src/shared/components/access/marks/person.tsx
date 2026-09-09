import type { ReactElement, SVGProps } from "react";

export function PersonMark(props: SVGProps<SVGSVGElement>): ReactElement {
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
      <rect x="6" y="2" width="4" height="12" rx="0.5" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

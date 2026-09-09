import type { ReactElement, SVGProps } from "react";

export function ChannelMark(props: SVGProps<SVGSVGElement>): ReactElement {
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
      <rect x="1.75" y="5" width="2.9" height="9" rx="0.4" />
      <rect x="6.55" y="2" width="2.9" height="12" rx="0.4" />
      <rect x="11.35" y="5" width="2.9" height="9" rx="0.4" />
    </svg>
  );
}

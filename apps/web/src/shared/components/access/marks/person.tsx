import type { ReactElement, SVGProps } from "react";
import { MarkFrame } from "./mark-frame";

export function PersonMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <MarkFrame {...props}>
      <rect x="6" y="2" width="4" height="12" rx="0.5" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
    </MarkFrame>
  );
}

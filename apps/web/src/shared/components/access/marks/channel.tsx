import type { ReactElement, SVGProps } from "react";
import { MarkFrame } from "./mark-frame";

export function ChannelMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <MarkFrame {...props}>
      <rect x="1.75" y="5" width="2.9" height="9" rx="0.4" />
      <rect x="6.55" y="2" width="2.9" height="12" rx="0.4" />
      <rect x="11.35" y="5" width="2.9" height="9" rx="0.4" />
    </MarkFrame>
  );
}

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders one placeholder element, hidden from assistive tech since it announces nothing on its own", () => {
    const { container } = render(<Skeleton />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("stays hidden from assistive tech even when the caller resizes it for a specific piece of content", () => {
    const { container } = render(
      <Skeleton className="size-10 rounded-amplo" />,
    );
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards arbitrary props to the placeholder element, like a caller-supplied id", () => {
    const { container } = render(<Skeleton id="esqueleto-avatar" />);
    expect(container.firstElementChild).toHaveAttribute(
      "id",
      "esqueleto-avatar",
    );
  });
});

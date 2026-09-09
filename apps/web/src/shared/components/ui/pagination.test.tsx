import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("marks the current page with aria-current, among one button per page", () => {
    render(<Pagination page={2} total={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("reports the clicked page number through onChange", () => {
    const aoMudar = vi.fn();
    render(<Pagination page={1} total={3} onChange={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it("disables Anterior on the first page and Próxima on the last", () => {
    render(<Pagination page={1} total={1} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });
});

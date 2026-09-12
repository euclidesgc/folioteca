import { useQuery } from "@tanstack/react-query";
import { findSpace } from "../model/tree";

export function useSpace(id: string) {
  return useQuery({
    queryKey: ["spaces", id],
    queryFn: () => findSpace(id),
  });
}

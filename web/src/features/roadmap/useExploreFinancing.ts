import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Model } from "@/api/types";

/** Show eligibility choices before starting an application or calculator. */
export function useExploreFinancing(onOpen?: () => void) {
  const nav = useNavigate();
  return useMutation({
    mutationFn: async (model: Model) => model,
    onSuccess: model => { onOpen?.(); nav(`/explore?eligibility=${encodeURIComponent(model.id)}#eligibility`); },
  });
}

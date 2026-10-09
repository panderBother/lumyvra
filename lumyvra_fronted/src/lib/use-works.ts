"use client";
import { useAPI } from "./use-api";
import type { Work } from "./works";

export type WorkScope = "public" | "mine" | "inspirations" | "favorites";
export function useWorks(scope: WorkScope = "public") {
  const path = { public: "/works", mine: "/me/works", inspirations: "/inspirations", favorites: "/me/favorites" }[scope];
  const result = useAPI<{ works: Work[]; total?: number }>(`${path}?limit=200`, true);
  return { works: result.data?.works ?? [], loaded: result.loaded, error: result.error, total: result.data?.total ?? result.data?.works.length ?? 0 };
}
export function useWork(id?: string) {
  const result = useAPI<{ work: Work }>(id ? `/works/${encodeURIComponent(id)}` : null);
  return { work: result.data?.work, loaded: result.loaded, error: result.error };
}

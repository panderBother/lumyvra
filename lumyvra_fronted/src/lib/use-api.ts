"use client";
import { useEffect, useState } from "react";
import { readAPI, readWorkPages, DATA_EVENT, type User } from "./api";

export function useAPI<T>(path: string | null, allPages = false) {
  const [state, setState] = useState<{ path: string | null; data?: T; loaded: boolean; error: string }>({ path, loaded: false, error: "" });
  useEffect(() => {
    if (!path) return;
    let controller: AbortController | undefined;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      // Concurrent cards share a request. Local cancellation still prevents stale updates.
      (allPages ? readWorkPages<T>(path) : readAPI<T>(path)).then(data => {
        if (!signal.aborted) setState({ path, data, loaded: true, error: "" });
      }).catch(error => {
        if (!signal.aborted) setState({ path, loaded: true, error: error instanceof Error ? error.message : "读取失败，请重试。" });
      });
    };
    load();
    window.addEventListener(DATA_EVENT, load);
    window.addEventListener("focus", load);
    return () => { controller?.abort(); window.removeEventListener(DATA_EVENT, load); window.removeEventListener("focus", load); };
  }, [path, allPages]);
  return state.path === path ? state : { path, loaded: false, error: "", data: undefined };
}

export function useUser() {
  const state = useAPI<{ user: User | null }>("/me");
  return { ...state, user: state.data?.user ?? null };
}

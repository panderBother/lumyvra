"use client";
import { useMemo, useSyncExternalStore } from "react";
import { WORKS_KEY, WORKS_EVENT, parseWorks } from "./works";

function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (!event.key || event.key === WORKS_KEY) callback();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(WORKS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(WORKS_EVENT, callback);
  };
}
function snapshot() {
  try {
    return window.localStorage.getItem(WORKS_KEY) ?? "";
  } catch {
    return "unavailable";
  }
}
const serverSnapshot = () => null;
export function useWorks() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => {
    try {
      return { works: parseWorks(raw), loaded: raw !== null, error: "" };
    } catch {
      return {
        works: [],
        loaded: true,
        error: "无法读取本地作品。请检查浏览器存储权限，已有数据不会被覆盖。",
      };
    }
  }, [raw]);
}

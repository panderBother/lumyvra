import type { WorkInput } from "./works";

export type User = { id: string; email: string; name: string; createdAt: string };
export type GenerationJob = { id: string; workId: string; status: "queued" | "running" | "cancelling" | "succeeded" | "failed" | "cancelled"; progress: number; provider: string; input?: WorkInput; error?: string; errorCode?: string; stage?: string; startedAt?: string; createdAt?: string; versionId?: string };
export type MusicConfig = { generationMode: "demo" | "local"; musicEngine: { status: string; available: boolean; producerAvailable: boolean; model: string; maxSeconds: number; issues?: string[]; qualityVerified: boolean } };

export class APIError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    response = await fetch(`/api${path}`, {
      ...options, signal: controller.signal, credentials: "same-origin", cache: "no-store",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new APIError(data?.error?.message || "服务暂时不可用，请稍后重试。", response.status);
    if (!data) throw new APIError("后端返回了无效响应。", response.status);
    return data as T;
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (options.signal?.aborted) throw error;
    if (controller.signal.aborted) throw new APIError("请求超时，请重试。", 0);
    throw new APIError("无法连接后端，请确认服务已启动后重试。", 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const DATA_EVENT = "lumyvra:server-data";
let revision = 0;
const pendingReads = new Map<string, Promise<unknown>>();
export function readAPI<T>(path: string): Promise<T> {
  const key = `${revision}:${path}`;
  const existing = pendingReads.get(key);
  if (existing) return existing as Promise<T>;
  const request = api<T>(path).finally(() => { pendingReads.delete(key); });
  pendingReads.set(key, request);
  return request;
}
export async function readWorkPages<T>(path: string): Promise<T> {
  const started = revision;
  const first = await readAPI<{ works: { id: string }[]; total?: number }>(path);
  const works = [...first.works];
  let offset = works.length;
  while (first.total && offset < first.total) {
    if (started !== revision) throw new APIError("账号或作品已更新，正在重新读取。", 0);
    const page = await readAPI<{ works: { id: string }[] }>(`${path}&offset=${offset}`);
    if (!page.works.length) break;
    works.push(...page.works); offset += page.works.length;
  }
  return { ...first, works: [...new Map(works.map(work => [work.id, work])).values()] } as T;
}
export function refreshData() { revision++; window.dispatchEvent(new Event(DATA_EVENT)); }

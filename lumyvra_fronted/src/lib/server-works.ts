import { api, refreshData, type GenerationJob } from "./api";
import type { Work, WorkInput } from "./works";

export async function saveDraft(input: WorkInput, existingId?: string, regenerate = false) {
  const result = await api<{ work: Work }>(existingId ? `/works/${encodeURIComponent(existingId)}/draft` : "/works", {
    method: existingId ? "PUT" : "POST", body: JSON.stringify({ ...input, regenerate }),
  });
  refreshData(); return result.work;
}
export async function editWork(id: string, title: string, description: string) {
  const result = await api<{ work: Work }>(`/works/${id}`, { method: "PATCH", body: JSON.stringify({ title, description }) });
  refreshData(); return result.work;
}
export async function publishWork(id: string, title: string, description: string, allowRemix: boolean) {
  const result = await api<{ work: Work }>(`/works/${id}/publish`, { method: "POST", body: JSON.stringify({ title, description, allowRemix }) });
  refreshData(); return result.work;
}
export async function generateWork(id: string) {
  const result = await api<{ job: GenerationJob }>(`/works/${id}/generate`, { method: "POST" });
  refreshData(); return result.job;
}
export async function favoriteWork(id: string, liked: boolean) {
  await api(`/me/favorites/${encodeURIComponent(id)}`, { method: liked ? "PUT" : "DELETE" });
  refreshData();
}

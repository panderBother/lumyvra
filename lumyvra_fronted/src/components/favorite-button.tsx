"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { useWorks } from "@/lib/use-works";
import { useUser } from "@/lib/use-api";
import { favoriteWork } from "@/lib/server-works";

export function FavoriteButton({ id }: { id: string }) {
  const { user } = useUser();
  const { works } = useWorks("favorites");
  const liked = works.some(w => w.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <>
    <button className={`button secondary small ${liked ? "liked" : ""}`} aria-pressed={liked} disabled={busy} onClick={async () => {
      if (!user) { setError("请先登录后收藏。"); return; }
      setBusy(true); setError("");
      try { await favoriteWork(id, !liked); }
      catch (err) { setError(err instanceof Error ? err.message : "收藏失败"); }
      finally { setBusy(false); }
    }}><Heart size={16} fill={liked ? "currentColor" : "none"} />{liked ? "已收藏" : "收藏"}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </>;
}

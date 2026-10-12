import type { Metadata } from "next";
import { CreatorEntry } from "@/components/creator-entry";
export const metadata: Metadata = { title: "音乐创作" };
export default async function Create({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    prompt?: string;
    template?: string;
    remix?: string;
    draft?: string;
    genre?: string;
    mood?: string;
  }>;
}) {
  const { mode, prompt, template, remix, draft, genre, mood } =
    await searchParams;
  return (
    <div className="container page-space workspace-page">
      <header className="workspace-heading">
        <div>
          <h1>把此刻，写成一首歌。</h1>
          <p>从一句话开始，找到属于你的声音。</p>
        </div>
        <span className="workspace-label">创作工作台</span>
      </header>
      <CreatorEntry
        mode={["text", "lyrics", "words"].includes(mode ?? "") ? mode! : "text"}
        prompt={typeof prompt === "string" ? prompt.slice(0, mode === "lyrics" ? 4096 : 2000) : ""}
        genre={
          typeof genre === "string" &&
          [
            "流行",
            "民谣",
            "电子",
            "R&B",
            "古风",
            "摇滚",
            "轻音乐",
            "说唱",
            "爵士",
            "纯音乐",
            "其他",
          ].includes(genre)
            ? genre
            : undefined
        }
        mood={
          typeof mood === "string" &&
          ["开心", "治愈", "悲伤", "浪漫", "激情", "平静"].includes(mood)
            ? mood
            : undefined
        }
        template={typeof template === "string" ? template : undefined}
        remix={typeof remix === "string" ? remix : undefined}
        draft={typeof draft === "string" ? draft : undefined}
      />
    </div>
  );
}

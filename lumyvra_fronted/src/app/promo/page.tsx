import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InspirationGallery } from "@/components/inspiration-gallery";
export const metadata = {
  title: "创作灵感",
  description: "发现音乐创作灵感，查看提示词，用喜欢的风格创作自己的版本。",
};
export default function PromoPage() {
  return (
    <div className="container page-space inspiration-page">
      <header className="inspiration-intro">
        <div>
          <span className="eyebrow">创作灵感</span>
          <h1>好音乐，是下一首的开始。</h1>
          <p>一段故事，一种风格。找到喜欢的灵感，做一首属于你的同款。</p>
        </div>
        <Link href="/create" className="button gradient">
          写下我的灵感 <ArrowUpRight size={18} />
        </Link>
      </header>
      <InspirationGallery />
      <aside className="inspiration-invite">
        <div>
          <h2>让你的作品，也成为别人的起点。</h2>
          <p>
            发布作品时开启「允许做同款」，你的创作提示词、风格和情绪就会出现在这里。
          </p>
          <p className="muted">
            当前为本地演示：新发布的作品仅在此浏览器可见。
          </p>
        </div>
        <Link href="/profile?tab=drafts" className="text-cta">
          看看我的草稿 <ArrowUpRight size={17} />
        </Link>
      </aside>
    </div>
  );
}

import Image from "next/image";
import { ArrowRight, AudioLines } from "lucide-react";
import { GradientLink } from "@/components/ui";
export const metadata = { title: "关于我们" };
export default function AboutPage() {
  return (
    <div className="container about-page">
      <div className="about-art">
        <Image
          src="/assets/hd/promo.webp"
          alt="在音乐中找到无限灵感"
          fill
          sizes="100vw"
          quality={90}
        />
      </div>
      <section className="about-content">
        <span className="eyebrow">关于 Lumyvra</span>
        <AudioLines className="about-icon" size={50} />
        <h1>
          每个人心里，
          <br />
          <span>都有一首自己的歌。</span>
        </h1>
        <p>
          Lumyvra 相信，每个人的心里，都藏着一段独特的旋律。
          <br />
          我们希望用 AI 连接灵感与音乐，让文字、故事和情感，
          <br />
          拥有被听见的可能。
        </p>
        <GradientLink href="/create">
          发现你的声音 <ArrowRight size={18} />
        </GradientLink>
      </section>
      <section className="about-values panel">
        <div>
          <strong>从 0 到 1</strong>
          <p>让第一个想法，成为第一首歌</p>
        </div>
        <div>
          <strong>不止一种风格</strong>
          <p>探索音乐的无限可能</p>
        </div>
        <div>
          <strong>属于每个人</strong>
          <p>让每份热爱，都能自由表达</p>
        </div>
      </section>
    </div>
  );
}

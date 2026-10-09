import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Disc3,
  FileAudio,
  NotebookPen,
} from "lucide-react";
import { SonicStage } from "@/components/landing/sonic-stage";
import { InspirationInput } from "@/components/landing/inspiration-input";
import { MoodStage } from "@/components/landing/mood-stage";
import { LandingMotionProvider, ParticleMotionToggle } from "@/components/landing/landing-motion";
import { ParticleVeil } from "@/components/landing/particle-veil";
import { tracks, coverUrl } from "@/lib/music";

const stories = [
  { track: tracks[0], note: "把没说出口的夏天，写进歌里。" },
  { track: tracks[1], note: "凌晨两点，城市还没有睡。" },
  { track: tracks[4], note: "给下一次出发，配一段旋律。" },
  { track: tracks[5], note: "让一些回忆，慢一点散场。" },
];
export default function Home() {
  return (
    <LandingMotionProvider>
    <div className="music-landing campaign-landing">
      <section className="sonic-hero" aria-labelledby="sonic-title">
        <SonicStage />
        <ParticleVeil variant="stars" />
        <div className="sonic-copy">
          <p className="sonic-kicker">
            <AudioLines size={17} />
            你的故事，值得被听见
          </p>
          <h1 id="sonic-title">
            你心里的声音，
            <br />
            <span>值得一首歌。</span>
          </h1>
          <p className="sonic-intro">
            一句灵感，一段歌词。把心里的声音，变成你的作品。
            <br />
            从这里开始，做自己的音乐人。
          </p>
          <InspirationInput />
        </div>
      </section>
      <section className="creation-shortcuts" aria-label="选择你的创作方式">
        <ParticleVeil variant="stars" />
        <p>
          灵感没有标准答案。
          <br />
          <strong>创作，也不必只有一种方式。</strong>
        </p>
        <Link href="/create?mode=text">
          <AudioLines />
          <span>
            <strong>一句话，变成一首歌</strong>
            <small>从画面、情绪或故事开始</small>
          </span>
          <ArrowUpRight />
        </Link>
        <Link href="/create?mode=lyrics">
          <FileAudio />
          <span>
            <strong>给你的歌词，找到旋律</strong>
            <small>让纸上的文字有自己的声音</small>
          </span>
          <ArrowUpRight />
        </Link>
        <Link href="/create?mode=words">
          <NotebookPen />
          <span>
            <strong>还差一句，帮你写下去</strong>
            <small>接住那些一闪而过的灵感</small>
          </span>
          <ArrowUpRight />
        </Link>
      </section>
      <MoodStage />
      <section className="discovery-section" aria-labelledby="discovery-title">
        <ParticleVeil variant="stars" />
        <div className="editorial-heading">
          <div>
            <h2 id="discovery-title">
              从一首喜欢的歌，
              <br />
              <span>开始你的创作。</span>
            </h2>
            <p>选一个打动你的主题，加入自己的故事。</p>
          </div>
          <Link href="/promo">
            发现更多灵感 <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="editorial-records">
          {stories.map(({ track, note }, index) => (
            <article className="editorial-record" key={track.id}>
              <Link
                href={`/create?template=${track.id}`}
                className="record-picture"
                aria-label={`以${track.title}为灵感，做同款`}
              >
                <Image
                  src={coverUrl(track.cover)}
                  alt={note}
                  fill
                  quality={90}
                  sizes="(max-width: 600px) 78vw, (max-width: 1000px) 44vw, 23vw"
                />
                <span className="record-open">
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <div className="record-heading">
                <span className="record-number">0{index + 1}</span>
                <h3>
                  <Link href={`/create?template=${track.id}`}>
                    {track.title}
                  </Link>
                </h3>
                <span>{track.genre}</span>
              </div>
              <p>{note}</p>
              <Link
                className="record-remix"
                href={`/create?template=${track.id}`}
              >
                做同款 <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="song-story" aria-labelledby="story-title">
        <ParticleVeil variant="embers" />
        <div className="story-art">
          <Image
            src="/assets/hd/stage-campaign.webp"
            alt="聚光灯下的歌手背影，音乐舞台概念图"
            fill
            quality={90}
            sizes="100vw"
          />
          <div className="story-art-shade" />
          <div className="story-quote">
            你的第一首歌，
            <br />
            不必等到准备好了。
          </div>
        </div>
        <div className="story-copy">
          <h2 id="story-title">
            从一个念头，
            <br />
            <span>到你的作品。</span>
          </h2>
          <p>
            不懂乐理，也可以从一个念头开始。选一种风格，把想说的话写下来，慢慢找到自己的声音。
          </p>
          <div className="story-steps">
            <div>
              <span>01</span>
              <p>
                <strong>把灵感说出来</strong>一句话、一段歌词，都可以是开始。
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>慢慢打磨，先留草稿</strong>
                选好风格和情绪，让想法慢慢成形。
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>发布，也给别人一点灵感</strong>
                开放做同款，让一个故事长出新的旋律。
              </p>
            </div>
          </div>
          <Link href="/create" className="text-cta">
            去工作台试一试 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="closing-invitation">
        <ParticleVeil variant="waves" />
        <Disc3 size={36} strokeWidth={1} />
        <h2>
          下一首，
          <br />
          <span>就写你的。</span>
        </h2>
        <Link href="/create" className="lime-button">
          现在，写下第一句 <ArrowUpRight size={20} />
        </Link>
        <p>从一个想法开始就好。</p>
        <ParticleMotionToggle />
      </section>
    </div>
    </LandingMotionProvider>
  );
}

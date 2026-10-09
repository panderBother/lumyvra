"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { ParticleVeil } from "./particle-veil";
const scenes = [
  {
    id: "summer",
    name: "逃离日常",
    title: "把生活调成，\n自由的频率。",
    description: "车窗降下来，吉他响起来。把下一次出发，写成一首歌。",
    image: "/assets/hd/summer.webp",
    tags: "独立流行 / 吉他 / 夏日公路",
    prompt:
      "一首适合夏日公路旅行的独立流行，轻快的吉他与鼓点，描写海风、日落和自由出发的心情。",
    genre: "流行",
    mood: "开心",
  },
  {
    id: "city",
    name: "深夜独白",
    title: "白天没说的话，\n今晚唱给自己。",
    description: "把城市的声音关小一点。用缓慢的节拍，接住今天的情绪。",
    image: "/assets/hd/city.webp",
    tags: "Lo-fi / 电钢琴 / 夜晚",
    prompt:
      "一首适合深夜独自听的 Lo-fi，柔和的电钢琴与轻鼓点，安静、温暖，像城市窗外的雨。",
    genre: "电子",
    mood: "平静",
  },
  {
    id: "rain",
    name: "写给某个人",
    title: "有些想念，\n值得一首歌。",
    description: "不用想好开场白。把那个名字留在心里，把故事写进旋律。",
    image: "/assets/hd/rain.webp",
    tags: "民谣 / 原声吉他 / 温柔叙事",
    prompt:
      "一首写给很久没有联系的朋友的民谣，温柔的原声吉他与真诚的人声，想念但不伤感，像一封终于寄出的信。",
    genre: "民谣",
    mood: "浪漫",
  },
];
export function MoodStage() {
  const [selected, setSelected] = useState(0);
  const scene = scenes[selected];
  return (
    <section className="mood-stage" aria-labelledby="mood-heading">
      <ParticleVeil variant="embers" />
      <div className="mood-heading">
        <h2 id="mood-heading">
          此刻的你，
          <br />
          <span>是什么声音？</span>
        </h2>
        <div className="mood-switches" role="group" aria-label="选择创作场景">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              aria-pressed={selected === i}
              aria-controls="mood-scene"
              onClick={() => setSelected(i)}
            >
              <span>0{i + 1}</span>
              {s.name}
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className={`mood-scene mood-${scene.id}`} id="mood-scene">
        <div className="mood-image" key={scene.id}>
          <Image
            src={scene.image}
            alt={`${scene.name}的音乐场景`}
            fill
            quality={90}
            sizes="(max-width: 760px) 100vw, 70vw"
          />
        </div>
        <div className="mood-scrim" />
        <div className="mood-scene-copy" aria-live="polite">
          <p className="mood-tags">{scene.tags}</p>
          <h3>{scene.title}</h3>
          <p>{scene.description}</p>
          <Link
            href={`/create?${new URLSearchParams({ prompt: scene.prompt, genre: scene.genre, mood: scene.mood })}`}
            className="lime-button"
          >
            用这个灵感开场 <ArrowRight size={19} />
          </Link>
        </div>
        <span className="mood-scene-number" aria-hidden="true">
          0{selected + 1}
        </span>
      </div>
    </section>
  );
}

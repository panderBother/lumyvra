"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
const prompts = [
  [
    "夏日公路",
    "一首适合夏日公路旅行的独立流行，轻快的吉他，海风和自由的感觉。",
  ],
  [
    "深夜耳机",
    "一首适合深夜独自听的 Lo-fi，柔和的电钢琴，安静、温暖，像城市窗外的雨。",
  ],
  [
    "写给某个人",
    "一首写给很久没有联系的朋友的民谣，温柔的吉他，想念但不伤感。",
  ],
];
export function InspirationInput() {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="inspiration-entry">
      <form action="/create" className="inspiration-form">
        <label htmlFor="home-inspiration" className="visually-hidden">
          描述你想创作的歌曲
        </label>
        <input
          id="home-inspiration"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          placeholder="此刻，你想写一首什么样的歌？"
        />
        <button type="submit" className="lime-button">
          开始创作 <ArrowUpRight size={19} />
        </button>
      </form>
      <div className="inspiration-seeds">
        <span>试试</span>
        {prompts.map(([label, text]) => (
          <button
            key={label}
            type="button"
            aria-pressed={prompt === text}
            onClick={() => setPrompt(text)}
          >
            {label}
            <span>↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
const questions = [
  [
    "如何使用文字生成音乐？",
    "注册并登录后，进入「创作」页面，描述主题、风格和情绪，再点击生成。草稿和生成任务由服务器保存。当前为演示生成，仅返回示例歌词，不生成真实音频。",
  ],
  [
    "支持哪些音乐风格？",
    "界面提供流行、民谣、电子、R&B、古风、摇滚、轻音乐、说唱、爵士和纯音乐等风格选项。",
  ],
  [
    "生成的音乐可以商用吗？",
    "当前原型没有生成真实音频，也没有授予商用许可。正式服务的授权范围需以届时公布的协议为准。",
  ],
  [
    "如何下载自己创作的音乐？",
    "生成结果页面预留了下载入口。素材包不包含音频文件，因此当前版本仅演示下载提示，不提供音频下载。",
  ],
  [
    "会员包含哪些权益？",
    "可以在「会员」页面查看原型中的方案、演示价格与权益。当前不接入支付，也不会产生收费。",
  ],
  [
    "生成需要多长时间？",
    "当前后端演示任务通常几秒完成。离开页面不会取消任务，可在草稿箱继续查看；真实音乐服务尚未接入。",
  ],
  [
    "如何保存我的作品？",
    "登录后保存的作品写入服务器数据库，换浏览器后登录同一账号即可查看。草稿仅本人可见，发布后进入作品广场；开启做同款还会公开提示词并进入灵感页。旧版浏览器本地草稿不会自动上传。",
  ],
];
export function HelpContent() {
  const [query, setQuery] = useState("");
  const filtered = questions.filter(([q, a]) => (q + a).includes(query));
  return (
    <>
      <label className="search-field help-search">
        <Search size={20} />
        <input
          placeholder="搜索你的问题…"
          aria-label="搜索帮助问题"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="faq-list">
        {filtered.map(([q, a]) => (
          <details className="panel" key={q}>
            <summary>
              {q}
              <ChevronDown size={18} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="empty-state">
          没有找到相关问题，试试「创作」「下载」或「会员」。
        </p>
      )}
    </>
  );
}

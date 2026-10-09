"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
const plans = [
  {
    name: "免费版",
    price: "0",
    description: "让第一份灵感，自由发声",
    features: [
      "每日 10 次音乐生成",
      "基础音乐风格",
      "标准音质导出",
      "个人作品管理",
    ],
  },
  {
    name: "专业版",
    price: "49",
    description: "为持续创作的你，释放更多可能",
    features: [
      "每月 500 次音乐生成",
      "高品质音色与完整风格",
      "高清音频导出",
      "更长的歌曲时长",
      "优先生成队列",
    ],
  },
  {
    name: "全能版",
    price: "199",
    description: "为无限灵感，打开所有可能",
    features: [
      "不限次数音乐生成",
      "专业音质与完整风格",
      "专属创作工具",
      "优先生成通道",
      "专属客户支持",
    ],
  },
];
export function MembershipPlans() {
  const [plan, setPlan] = useState("");
  return (
    <>
      <div className="pricing-grid">
        {plans.map((p, i) => (
          <article
            className={`pricing-card panel ${i === 1 ? "featured" : ""}`}
            key={p.name}
          >
            {i === 1 && (
              <span className="plan-badge">
                <Sparkles size={12} /> 推荐
              </span>
            )}
            <h2>{p.name}</h2>
            <div className="price">
              <span>¥</span>
              {p.price}
              <small>/月</small>
            </div>
            <p className="plan-description">{p.description}</p>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <Check size={16} />
                  {f}
                </li>
              ))}
            </ul>
            {i === 0 ? (
              <Link href="/create" className="button secondary">
                免费开始创作
              </Link>
            ) : (
              <button
                className={`button ${i === 1 ? "gradient" : "secondary"}`}
                onClick={() => setPlan(p.name)}
              >
                选择{p.name}
              </button>
            )}
          </article>
        ))}
      </div>
      <p className="pricing-note">原型演示价格与权益 · 暂未开放订阅</p>
      {plan && (
        <div className="subscription-message panel" role="status">
          <Sparkles size={24} />
          <div>
            <strong>你选择了{plan}</strong>
            <p>当前为静态页面演示，尚未接入支付服务。你可以先体验创作流程。</p>
          </div>
          <Link href="/create" className="button gradient small">
            体验创作
          </Link>
          <button
            className="button secondary small"
            onClick={() => setPlan("")}
          >
            关闭
          </button>
        </div>
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Disc3,
  Star,
  UserRound,
  FileAudio,
  ShieldCheck,
  Settings,
  Play,
  FilePenLine,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { useWorks } from "@/lib/use-works";
import { useUser } from "@/lib/use-api";
import { api, refreshData } from "@/lib/api";
import { LocalLibrary } from "./local-library";
export function Profile({ initialTab = "works" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const { user, loaded, error } = useUser();
  const name = user?.name || "音乐人";
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { works } = useWorks("mine");
  if (!loaded) return <p role="status">正在读取账号…</p>;
  if (!user) return <div className="panel empty-state"><h1>登录，保存你的音乐故事。</h1><p>{error || "草稿、发布和收藏都会保存在你的账号中。"}</p><Link href="/login" className="button gradient">登录 / 注册</Link></div>;
  return (
    <div className="profile-workspace">
      <div className="library-heading">
        <div>
          <span>个人中心</span>
          <h2>你的声音，收藏在这里。</h2>
        </div>
        <Link href="/create" className="button gradient">
          创作新作品 <Play size={14} />
        </Link>
      </div>
      <section className="profile-banner panel">
        <div className="profile-avatar">
          <UserRound size={48} />
        </div>
        <div className="profile-summary">
          <h1>{name}</h1>
          <p>
            ID: {user.id.slice(-12)} <span className="demo-label">{user.email}</span>
          </p>
          <div className="profile-stats">
            {[
              [
                String(works.filter((w) => w.status === "published").length),
                "已发布",
              ],
              [
                String(works.filter((w) => w.status === "draft").length),
                "草稿",
              ],
              [
                String(
                  works.filter((w) => w.status === "published" && w.allowRemix)
                    .length,
                ),
                "开放同款",
              ],
              [String(works.length), "创作记录"],
            ].map(([n, l]) => (
              <div key={l}>
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          className="button secondary small edit-profile"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          <Pencil size={13} /> 编辑资料
        </button>
      </section>
      {editing && (
        <form
          className="panel edit-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true); setMessage("");
            try { await api("/me", { method: "PATCH", body: JSON.stringify({ name: draft }) }); refreshData(); setEditing(false); }
            catch (err) { setMessage(err instanceof Error ? err.message : "保存失败"); }
            finally { setBusy(false); }
          }}
        >
          <label>
            昵称
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              required
            />
          </label>
          <button className="button gradient small" type="submit" disabled={busy}>
            <Check size={14} />
            保存
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="取消修改"
            onClick={() => setEditing(false)}
          >
            <X size={18} />
          </button>
        </form>
      )}
      {message && <p role="alert" className="form-error">{message}</p>}
      <div className="account-navigation">
        <nav className="account-sections" aria-label="个人中心栏目">
          {[
            { icon: Disc3, label: "我的作品", value: "works" },
            { icon: FilePenLine, label: "草稿箱", value: "drafts" },
            { icon: Star, label: "我的收藏", value: "favorites" },
            { icon: FileAudio, label: "创作记录", value: "history" },
            { icon: Settings, label: "设置", value: "settings" },
          ].map(({ icon: Icon, label, value }) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "active" : ""}
              aria-pressed={tab === value}
              aria-controls="account-content"
              onClick={() => {
                setTab(value);
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <Link href="/membership" className="account-membership">
          <ShieldCheck size={16} aria-hidden="true" /> 订阅会员
        </Link>
      </div>
      <section
        className="profile-works"
        id="account-content"
        aria-labelledby="account-section-title"
      >
        <h2 id="account-section-title">
          {tab === "favorites"
            ? "我的收藏"
            : tab === "drafts"
              ? "未发布的草稿"
              : tab === "history"
                ? "创作记录"
                : tab === "settings"
                  ? "账号设置"
                  : "我的作品"}
        </h2>
        {tab === "settings" ? (
          <div className="panel settings-panel">
            <h3>个人资料</h3>
            <p>当前昵称：{name}</p>
            <button
              className="button secondary"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
            >
              修改昵称
            </button>
            <p className="muted">账号资料与作品已保存在服务器。旧版浏览器草稿仍保留在本地，未自动上传。</p>
            <button className="button secondary" disabled={busy} onClick={async () => {
              setBusy(true); setMessage("");
              try { await api("/auth/logout", { method: "POST" }); refreshData(); }
              catch (err) { setMessage(err instanceof Error ? err.message : "退出失败"); }
              finally { setBusy(false); }
            }}>退出登录</button>
          </div>
        ) : (
          <LocalLibrary tab={tab} key={tab} />
        )}
      </section>
    </div>
  );
}

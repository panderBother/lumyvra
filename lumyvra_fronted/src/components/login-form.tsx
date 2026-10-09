"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, refreshData } from "@/lib/api";
import Link from "next/link";
import { LockKeyhole, UserRound, ArrowRight, Mail } from "lucide-react";
import { safeReturnPath } from "@/lib/auth-routing";
import { useAPI } from "@/lib/use-api";
const authMessages: Record<string, string> = {
  google_unavailable: "Google 登录暂未开通，请先使用邮箱登录或注册。",
  google_state: "登录请求已过期，请重新选择 Google 登录。",
  google_cancelled: "已取消 Google 登录，你也可以使用邮箱。",
  google_failed: "Google 登录未完成，请重试或使用邮箱。",
  google_email_exists: "此邮箱已注册，请使用邮箱密码登录。Google 账号不会自动合并已有账号。",
  rate_limited: "尝试次数过多，请稍后再试。",
};
export function LoginForm({ returnTo = "/profile", initialRegister = false, authError }: { returnTo?: string; initialRegister?: boolean; authError?: string }) {
  const [register, setRegister] = useState(initialRegister);
  const [message, setMessage] = useState(authMessages[authError || ""] || "");
  const config = useAPI<{ googleLoginEnabled: boolean; googleLoginURL: string }>("/config");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeNotice, setCodeNotice] = useState("");
  const [countdown, setCountdown] = useState(0);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const codeStarting = useRef(false);
  const googleStarting = useRef(false);
  const pending = busy || googleBusy || sendingCode;
  const router = useRouter();
  useEffect(() => {
    if (countdown <= 0) return;
    const timeout = window.setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [countdown]);
  useEffect(() => {
    // A page restored from the back/forward cache must allow another attempt.
    const reset = () => { googleStarting.current = false; setGoogleBusy(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending || googleStarting.current || codeStarting.current) return;
        const data = new FormData(e.currentTarget);
        if (register && data.get("password") !== data.get("confirmPassword")) { setMessage("两次输入的密码不一致。"); return; }
        setBusy(true); setMessage("");
        try {
          await api(`/auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password"), remember: data.get("remember") === "on", ...(register ? { code: data.get("code") } : {}) }) });
          refreshData(); router.replace(safeReturnPath(returnTo)); router.refresh();
        } catch (err) { setMessage(err instanceof Error ? err.message : "请求失败，请重试。"); }
        finally { setBusy(false); }
      }}
    >
      <button className="google-sign-in" type="button" disabled={pending || !config.loaded} aria-busy={googleBusy} onClick={() => {
        if (pending || googleStarting.current) return;
        if (!config.data?.googleLoginEnabled || !config.data.googleLoginURL) { setMessage(config.error || authMessages.google_unavailable); return; }
        googleStarting.current = true;
        setGoogleBusy(true);
        setMessage("");
        // OAuth starts at a Go endpoint and leaves the site; it requires full document navigation.
        // Use the configured callback origin to keep the OAuth cookie on the same host.
        try {
          const destination = new URL(config.data.googleLoginURL);
          destination.searchParams.set("next", safeReturnPath(returnTo));
          window.location.assign(destination.href);
        } catch {
          googleStarting.current = false;
          setGoogleBusy(false);
          setMessage("无法打开 Google 登录，请刷新页面后重试。");
        }
      }}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.2H24v8h11c-.5 2.6-1.9 4.8-4.1 6.3v5.2h6.7c3.9-3.6 6-8.8 6-15.3Z" />
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4C9.1 39.4 16 44 24 44Z" />
          <path fill="#FBBC05" d="M12.6 27.4a12 12 0 0 1 0-7.6v-5.4H5.7a20 20 0 0 0 0 18.4l6.9-5.4Z" />
          <path fill="#EA4335" d="M24 11.4c3 0 5.6 1 7.7 3l5.8-5.8C34 5.3 29.5 3.3 24 3.3c-8 0-14.9 4.6-18.3 11.1l6.9 5.4C14.2 15 18.7 11.4 24 11.4Z" />
        </svg>
        {googleBusy ? "正在前往 Google…" : "使用 Google 账号继续"}
      </button>
      {config.loaded && !config.data?.googleLoginEnabled && <p className="google-availability">{config.error ? "暂时无法连接登录服务" : "Google 登录即将开放"}</p>}
      <div className="auth-divider"><span>或使用邮箱</span></div>
      <div className="segmented">
        <button
          type="button"
          disabled={pending}
          className={!register ? "selected" : ""}
          onClick={() => {
            setRegister(false);
            setMessage("");
          }}
        >
          邮箱登录
        </button>
        <button
          type="button"
          disabled={pending}
          className={register ? "selected" : ""}
          onClick={() => {
            setRegister(true);
            setMessage("");
          }}
        >
          邮箱注册
        </button>
      </div>
      <label className="auth-field">
        <UserRound size={18} />
        <input
          type="email"
          ref={emailInput}
          name="email"
          disabled={pending}
          onChange={() => { setCodeNotice(""); setMessage(""); if (codeInput.current) codeInput.current.value = ""; }}
          required
          placeholder="请输入邮箱"
          aria-label="邮箱"
          autoComplete="email"
        />
      </label>
      {register && <>
        <div className="auth-field auth-code-field">
          <Mail size={18} aria-hidden="true" />
          <input ref={codeInput} name="code" type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="6 位邮箱验证码" aria-label="邮箱验证码" aria-describedby={codeNotice ? "code-notice" : undefined} />
          <button type="button" className="auth-code-send" disabled={pending || countdown > 0} onClick={async () => {
            if (pending || codeStarting.current || countdown > 0 || !emailInput.current?.reportValidity()) return;
            const email = emailInput.current.value.trim();
            codeStarting.current = true;
            setSendingCode(true); setMessage(""); setCodeNotice("");
            try {
              const result = await api<{ retryAfter: number }>("/auth/register/code", { method: "POST", body: JSON.stringify({ email }) });
              setCountdown(result.retryAfter);
              if (codeInput.current) { codeInput.current.value = ""; codeInput.current.focus(); }
              setCodeNotice(`验证码已发送至 ${email}，10 分钟内有效，请查看收件箱或垃圾邮件。`);
            } catch (err) { setMessage(err instanceof Error ? err.message : "验证码发送失败，请重试。"); }
            finally { codeStarting.current = false; setSendingCode(false); }
          }}>{sendingCode ? "发送中…" : countdown > 0 ? `${countdown} 秒后重发` : "获取验证码"}</button>
        </div>
        {codeNotice && <p id="code-notice" className="auth-code-notice" role="status">{codeNotice}</p>}
      </>}
      <label className="auth-field">
        <LockKeyhole size={18} />
        <input
          type="password"
          name="password"
          required
          minLength={8}
          maxLength={128}
          placeholder="请输入密码（至少 8 位）"
          aria-label="密码"
          autoComplete={register ? "new-password" : "current-password"}
        />
      </label>
      {register && <label className="auth-field">
        <LockKeyhole size={18} />
        <input type="password" name="confirmPassword" required minLength={8} maxLength={128} placeholder="再次输入密码" aria-label="确认密码" autoComplete="new-password" />
      </label>}
      <div className="auth-meta">
        <label>
          <input type="checkbox" name="remember" />{" "}
          记住登录状态（30 天）
        </label>
        <Link href="/">先逛逛首页</Link>
      </div>
      <button className="button gradient" type="submit" disabled={pending}>
        {busy ? "正在处理…" : register ? "创建账号" : "登录"} <ArrowRight size={17} />
      </button>
      {message && (
        <div className="auth-message form-error" role="alert">
          <p>{message}</p>
        </div>
      )}
      <p className="auth-disclaimer">让灵感自由生长，让音乐与你相伴。</p>
    </form>
  );
}

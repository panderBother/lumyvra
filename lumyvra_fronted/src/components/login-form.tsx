"use client";
import { useState } from "react";
import Link from "next/link";
import { LockKeyhole, UserRound, ArrowRight, Check } from "lucide-react";
export function LoginForm() {
  const [register, setRegister] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(
          register
            ? "注册表单校验通过。当前为静态原型，尚未创建真实账号。"
            : "登录表单校验通过。当前为静态原型，可进入演示个人中心。",
        );
      }}
    >
      <div className="segmented">
        <button
          type="button"
          className={!register ? "selected" : ""}
          onClick={() => {
            setRegister(false);
            setMessage("");
          }}
        >
          登录
        </button>
        <button
          type="button"
          className={register ? "selected" : ""}
          onClick={() => {
            setRegister(true);
            setMessage("");
          }}
        >
          注册
        </button>
      </div>
      <label className="auth-field">
        <UserRound size={18} />
        <input
          type="email"
          required
          placeholder="请输入邮箱"
          aria-label="邮箱"
          autoComplete="email"
        />
      </label>
      <label className="auth-field">
        <LockKeyhole size={18} />
        <input
          type="password"
          required
          minLength={6}
          placeholder="请输入密码（至少 6 位）"
          aria-label="密码"
          autoComplete={register ? "new-password" : "current-password"}
        />
      </label>
      <div className="auth-meta">
        <label>
          <input type="checkbox" required={register} />{" "}
          {register ? "我已了解这是演示注册页面" : "记住我"}
        </label>
        <Link href="/help">需要帮助？</Link>
      </div>
      <button className="button gradient" type="submit">
        {register ? "注册" : "登录"} <ArrowRight size={17} />
      </button>
      {message && (
        <div className="auth-message" role="status">
          <Check size={17} />
          <p>{message}</p>
          <Link href="/profile">进入演示账号 →</Link>
        </div>
      )}
      <p className="auth-disclaimer">让灵感自由生长，让音乐与你相伴。</p>
    </form>
  );
}

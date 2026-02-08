"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, logout } from "../lib/api";
import { parseJwt } from "../lib/auth";
import Image from "next/image";

export default function Page() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function onlyDigits(value: string, max = 11) {
  return value.replace(/\D/g, "").slice(0, max);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    try {
      const token = await loginUser(phone, password);

      const payload = parseJwt(token);

      if (payload.is_admin) {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (err: any) {
      setMsg("❌ Неверный телефон или пароль");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Autoray</h1>
        <p className="text-sm text-gray-500 mt-1">Вход по телефону</p>

        <form onSubmit={onLogin} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Телефон (87...)"
            inputMode="numeric"
            pattern="[0-9]*"
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value, 11))}
          />
          <input
            className="w-full rounded-xl border p-3"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full rounded-xl bg-black text-white p-3">
            Войти
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="w-full rounded-xl border border-black p-3 text-black hover:bg-gray-100"
          >
            Регистрация
          </button>
        </div>

        {msg && <p className="mt-4 text-sm">{msg}</p>}
      </div>
    </main>
  );
}

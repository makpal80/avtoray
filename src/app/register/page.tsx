"use client";

import { useState } from "react";
import { registerUser, loginUser } from "../../lib/api";
import { parseJwt } from "../../lib/auth";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", password: "", name: "", car_brand: "" });
  const [msg, setMsg] = useState<string | null>(null);

  function onlyDigits(value: string, max = 11) {
  return value.replace(/\D/g, "").slice(0, max);
 }

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setMsg(null);

  try {
    // регистрация
    await registerUser(form);

    // автологин
    const token = await loginUser(form.phone, form.password);

    // проверка роли
    const payload = parseJwt(token);

    if (payload.is_admin) {
      router.push("/admin");
    } else {
      router.push("/user");
    }
  } catch (err: any) {
    setMsg("❌ " + err.message);
  }
}


  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Регистрация</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Телефон (87...)"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.phone}
            onChange={(e) =>
                setForm({ ...form, phone: onlyDigits(e.target.value, 11) })
            }
            />
          <input className="w-full rounded-xl border p-3" placeholder="Имя" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-xl border p-3" placeholder="Марка авто" value={form.car_brand}
            onChange={(e) => setForm({ ...form, car_brand: e.target.value })} />
          <input className="w-full rounded-xl border p-3" placeholder="Пароль" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />

          <button className="w-full rounded-xl bg-black text-white p-3">
            Создать аккаунт
          </button>
        </form>

        <a className="mt-4 block text-sm underline" href="/">← Назад к входу</a>

        {msg && <p className="mt-4 text-sm">{msg}</p>}
      </div>
    </main>
  );
}

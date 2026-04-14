"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("ログインリンクを送信しました。メールを確認してください。");
  };

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <input
        type="email"
        className="w-full rounded border p-2"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="rounded bg-black px-4 py-2 text-white"
      >
        ログインリンク送信
      </button>
      {message && <p>{message}</p>}
    </main>
  );
}

"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-10">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="block text-[15px] text-zinc-900">
        비밀번호
      </label>
      <input
        id="password"
        type="password"
        name="password"
        autoFocus
        required
        aria-invalid={!!state.error}
        className="mt-2.5 h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-[15px] outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 aria-invalid:border-red-300"
      />
      {state.error && <p className="mt-2 text-[13px] text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-3.5 h-11 w-full rounded-xl bg-zinc-900 text-[15px] text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "확인 중..." : "들어가기"}
      </button>
    </form>
  );
}

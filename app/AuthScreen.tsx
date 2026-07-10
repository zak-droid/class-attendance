"use client";

import { useState, type FormEvent } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const approvedTeachers = new Set([
    "rotman555@gmail.com",
    "tsachiachrak@gmail.com",
    "dotanhaim@gmail.com",
  ]);

  const db = supabase;

  if (!isSupabaseConfigured || !db) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-extrabold tracking-[-0.035em]">Shared setup is almost ready</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#66716B]">The secure shared database still needs to be connected before teachers can sign in.</p>
      </AuthShell>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!approvedTeachers.has(normalizedEmail)) {
      setError("This email is not on the approved teacher list.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: signInError } = await db.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: "https://zak-droid.github.io/class-attendance/",
        shouldCreateUser: true,
      },
    });
    if (signInError) {
      setError("The sign-in email could not be sent. Please try again.");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <AuthShell>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#174A3A]">Teacher sign in</p>
      <h1 className="text-2xl font-extrabold tracking-[-0.035em]">Welcome to Class Attendance</h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#66716B]">Enter your approved email. Weâ€™ll send you a secure sign-in linkâ€”no password needed.</p>
      {sent ? (
        <div className="mt-6 rounded-2xl border border-[#C9E0D4] bg-[#E0EEE7] p-4 text-sm font-bold leading-6 text-[#22684D]" role="status">
          Check your email and tap the sign-in link. You can close this page after the email arrives.
          <button type="button" onClick={() => setSent(false)} className="mt-3 block min-h-10 rounded-xl border border-[#22684D]/20 bg-white px-3 text-xs font-extrabold">Use another email</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-extrabold text-[#66716B]">Email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-2xl border border-[#DCE4DF] bg-white px-3.5 text-sm font-semibold outline-none focus:border-[#174A3A] focus:ring-2 focus:ring-[#174A3A]/15" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-[#F8E2E1] px-3 py-2 text-sm font-bold text-[#A13D3D]">{error}</p>}
          <button disabled={loading} type="submit" className="min-h-12 w-full rounded-2xl bg-[#174A3A] px-4 text-sm font-extrabold text-white hover:bg-[#103D2F] disabled:bg-[#A9B5AF]">{loading ? "Sending linkâ€¦" : "Email me a sign-in link"}</button>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-bg grid min-h-[100svh] place-items-center bg-[#EEF2EF] p-4">
      <section className="w-full max-w-md rounded-[24px] border border-[#DCE4DF] bg-white p-6 shadow-[0_20px_60px_rgba(20,52,41,0.12)] sm:p-8">
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#174A3A] text-sm font-extrabold text-white">CA</div>
        {children}
      </section>
    </main>
  );
}

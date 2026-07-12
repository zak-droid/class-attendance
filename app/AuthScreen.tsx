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
        <h1 className="text-2xl font-extrabold tracking-[-0.035em]">ההגדרה המשותפת כמעט מוכנה</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#475569]">יש לחבר את מסד הנתונים המשותף והמאובטח לפני שהמורים יוכלו להיכנס.</p>
      </AuthShell>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!approvedTeachers.has(normalizedEmail)) {
      setError("האימייל הזה אינו ברשימת המורים המאושרים.");
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
      setError("לא הצלחנו לשלוח את קישור הכניסה. נסו שוב.");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <AuthShell>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#002B45]">כניסת מורים</p>
      <h1 className="text-2xl font-extrabold tracking-[-0.035em]">ברוכים הבאים לניהול נוכחות</h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#475569]">הזינו את כתובת האימייל המאושרת שלכם. נשלח אליכם קישור כניסה מאובטח — ללא סיסמה.</p>
      {sent ? (
        <div className="mt-6 rounded-2xl border border-[#16A34A]/20 bg-[#DCFCE7] p-4 text-sm font-bold leading-6 text-[#166534]" role="status">
          בדקו את האימייל ולחצו על קישור הכניסה. אפשר לסגור את הדף לאחר שההודעה מגיעה.
          <button type="button" onClick={() => setSent(false)} className="mt-3 block min-h-10 rounded-xl border border-[#166534]/20 bg-[#FFFFFF] px-3 text-xs font-extrabold">שימוש באימייל אחר</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-extrabold text-[#475569]">אימייל
            <input required type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-left text-sm font-semibold outline-none focus:border-[#00A6A6] focus:ring-2 focus:ring-[#00A6A6]/20" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-bold text-[#991B1B]">{error}</p>}
          <button disabled={loading} type="submit" className="min-h-12 w-full rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white hover:bg-[#00B3A4] disabled:bg-[#64748B]">{loading ? "שולחים קישור…" : "שלחו לי קישור כניסה"}</button>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center p-4 text-right">
      <section className="w-full max-w-md rounded-[26px] border border-white/15 bg-white p-6 shadow-[0_26px_80px_rgba(0,18,27,0.4)] sm:p-8">
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#002B45] text-white shadow-[0_10px_24px_rgba(0,18,27,0.28)]" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M5 12l4 4L19 6" /><path d="M4 4h16v16H4z" /></svg>
        </div>
        {children}
      </section>
    </main>
  );
}


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
        <p className="mt-3 text-sm font-medium leading-6 text-[#6F766F]">יש לחבר את מסד הנתונים המשותף והמאובטח לפני שהמורים יוכלו להיכנס.</p>
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
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#0F3D2E]">כניסת מורים</p>
      <h1 className="text-2xl font-extrabold tracking-[-0.035em]">ברוכים הבאים לניהול נוכחות</h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#6F766F]">הזינו את כתובת האימייל המאושרת שלכם. נשלח אליכם קישור כניסה מאובטח — ללא סיסמה.</p>
      {sent ? (
        <div className="mt-6 rounded-2xl border border-[#D1E2C8] bg-[#E6F0DF] p-4 text-sm font-bold leading-6 text-[#265F3C]" role="status">
          בדקו את האימייל ולחצו על קישור הכניסה. אפשר לסגור את הדף לאחר שההודעה מגיעה.
          <button type="button" onClick={() => setSent(false)} className="mt-3 block min-h-10 rounded-xl border border-[#265F3C]/20 bg-[#FFFDF8] px-3 text-xs font-extrabold">שימוש באימייל אחר</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-extrabold text-[#6F766F]">אימייל
            <input required type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-2xl border border-[#E5DDD0] bg-[#FFFDF8] px-3.5 text-left text-sm font-semibold outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/15" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-[#F8E3DE] px-3 py-2 text-sm font-bold text-[#A5483D]">{error}</p>}
          <button disabled={loading} type="submit" className="min-h-12 w-full rounded-2xl bg-[#0F3D2E] px-4 text-sm font-extrabold text-white hover:bg-[#0B3025] disabled:bg-[#ADB3AD]">{loading ? "שולחים קישור…" : "שלחו לי קישור כניסה"}</button>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center bg-[#F8F3EA] p-4 text-right">
      <section className="w-full max-w-md rounded-[24px] border border-[#E5DDD0] bg-[#FFFDF8] p-6 shadow-[0_20px_60px_rgba(69,52,33,0.12)] sm:p-8">
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#0F3D2E] text-sm font-extrabold text-white">נכ</div>
        {children}
      </section>
    </main>
  );
}

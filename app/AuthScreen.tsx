"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getBiometricRecord } from "./biometric";
import { isSupabaseConfigured, supabase } from "./supabase";

export function AuthScreen() {
  const savedBiometric = getBiometricRecord();
  const [email, setEmail] = useState(() => savedBiometric?.email ?? "");
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return params.has('error') ? 'קישור הכניסה אינו תקף או שכבר נעשה בו שימוש. הזינו אימייל לקבלת קישור חדש והשתמשו בהודעה האחרונה.' : '';
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const approvedTeachers = new Set([
    "rotman555@gmail.com",
    "tsachiachrak@gmail.com",
    "dotanhaim@gmail.com",
  ]);

  useEffect(() => {
    const record = getBiometricRecord();
    if (record?.email && !email) {
      setEmail(record.email);
    }
  }, [email]);

  const db = supabase;

  if (!isSupabaseConfigured || !db) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-extrabold tracking-[-0.035em]">מערכת נוכחות - התחברות</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#475569]">החיבור למסד הנתונים אינו מוגדר כראוי. אנא בדוק את הגדרות הסביבה.</p>
      </AuthShell>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!approvedTeachers.has(normalizedEmail)) {
      setError("כתובת האימייל אינה מורשית לגישה למערכת.");
      return;
    }
    setLoading(true);
    setError("");
    try {
    const { error: signInError } = await db.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: "https://zak-droid.github.io/class-attendance/",
        shouldCreateUser: true,
      },
    });
    if (signInError) {
      setError("אירעה שגיאה בשליחת קישור ההתחברות. אנא נסה שוב.");
    } else {
      setSent(true);
    }
    } catch { setError("שליחת הקישור נכשלה. בדקו חיבור ונסו שוב."); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#002B45]">אזור המורה</p>
      <h1 className="text-2xl font-extrabold tracking-[-0.035em]">התחברות למערכת הנוכחות</h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#475569]">זיהוי מורה - הקלד את כתובת האימייל שלך לקבלת קישור התחברות חד-פעמי.</p>
      {savedBiometric && (
        <div
          className="mt-4 rounded-2xl border border-[#005580]/20 bg-[#F4F8FA] p-3.5 text-xs font-semibold leading-5 text-[#002B45]"
          role="note"
        >
          <p className="font-extrabold text-[#005580]">זיהוי בטביעת אצבע מוגדר במכשיר זה</p>
          <p className="mt-1 text-[#475569]">
            נדרשת התחברות חד-פעמית באמצעות קישור למייל כדי לחדש את החיבור, ולאחר מכן הכניסה המהירה בטביעת אצבע תחזור לפעול אוטומטית.
          </p>
        </div>
      )}
      {sent ? (
        <div className="mt-6 rounded-2xl border border-[#16A34A]/20 bg-[#DCFCE7] p-4 text-sm font-bold leading-6 text-[#166534]" role="status">
          קישור להתחברות נשלח לכתובת האימייל שלך. אנא בדוק את תיבת הדואר הנכנס.
          <button type="button" onClick={() => setSent(false)} className="mt-3 block min-h-10 rounded-xl border border-[#166534]/20 bg-[#FFFFFF] px-3 text-xs font-extrabold">הזן כתובת אחרת</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-extrabold text-[#475569]">אימייל
            <input required type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-left text-sm font-semibold outline-none focus:border-[#00A6A6] focus:ring-2 focus:ring-[#00A6A6]/20" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-bold text-[#991B1B]">{error}</p>}
          <button disabled={loading} type="submit" className="min-h-12 w-full rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white hover:bg-[#00B3A4] disabled:bg-[#64748B]">{loading ? "שולח קישור..." : "שלח קישור התחברות"}</button>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center p-4 text-right">
      <section className="w-full max-w-md rounded-[26px] border border-white/15 bg-white p-6 shadow-[0_26px_80px_rgba(0,18,27,0.28)] sm:p-8">
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#002B45] text-white shadow-[0_10px_24px_rgba(0,18,27,0.28)]" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M5 12l4 4L19 6" /><path d="M4 4h16v16H4z" /></svg>
        </div>
        {children}
      </section>
    </main>
  );
}

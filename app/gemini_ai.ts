"use client";

import type { AISyllabusAnalysis, Course, LessonLog } from "./types";

export const GEMINI_API_KEY_STORAGE_KEY = "class_attendance_gemini_api_key_v1";
export const ANALYSIS_STORAGE_KEY = "class_attendance_syllabus_analysis_v1";

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage might be restricted
  }
  return null;
}

export function getStoredGeminiApiKey(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function saveStoredGeminiApiKey(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      storage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    } else {
      storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to save Gemini API key:", err);
  }
}

export function clearStoredGeminiApiKey(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function hasStoredGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey());
}

export function maskApiKey(key?: string | null): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.substring(0, 4)}••••••••${trimmed.substring(trimmed.length - 4)}`;
}

export function getStoredAnalysis(courseId: string): AISyllabusAnalysis | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${ANALYSIS_STORAGE_KEY}_${courseId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AISyllabusAnalysis;
  } catch {
    return null;
  }
}

export function saveStoredAnalysis(courseId: string, analysis: AISyllabusAnalysis): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${ANALYSIS_STORAGE_KEY}_${courseId}`, JSON.stringify(analysis));
  } catch {
    // Ignore
  }
}

/**
 * Quick validation test for the Gemini API key against Google AI Studio endpoint.
 */
export const GEMINI_CANDIDATE_MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-001",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
];

async function callGeminiAPI(
  apiKey: string,
  payload: unknown
): Promise<{ ok: boolean; status: number; data?: any; errorMsg?: string; modelUsed?: string }> {
  let lastErrorMsg = "";
  let lastStatus = 0;

  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, status: response.status, data, modelUsed: model };
      }

      lastStatus = response.status;
      const errorJson = await response.json().catch(() => null);
      lastErrorMsg = errorJson?.error?.message || `HTTP ${response.status}`;

      // If invalid key or permission denied, stop immediately
      if (response.status === 400 && lastErrorMsg.includes("API key")) {
        return { ok: false, status: response.status, errorMsg: lastErrorMsg };
      }
      if (response.status === 403) {
        return { ok: false, status: response.status, errorMsg: lastErrorMsg };
      }
    } catch (err) {
      lastErrorMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return { ok: false, status: lastStatus, errorMsg: lastErrorMsg };
}

export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, message: "מפתח API ריק. אנא הדבק מפתח תקין." };
  }

  try {
    const res = await callGeminiAPI(key, {
      contents: [
        {
          parts: [{ text: "השב במילה אחת בלבד בעברית: מחובר" }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 10,
      },
    });

    if (!res.ok) {
      return {
        success: false,
        message: `אימות המפתח נכשל: ${res.errorMsg || "שגיאה בחיבור לגוגל"}`,
      };
    }

    return {
      success: true,
      message: `המפתח אומת בהצלחה! חיבור פעיל לגוגל ג'מיני (${res.modelUsed}).`,
    };
  } catch (err) {
    return {
      success: false,
      message: `שגיאת רשת בעת בדיקת המפתח: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Extracts syllabus topic items from free text / markdown.
 */
export function extractSyllabusTopics(syllabusText?: string): string[] {
  if (!syllabusText || !syllabusText.trim()) return [];

  const lines = syllabusText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const topics: string[] = [];

  for (const line of lines) {
    // Remove leading numbering (e.g. "1.", "מפגש 1:", "- ", "* ")
    const cleaned = line
      .replace(/^(\d+[\.\-\)]|\*|\-|\•|מפגש\s*\d+[:\-\.]?|שיעור\s*\d+[:\-\.]?)\s*/i, "")
      .trim();

    if (cleaned.length > 2) {
      topics.push(cleaned);
    }
  }

  return topics.length > 0 ? topics : [syllabusText.trim()];
}

/**
 * Smart heuristic analysis used when Gemini API key is not present or offline.
 */
export function performHeuristicAnalysis(
  course: Course,
  lessons: LessonLog[]
): AISyllabusAnalysis {
  const topics = extractSyllabusTopics(course.syllabus);
  const courseLessons = lessons.filter((l) => l.courseId === course.id);

  if (topics.length === 0) {
    return {
      coveragePercent: 0,
      coveredTopics: [],
      pendingTopics: [],
      recommendationForNextLesson: "טרם הוזן סילבוס לקורס. אנא הזינו את ראשי הפרקים של הסילבוס בלשונית ניהול קורסים.",
      repetitionWarnings: [],
      analyzedAt: new Date().toISOString(),
      usedGeminiAI: false,
    };
  }

  const covered: string[] = [];
  const pending: string[] = [];

  // Helper to extract significant Hebrew keywords (length >= 3)
  function getTokens(str: string): string[] {
    return str
      .toLowerCase()
      .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  }

  const lessonTokens = courseLessons.map((l) => ({
    lesson: l,
    tokens: getTokens(`${l.topic} ${l.summary || ""}`),
    topicText: `${l.topic} ${l.summary || ""}`.toLowerCase(),
  }));

  for (const topic of topics) {
    const topicTokens = getTokens(topic);
    const topicLower = topic.toLowerCase();

    // Check if any lesson mentions this topic or shares multiple key tokens
    const isMatched = lessonTokens.some(({ topicText, tokens }) => {
      if (topicText.includes(topicLower) || topicLower.includes(topicText)) {
        return true;
      }
      const shared = topicTokens.filter((tok) => tokens.includes(tok));
      return shared.length >= Math.min(2, topicTokens.length);
    });

    if (isMatched) {
      covered.push(topic);
    } else {
      pending.push(topic);
    }
  }

  const coveragePercent = Math.round((covered.length / topics.length) * 100);

  // Check for repeated topics across lessons
  const repetitionWarnings: string[] = [];
  for (let i = 0; i < courseLessons.length; i += 1) {
    for (let j = i + 1; j < courseLessons.length; j += 1) {
      const l1 = courseLessons[i];
      const l2 = courseLessons[j];
      const tokens1 = getTokens(l1.topic);
      const tokens2 = getTokens(l2.topic);
      const shared = tokens1.filter((t) => tokens2.includes(t));

      if (shared.length >= 2 || (l1.topic.length > 4 && l1.topic === l2.topic)) {
        const teachers =
          l1.instructorEmail && l2.instructorEmail && l1.instructorEmail !== l2.instructorEmail
            ? ` (הועבר ע"י ${l1.instructorEmail} ב-${l1.date} וע"י ${l2.instructorEmail} ב-${l2.date})`
            : ` (במפגשים ${l1.date} ו-${l2.date})`;

        repetitionWarnings.push(
          `חזרתיות אפשרית בנושא "${l1.topic}"${teachers}. כדאי לוודא שמדובר בהעמקה מתוכננת ולא בחזרה מיותרת.`
        );
      }
    }
  }

  // Next lesson recommendation
  let recommendation = "";
  if (pending.length > 0) {
    const nextTopic = pending[0];
    const secondTopic = pending[1] ? ` ולאחריו "${pending[1]}"` : "";
    recommendation = `במפגש הבא מומלץ להתמקד בהשלמת הנושא: "${nextTopic}"${secondTopic}, בהתאם לקצב ההתקדמות בסילבוס.`;
  } else if (topics.length > 0) {
    recommendation = `כל נושאי הסילבוס המוגדרים כוסו במלואם! מומלץ להקדיש את המפגש הקרוב למשוב מסכם, תרגול פרקטיקום וסגירת חובות לקראת תעודה.`;
  }

  return {
    coveragePercent,
    coveredTopics: covered,
    pendingTopics: pending,
    recommendationForNextLesson: recommendation,
    repetitionWarnings: Array.from(new Set(repetitionWarnings)),
    analyzedAt: new Date().toISOString(),
    usedGeminiAI: false,
  };
}

/**
 * Main AI analysis engine:
 * Calls Google Gemini 1.5 Flash if API key is provided, or seamlessly falls back to heuristic matching.
 */
export async function analyzeCourseSyllabus(
  course: Course,
  lessons: LessonLog[],
  overrideApiKey?: string
): Promise<AISyllabusAnalysis> {
  const apiKey = (overrideApiKey || getStoredGeminiApiKey() || "").trim();
  const courseLessons = lessons.filter((l) => l.courseId === course.id);

  if (!course.syllabus || !course.syllabus.trim()) {
    return {
      coveragePercent: 0,
      coveredTopics: [],
      pendingTopics: [],
      recommendationForNextLesson:
        "טרם הוזן סילבוס לקורס זה. לחצו על 'עריכת סילבוס' כדי להדביק את ראשי הפרקים של הקורס.",
      repetitionWarnings: [],
      analyzedAt: new Date().toISOString(),
      usedGeminiAI: false,
    };
  }

  // If no Gemini API key, use the smart built-in heuristic analysis
  if (!apiKey) {
    const fallback = performHeuristicAnalysis(course, lessons);
    saveStoredAnalysis(course.id, fallback);
    return fallback;
  }

  // Call Google Gemini API
  try {
    const lessonsSummary = courseLessons
      .map(
        (l, idx) =>
          `מפגש ${idx + 1} (${l.date}${l.instructorEmail ? ` ע"י ${l.instructorEmail}` : ""}): נושא: "${l.topic}"${
            l.summary ? ` | תקציר: "${l.summary}"` : ""
          }`
      )
      .join("\n");

    const prompt = `אתה יועץ פדגוגי ומומחה לבקרת תוכניות לימודים במערכת לניהול קורסים והנחיית קבוצות.
עליך לנתח את קצב התקדמות הקורס ביחס לסילבוס הרשמי, לזהות אילו נושאים כוסו, מה נותר, להמליץ על נושא ממוקד למפגש הבא, ולהתריע אם קיימת חזרתיות מיותרת בין מנחים או מפגשים.

שם הקורס: ${course.name}
${course.description ? `תיאור הקורס: ${course.description}\n` : ""}

סילבוס הקורס המלא (ראשי פרקים):
"""
${course.syllabus}
"""

מפגשים שנלמדו בפועל עד כה:
"""
${lessonsSummary || "טרם נרשמו מפגשים בקורס זה."}
"""

אנא נתח בקפידה והשב אך ורק במבנה JSON תקני (בלי markdown ובלי שום טקסט נוסף מחוץ ל-JSON), במבנה המדויק הבא:
{
  "coveragePercent": 65,
  "coveredTopics": ["נושא 1 שכוסה", "נושא 2 שכוסה"],
  "pendingTopics": ["נושא 3 שטרם נלמד", "נושא 4 שטרם נלמד"],
  "recommendationForNextLesson": "המלצה ממוקדת, חמה ופרקטית בעברית למנחה לקראת המפגש הבא, כולל מה הנושא שהכי כדאי ללמד כעת",
  "repetitionWarnings": ["התראה מפורטת על נושא שנלמד יותר מפעם אחת ללא צורך, או מערך ריק [] אם אין שום חזרתיות"]
}`;

    const apiRes = await callGeminiAPI(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    if (!apiRes.ok || !apiRes.data) {
      console.warn(`Gemini API returned error ${apiRes.status}: ${apiRes.errorMsg}, falling back to heuristic.`);
      const fallback = performHeuristicAnalysis(course, lessons);
      saveStoredAnalysis(course.id, fallback);
      return fallback;
    }

    const resJson = apiRes.data;
    const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      const fallback = performHeuristicAnalysis(course, lessons);
      saveStoredAnalysis(course.id, fallback);
      return fallback;
    }

    // Parse JSON safely
    const parsed = JSON.parse(rawText);

    const result: AISyllabusAnalysis = {
      coveragePercent: Math.max(0, Math.min(100, Math.round(Number(parsed.coveragePercent) || 0))),
      coveredTopics: Array.isArray(parsed.coveredTopics) ? parsed.coveredTopics : [],
      pendingTopics: Array.isArray(parsed.pendingTopics) ? parsed.pendingTopics : [],
      recommendationForNextLesson:
        typeof parsed.recommendationForNextLesson === "string" && parsed.recommendationForNextLesson.trim()
          ? parsed.recommendationForNextLesson.trim()
          : "המשך לפי קצב הסילבוס המתוכנן.",
      repetitionWarnings: Array.isArray(parsed.repetitionWarnings) ? parsed.repetitionWarnings : [],
      analyzedAt: new Date().toISOString(),
      usedGeminiAI: true,
    };

    saveStoredAnalysis(course.id, result);
    return result;
  } catch (error) {
    console.warn("Failed to complete Gemini API syllabus analysis, using heuristic:", error);
    const fallback = performHeuristicAnalysis(course, lessons);
    saveStoredAnalysis(course.id, fallback);
    return fallback;
  }
}
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


/**
 * Reads a File as base64 string (browser environment).
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts raw text from uncompressed or FlateDecode PDF streams in the browser.
 */
export async function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latin1Decoder = new TextDecoder("latin1");
  const raw = latin1Decoder.decode(bytes);

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  const extractedLines: string[] = [];
  const DS = (globalThis as any).DecompressionStream;

  while ((match = streamRegex.exec(raw)) !== null) {
    const streamStart = match.index + match[0].indexOf("\n") + 1;
    const streamContentLength = match[1].length;
    const streamBytes = bytes.slice(streamStart, streamStart + streamContentLength);

    let decompressed = "";
    if (typeof DS === "function") {
      try {
        const ds = new DS("deflate");
        const writer = ds.writable.getWriter();
        writer.write(streamBytes);
        writer.close();
        const res = await new Response(ds.readable).arrayBuffer();
        decompressed = new TextDecoder("utf-8", { fatal: false }).decode(res);
      } catch {
        decompressed = match[1];
      }
    } else {
      decompressed = match[1];
    }

    // Extract text in (...) Tj or [...] TJ
    const tjRegex = /\(([^)]+)\)\s*T[jJ]|\[([^\]]+)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
      if (tjMatch[1]) {
        const cleaned = tjMatch[1].replace(/\\([()\\])/g, "$1").trim();
        if (cleaned.length > 2 && !cleaned.startsWith("/")) extractedLines.push(cleaned);
      } else if (tjMatch[2]) {
        const parts = tjMatch[2].match(/\(([^)]*)\)/g);
        if (parts) {
          const combined = parts
            .map((p) => p.slice(1, -1).replace(/\\([()\\])/g, "$1"))
            .join("")
            .trim();
          if (combined.length > 2 && !combined.startsWith("/")) extractedLines.push(combined);
        }
      }
    }
  }

  const topics = extractedLines
    .filter((l) => !l.startsWith("/") && !l.includes("PDF") && l.length > 2)
    .slice(0, 30);

  if (topics.length === 0) return "";
  return topics.map((t, idxNum) => `${idxNum + 1}. ${t}`).join("\n");
}

/**
 * Main handler to extract syllabus topics from a PDF file:
 * Uses Google Gemini AI if API key is stored, or falls back to client-side stream decoding.
 */
export async function extractSyllabusFromPdfFile(
  file: File,
  overrideApiKey?: string
): Promise<{ success: boolean; text: string; usedGemini: boolean; message?: string }> {
  const apiKey = (overrideApiKey || getStoredGeminiApiKey() || "").trim();

  if (apiKey) {
    try {
      const base64Data = await fileToBase64(file);
      const prompt = `אתה עוזר פדגוגי מומחה. לפניך קובץ סילבוס / תוכנית לימודים בפורמט PDF.
אנא קרא את תוכן הקובץ וחלץ מתוכו את כל ראשי הפרקים, המפגשים ונושאי הלימוד.
החזר אך ורק רשימה נקייה וממוספרת בעברית של נושאי הלימוד (למשל:
1. פתיחה וחוזה קבוצתי
2. שלבי התפתחות קבוצה
3. משוב עמיתים
וכך הלאה), שורה אחר שורה, ללא שום מילות הקדמה, סיכום או הערות נוספות.`;

      const apiRes = await callGeminiAPI(apiKey, {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      });

      if (apiRes.ok && apiRes.data) {
        const text = apiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return {
            success: true,
            text: text.trim(),
            usedGemini: true,
            message: `פוענח בהצלחה באמצעות Gemini AI (${apiRes.modelUsed})`,
          };
        }
      }
    } catch (err) {
      console.warn("Gemini PDF extraction failed, falling back to local extractor:", err);
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const localText = await extractTextFromPdfArrayBuffer(arrayBuffer);
    if (localText && localText.trim()) {
      return {
        success: true,
        text: localText.trim(),
        usedGemini: false,
        message: "פוענח באמצעות מנוע פיענוח מקומי",
      };
    }
  } catch (err) {
    console.warn("Local PDF extraction error:", err);
  }

  return {
    success: false,
    text: "",
    usedGemini: false,
    message: "לא זוהה טקסט בתוך קובץ ה-PDF. לקריאה חכמה של סריקות ו-PDF, אנא הגדירו מפתח Gemini API בלשונית עוד, או העתיקו והדביקו את ראשי הפרקים ישירות.",
  };
}

async function inflateRawZipEntry(compData: Uint8Array): Promise<ArrayBuffer | null> {
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== "function") return null;

  try {
    const ds = new DS("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compData);
    writer.close();
    return await new Response(ds.readable).arrayBuffer();
  } catch {
    try {
      const wrapped = new Uint8Array(compData.length + 2);
      wrapped[0] = 0x78;
      wrapped[1] = 0x9c;
      wrapped.set(compData, 2);
      const ds = new DS("deflate");
      const reader = ds.readable.getReader();
      const writer = ds.writable.getWriter();
      writer.write(wrapped).catch(() => {});
      writer.close().catch(() => {});
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.byteLength;
          }
        }
      } catch {
        // Ignore Adler-32 trailer mismatch at end of stream
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return out.buffer;
    } catch {
      return null;
    }
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Built-in local .xlsx parser (reads ZIP Central Directory, xl/sharedStrings.xml, and xl/worksheets/sheet1.xml)
 * Works 100% locally in the browser without requiring a Gemini API key.
 */
export async function extractTextFromXlsxArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 22) return "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return "";

  const cdCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, { compression: number; compSize: number; localHeaderOffset: number }>();
  let ptr = cdOffset;
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i < cdCount; i += 1) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) break;
    const compression = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    entries.set(name, { compression, compSize, localHeaderOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  async function readEntryText(name: string): Promise<string | null> {
    const entry = entries.get(name);
    if (!entry) return null;
    const lh = entry.localHeaderOffset;
    if (lh + 30 > bytes.length || view.getUint32(lh, true) !== 0x04034b50) return null;
    const lhNameLen = view.getUint16(lh + 26, true);
    const lhExtraLen = view.getUint16(lh + 28, true);
    const dataStart = lh + 30 + lhNameLen + lhExtraLen;
    const compData = bytes.subarray(dataStart, dataStart + entry.compSize);

    if (entry.compression === 0) {
      return decoder.decode(compData);
    }
    if (entry.compression === 8) {
      const outBuf = await inflateRawZipEntry(compData);
      if (outBuf && outBuf.byteLength > 0) {
        return decoder.decode(outBuf);
      }
    }
    return null;
  }

  const sharedStrings: string[] = [];
  const ssXml = await readEntryText("xl/sharedStrings.xml");
  if (ssXml) {
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
        parts.push(decodeXmlEntities(tMatch[1]));
      }
      sharedStrings.push(parts.join(""));
    }
  }

  const sheetName =
    Array.from(entries.keys()).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)) ||
    "xl/worksheets/sheet1.xml";
  const sheetXml = await readEntryText(sheetName);
  if (!sheetXml) return "";

  const rows: string[] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const content = cellMatch[2];
      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch ? typeMatch[1] : "";
      let val = "";
      if (cellType === "s") {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(content);
        if (vMatch) {
          const sIdx = parseInt(vMatch[1].trim(), 10);
          val = sharedStrings[sIdx] ?? "";
        }
      } else if (cellType === "inlineStr" || content.includes("<is>")) {
        const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(content);
        if (tMatch) val = decodeXmlEntities(tMatch[1]);
      } else {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(content);
        if (vMatch) val = decodeXmlEntities(vMatch[1].trim());
      }
      if (val.trim()) cells.push(val.trim());
    }
    if (cells.length > 0) {
      rows.push(cells.join("\t"));
    }
  }
  return rows.join("\n");
}

/**
 * Extracts student rows from an Excel spreadsheet (.xlsx, .xls) using local parser first,
 * and falls back to Gemini AI if needed.
 */
export async function extractStudentsFromExcelFile(
  file: File,
  overrideApiKey?: string
): Promise<{ success: boolean; text: string; message: string }> {
  // 1. Try fast local .xlsx extraction first (works offline and without API key)
  try {
    const buf = await file.arrayBuffer();
    const localRows = await extractTextFromXlsxArrayBuffer(buf);
    if (localRows && localRows.trim()) {
      return {
        success: true,
        text: localRows.trim(),
        message: `קובץ האקסל ${file.name} נקרא בהצלחה!`,
      };
    }
  } catch (err) {
    console.warn("Local XLSX parser fallback:", err);
  }

  // 2. Fallback to Gemini AI if API key is available
  const apiKey = (overrideApiKey || getStoredGeminiApiKey() || "").trim();
  if (!apiKey) {
    return {
      success: false,
      text: "",
      message: "לא ניתן היה לקרוא את קובץ האקסל הישן (.xls). אנא שמרו כקובץ Excel מודרני (.xlsx) או CSV, או העתיקו את השורות והדביקו בתיבה.",
    };
  }

  try {
    const base64Data = await fileToBase64(file);
    const res = await callGeminiAPI(apiKey, {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                data: base64Data,
              },
            },
            {
              text: "חלץ מתוך קובץ האקסל הזה את רשימת כל שמות הסטודנטים והאימיילים שלהם. החזר שורה לכל סטודנט במבנה: שם מלא, אימייל (אם קיים). ללא שום עמודות נוספות וללא הקדמות.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    if (res.ok && res.data) {
      const parsed = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (parsed && parsed.trim()) {
        return {
          success: true,
          text: parsed.trim(),
          message: `קובץ האקסל ${file.name} פוענח בהצלחה באמצעות Gemini AI!`,
        };
      }
    }

    return {
      success: false,
      text: "",
      message: "לא ניתן היה לפענח את קובץ האקסל. מומלץ לשמור כ-CSV או להעתיק את עמודת השמות.",
    };
  } catch (err) {
    return {
      success: false,
      text: "",
      message: `שגיאה בפיענוח קובץ האקסל: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

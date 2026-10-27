"use client";

import { useMemo, useState } from "react";
import type { AppTab, Course } from "./types";

export interface InstructorFeedbackItem {
  id: string;
  type: "bug" | "relocation" | "text_change" | "feature_request" | "question";
  screen: string;
  description: string;
  userEmail: string;
  createdAt: string;
  deviceInfo: string;
}

const STORAGE_KEY_FEEDBACKS = "class_attendance_instructor_feedbacks_v1";

function getStoredFeedbacks(): InstructorFeedbackItem[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_FEEDBACKS);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return [];
}

function saveFeedbacksToStorage(items: InstructorFeedbackItem[]): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_FEEDBACKS, JSON.stringify(items));
    }
  } catch {
    // Ignore
  }
}

export interface FAQItem {
  id: string;
  category: "attendance" | "students" | "tasks" | "syllabus" | "reports" | "auth";
  categoryLabel: string;
  question: string;
  answer: string;
  actionLabel?: string;
  actionTab?: AppTab;
  actionMoreView?: "courses" | "students" | "tasks";
}

export const COMPREHENSIVE_FAQ_LIST: FAQItem[] = [
  // 1. תלמידים, קבוצות וייבוא
  {
    id: "delete-student",
    category: "students",
    categoryLabel: "תלמידים ואקסל",
    question: "איך מוחקים או מסירים סטודנט שלא רשום לקורס?",
    answer:
      "כדי להגן על היסטוריית הנוכחות ועל דוחות העבר, המערכת משתמשת כרגע במנגנון 'השבתה': נכנסים ללשונית עוד ➔ ניהול תלמידים, לוחצים על תפריט 3 הנקודות (•••) ליד שם התלמיד ובוחרים 'השבתה'. התלמיד יוסר מיד מניהול הנוכחות היומית של הכיתה מבלי להרוס היסטוריה קודמת. (בקרוב יתווסף גם כפתור מחיקה סופית ישיר למי שנוסף בטעות).",
    actionLabel: "מעבר לניהול תלמידים",
    actionTab: "more",
    actionMoreView: "students",
  },
  {
    id: "import-excel",
    category: "students",
    categoryLabel: "תלמידים ואקסל",
    question: "איך מייבאים רשימת סטודנטים מקובץ אקסל?",
    answer:
      "נכנסים ללשונית עוד ➔ ייבוא תלמידים. ניתן ללחוץ על '📁 העלאת קובץ אקסל / CSV' ולטעון ישירות את הקובץ שלכם, או להדביק שורות מכל קובץ אקסל. המערכת חכמה ומחלצת אוטומטית רק את שמות התלמידים (והאימייל אם קיים), ומתעלמת מעמודות עודפות כמו ת.ז, טלפונים וכו'.",
    actionLabel: "מעבר לייבוא תלמידים",
    actionTab: "more",
  },
  {
    id: "edit-student-course",
    category: "students",
    categoryLabel: "תלמידים ואקסל",
    question: "איך מעבירים תלמיד מכיתה לכיתה או עורכים את פרטיו?",
    answer:
      "בלשונית עוד ➔ ניהול תלמידים (או מרשימת הכיתה), לוחצים על שלוש הנקודות (•••) ליד שם התלמיד ובוחרים 'עריכה'. בחלונית שנפתחת ניתן לשנות את שיוך הכיתה, לתקן שם מלא או לעדכן כתובת אימייל, וללחוץ על 'שמירת פרטים'.",
    actionLabel: "מעבר לניהול תלמידים",
    actionTab: "more",
    actionMoreView: "students",
  },
  {
    id: "add-single-student",
    category: "students",
    categoryLabel: "תלמידים ואקסל",
    question: "איך מוסיפים תלמיד חדש בודד באופן ידני?",
    answer:
      "בלשונית עוד ➔ ניהול תלמידים, לוחצים על הכפתור '+ הוספת תלמיד חדש' (או '+ תלמיד' בראש רשימת התלמידים). בוחרים את הקורס, מקלידים שם מלא ואימייל (אופציונלי), ולוחצים 'שמירה'.",
    actionLabel: "מעבר לניהול תלמידים",
    actionTab: "more",
    actionMoreView: "students",
  },
  {
    id: "search-student-card",
    category: "students",
    categoryLabel: "תלמידים ואקסל",
    question: "איך מחפשים תלמיד ורואים את כרטיס התלמיד המלא (אחוזי נוכחות והערות)?",
    answer:
      "עוברים ללשונית 'תלמידים', מחפשים שם או מסננים לפי כיתה ולוחצים 'היסטוריה'. גם במסך הנוכחות יש לכל תלמיד כפתור 'היסטוריה ופרטי תלמיד'. הכרטיס מציג סיכום נוכחות, הערות והיסטוריה; הכפתור 'כל הנוכחות ותיקון דיווחים' פותח את הדיווחים מכל התאריכים עם אפשרות לתקן.",
    actionLabel: "מעבר למסך תלמידים",
    actionTab: "students",
  },

  // 2. נוכחות יומית ופעולות שוטפות
  {
    id: "start-daily-attendance",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "איך מתחילים נוכחות יומית בכיתה?",
    answer:
      "במסך 'היום' מוצגות הכיתות שיש להן מפגש מתוכנן בתאריך שנבחר. לוחצים 'בחירת כיתה ומפגש', בוחרים כיתה ותאריך ופותחים את המפגש. פתיחה אינה מסמנת נוכחות: בוחרים מצב לכל תלמיד, או לוחצים 'סימון כל מי שטרם סומן כנוכח' ומתקנים חריגים. סימונים קיימים נשמרים. שם הכיתה והתאריך מוצגים בראש המסך ובסרגל הסיום.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "mark-status-exceptions",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "איך מסמנים סטטוס חריג לתלמיד (מאחר, נעדר, מוצדק)?",
    answer:
      "לצד שם כל תלמיד יש בחירה המציגה 'טרם סומן' או את המצב שכבר נשמר. בוחרים 'נוכח', 'מאחר', 'נעדר' או 'מוצדק'. הסימון נשמר אוטומטית וניתן לשנות אותו שוב. להוספת הערה לוחצים על הכפתור 'הערה' לאחר סימון הנוכחות. אם השמירה נכשלת תוצג הודעה וניתן לנסות שוב.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "add-attendance-notes",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "איך מוסיפים הערה אישית לתלמיד בנוכחות (למשל 'במילואים', 'באישור רפואי')?",
    answer:
      "לאחר בחירת מצב הנוכחות לוחצים 'הערה' ליד התלמיד. ממלאים את השדה 'הערה לתלמיד/ה' ולוחצים 'שמירת הערה'. בהמשך הכפתור נקרא 'עריכת הערה'. ההערה שייכת למפגש בתאריך שנבחר ונשמרת בהיסטוריה, בכרטיס התלמיד ובדוח ה-Excel.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "filter-exceptions-only",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "איך מסננים לראות רק את מי שנעדר או איחר היום?",
    answer:
      "בראש רשימת הנוכחות יש שני כפתורים: 'כל התלמידים' ו-'חריגים בלבד'. הסינון מציג תלמידים שטרם סומנו, מאחרים, נעדרים, מוצדקים או תלמידים עם הערה. אפשר לחזור לרשימה המלאה בכל עת.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "finish-and-edit-today",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "מה קורה כשלוחצים 'סיום נוכחות' והאם ניתן לערוך אחר כך?",
    answer:
      "לאחר שכל התלמידים סומנו והשמירה הסתיימה, 'סיום נוכחות' מסמן את המפגש בתאריך הנבחר כהושלם ומחזיר למסך הראשי. אם חסר סימון או שיש שינויים שממתינים לסנכרון תוצג הודעה. אפשר לפתוח שוב את אותו מפגש דרך 'בחירת כיתה ומפגש' ולתקן נוכחות גם אחרי הסיום.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },

  // 3. היסטוריה, יומן שיעורים ותיקונים בדיעבד
  {
    id: "edit-past-attendance",
    category: "attendance",
    categoryLabel: "נוכחות יומית",
    question: "איך מתקנים או מעדכנים נוכחות של שיעור שהתקיים בעבר?",
    answer:
      "אפשר לפתוח 'בחירת כיתה ומפגש' ולבחור תאריך קודם, או לעבור ללשונית 'היסטוריה' ולבחור כיתה ותאריך. משנים את המצב בבחירה שליד שם התלמיד; להערה לוחצים 'הערה' או 'עריכת הערה'. להצגת כל דיווחי התלמיד בוחרים אותו בסינון ולוחצים 'כל התאריכים'. תיקון שייך רק למפגש שנבחר.",
    actionLabel: "מעבר להיסטוריה",
    actionTab: "history",
  },
  {
    id: "lesson-logging",
    category: "syllabus",
    categoryLabel: "סילבוס ותוכן",
    question: "איך מתעדים שיעור שבועי? (נושא המפגש ותקציר תוכן)",
    answer:
      "התיעוד מהיר ולוקח 5 שניות: במסך 'היום' מופיעה בראש המסך שורת נושא עם כפתור '+ תיעוד שיעור' (או 'עריכת נושא'). מקלידים כותרת קצרה, והמנחה המתעד משויך אוטומטית לפי חשבונך המחובר. בנוסף, ניתן לעדכן ולתקן נושאי מפגש בדיעבד במסך 'היסטוריה' בכל עת.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "who-taught-lesson",
    category: "syllabus",
    categoryLabel: "סילבוס ותוכן",
    question: "איך רואים איזה מנחה לימד שיעור מסוים?",
    answer:
      "בלשונית 'היסטוריה' וכן בחלונית ניתוח הסילבוס (AI), מוצגת כתובת האימייל של המנחה שתיעד את השיעור ליד תאריך המפגש (למשל: 'הועבר ע\"י rotman555@gmail.com'). כך קל לעקוב בסבב מנחים מי לימד מה.",
    actionLabel: "מעבר להיסטוריה",
    actionTab: "history",
  },

  // 4. חובות קורס וזכאות לתעודה
  {
    id: "certificate-eligibility",
    category: "tasks",
    categoryLabel: "חובות וזכאות",
    question: "איך מחושב אחוז הזכאות לתעודה ומהן חובות הקורס?",
    answer:
      "רף הזכאות המינימלי הוא 80% נוכחות מצטברת. איחור נספר כנוכחות מלאה (1.0). היעדרות מוצדקת נספרת כהיעדרות רגילה (אינה פוטרת מהמפגש). אינדיקטורים: 🟢 זכאי לפי נוכחות (80%+), 🟡 התראת סיכון (70%–79%), ו-🔴 מתחת לרף (<70%). מעבר לרף הנוכחות, תעודת סיום מותנית בהשלמת כל מטלות החובה של הקורס.",
    actionLabel: "מעקב חובות וזכאות לתעודה",
    actionTab: "more",
    actionMoreView: "tasks",
  },
  {
    id: "three-mandatory-tasks",
    category: "tasks",
    categoryLabel: "חובות וזכאות",
    question: "מהן מטלות החובה הנדרשות לקבלת תעודת סיום?",
    answer:
      "המערכת עוקבת אחר 3 חובות ליבה: 1. תרגיל עמיתים (חובה בכל הקורסים), 2. פרקטיקום (חובה בקורס השנתי בלבד), 3. מסע מדברי / יומיים (חובה בכל הקורסים). כל עוד תלמיד לא השלים את כל החובות שלו, הוא לא יסומן כזכאי סופית לתעודה.",
    actionLabel: "מעקב חובות וזכאות לתעודה",
    actionTab: "more",
    actionMoreView: "tasks",
  },
  {
    id: "yearly-vs-semester-practicum",
    category: "tasks",
    categoryLabel: "חובות וזכאות",
    question: "מדוע בקורס אחד מופיעה חובת 'פרקטיקום' ובקורס אחר לא?",
    answer:
      "חובת הפרקטיקום מוגדרת פדגוגית עבור 'הקורס השנתי' בלבד. המערכת מזהה באופן אוטומטי אם הקורס שנתי (לפי שמו או הגדרתו) ומציגה את עמודת הפרקטיקום רק בקורסים שנתיים, בעוד שבקורסים סמסטריאליים חובה זו אינה נדרשת.",
    actionLabel: "מעקב חובות וזכאות לתעודה",
    actionTab: "more",
    actionMoreView: "tasks",
  },
  {
    id: "mark-task-submission",
    category: "tasks",
    categoryLabel: "חובות וזכאות",
    question: "איך מסמנים ביצוע מטלה לתלמיד ואיפה רושמים תאריך ומשוב?",
    answer:
      "בלשונית עוד ➔ 'מעקב חובות וזכאות לתעודה', מוצגת טבלה כיתתית מרכזת. לחיצה על הריבוע (צ'קבוקס) של כל מטלה מסמנת V / X מיידית. לחיצה על סמל הפתק/עיפרון שליד המטלה פותחת חלונית שבה ניתן להזין תאריך ביצוע מדויק והערת משוב אישית מהמנחה.",
    actionLabel: "מעקב חובות וזכאות לתעודה",
    actionTab: "more",
    actionMoreView: "tasks",
  },
  {
    id: "add-custom-task",
    category: "tasks",
    categoryLabel: "חובות וזכאות",
    question: "איך מוסיפים מטלת חובה נוספת או מותאמת אישית לקורס?",
    answer:
      "במסך 'מעקב חובות וזכאות לתעודה', לוחצים על הכפתור '+ הוספת מטלה' בראש המסך. מקלידים את שם המטלה החדשה (למשל: 'הגשת רפלקציה אמצע', 'מבחן בית'). המטלה מתווספת מיד כעמודה נוספת בטבלה הכיתתית של אותו קורס.",
    actionLabel: "מעקב חובות וזכאות לתעודה",
    actionTab: "more",
    actionMoreView: "tasks",
  },

  // 5. סילבוס ובקרת AI
  {
    id: "set-course-syllabus",
    category: "syllabus",
    categoryLabel: "סילבוס ותוכן",
    question: "איך מזינים סילבוס לקורס?",
    answer:
      "בלשונית עוד ➔ ניהול קורסים, לוחצים על שלוש הנקודות (•••) בכרטיס הקורס ובוחרים '📚 סילבוס הקורס'. בחלונית שנפתחת ניתן ללחוץ על '📁 העלאת קובץ' כדי להעלות קובץ PDF של הסילבוס (המערכת מפענחת את ראשי הפרקים אוטומטית), להדביק את ראשי הפרקים ישירות לתיבת הטקסט, או לטעון דוגמה מוכנה. לסיום לוחצים 'שמירת סילבוס'.",
    actionLabel: "מעבר לניהול קורסים",
    actionTab: "more",
    actionMoreView: "courses",
  },
  {
    id: "syllabus-ai",
    category: "syllabus",
    categoryLabel: "סילבוס ותוכן",
    question: "איך מפעילים את מעקב הסילבוס ובדיקת ההתקדמות מול בינה מלאכותית (AI)?",
    answer:
      "במסך היום, בהיסטוריה, או בניהול קורסים לוחצים על הכפתור '✨ בדיקת סילבוס (AI)'. גוגל ג'מיני יצליב את הסילבוס מול כל השיעורים שתיעדתם בפועל ויציג: מד אחוזי כיסוי גרפי, המלצה ממוקדת בעברית למפגש הבא, התראה על חזרתיות בין מנחים, וחלוקה לנושאים שכוסו מול נושאים שטרם נלמדו.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "gemini-api-error",
    category: "syllabus",
    categoryLabel: "סילבוס ותוכן",
    question: "מה לעשות אם מקבלים שגיאה בחיבור מפתח ה-Gemini API?",
    answer:
      "המערכת תוכננה כך שגם אם אין מפתח תקין או שגוגל מחזיר שגיאה, מופעל אוטומטית מנוע גיבוי היוריסטי חכם שמנתח את הסילבוס ללא תלות ברשת. אם יש לכם מפתח מגוגל AI Studio, ודאו בלשונית עוד ➔ ניהול מפתח Gemini שהוא הודבק במלואו ללא רווחים מיותרים ולחצו 'בדיקת תקינות מפתח'.",
    actionLabel: "הגדרות מפתח Gemini",
    actionTab: "more",
  },

  // 6. דוחות ושיתוף
  {
    id: "export-excel-csv",
    category: "reports",
    categoryLabel: "דוחות ושיתוף",
    question: "איך מייצאים דוח כיתתי לאקסל ואיך מוודאים שהעברית לא יוצאת בג'יבריש?",
    answer:
      "בלשונית עוד ➔ דוחות וייצוא נתונים, לוחצים על שם הכיתה. המערכת מפיקה ומורידה מיד קובץ CSV/Excel מלא הכולל עמודה לכל תאריך מפגש, אחוזי נוכחות ופרטי התלמידים. הקובץ מיוצר עם קידוד UTF-8 BOM מיוחד המבטיח שהאותיות בעברית יוצגו בצורה מושלמת ב-Microsoft Excel.",
    actionLabel: "מעבר לדוחות וייצוא",
    actionTab: "more",
  },
  {
    id: "share-whatsapp-summary",
    category: "reports",
    categoryLabel: "דוחות ושיתוף",
    question: "איך משתפים סיכום נוכחות בוואטסאפ לכיתה או להנהלה?",
    answer:
      "בתחתית מסך 'היום' בעת ניהול נוכחות, יש כפתור 'וואטסאפ'. לחיצה עליו פותחת את הווטסאפ עם הודעה מעוצבת מראש הכוללת את שם הקורס, התאריך, וכמויות הנוכחים, המאחרים והנעדרים.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },

  // 7. אבטחה, כניסה מהירה ומצב לא מקוון
  {
    id: "biometric-fingerprint",
    category: "auth",
    categoryLabel: "אבטחה ואופליין",
    question: "איך מפעילים כניסה מהירה בטביעת אצבע במכשיר הנייד?",
    answer:
      "בלשונית עוד ➔ אבטחה וכניסה מהירה, לוחצים על 'הפעלת כניסה בטביעת אצבע' ומאמתים במכשיר. מעכשיו בכל פעם שתפתחו את האפליקציה תיכנסו מיד בלחיצת אצבע אחת ללא צורך לחכות לקישור במייל.",
    actionLabel: "הגדרות אבטחה וכניסה",
    actionTab: "more",
  },
  {
    id: "offline-mode-support",
    category: "auth",
    categoryLabel: "אבטחה ואופליין",
    question: "מה קורה אם אין קליטה או אינטרנט בכיתה (מצב לא מקוון / אופליין)?",
    answer:
      "האפליקציה עובדת באופן מלא גם ללא אינטרנט! כל סימון נוכחות, שינוי סטטוס או הערה נשמרים בזיכרון המקומי של המכשיר. בראש המסך מופיע תג 'מצב לא מקוון' עם כמות הפעולות הממתינות. ברגע שחוזרת הקליטה, המערכת מסנכרנת הכל אוטומטית לענן מבלי ששום נתון יאבד.",
    actionLabel: "מעבר למסך היום",
    actionTab: "today",
  },
  {
    id: "manual-sync-button",
    category: "auth",
    categoryLabel: "אבטחה ואופליין",
    question: "איך מבצעים סנכרון נתונים ידני לענן?",
    answer:
      "כשקיימות פעולות שבוצעו במצב לא מקוון, יופיע בראש המסך כפתור 'סנכרון (X)'. לחיצה עליו תסנכרן את הפעולות מיד מול בסיס הנתונים. בנוסף ניתן ללחוץ 'סנכרון נתונים ידני' בלשונית עוד ➔ ניהול מערכת.",
    actionLabel: "מעבר לעוד",
    actionTab: "more",
  },
  {
    id: "authorized-teachers-list",
    category: "auth",
    categoryLabel: "אבטחה ואופליין",
    question: "מי מורשה להיכנס למערכת ואיך מוסיפים מנחה חדש?",
    answer:
      "הגישה למערכת מוגבלת למנחים מורשים בלבד (רותם, דותן וצחי). הכניסה נעשית באמצעות קישור מאובטח חד-פעמי למייל או בזיהוי ביומטרי. להוספת כתובת מנחה חדשה למערכת, יש לפנות למנהל המערכת שיעדכן את רשימת המורשים בבסיס הנתונים.",
    actionLabel: "מעבר לעוד",
    actionTab: "more",
  },
  {
    id: "sign-out-switch-user",
    category: "auth",
    categoryLabel: "אבטחה ואופליין",
    question: "איך מתנתקים או מחליפים משתמש במכשיר?",
    answer:
      "בלחיצה על כפתור 'התנתקות' שבראש המסך משמאל (או בלשונית עוד ➔ מערכת וחשבון ➔ 'התנתקות'). המערכת תנעל את הגישה ותחזיר למסך ההתחברות לקבלת קישור חדש.",
    actionLabel: "מעבר לעוד",
    actionTab: "more",
  },
];

const FEEDBACK_TYPES = [
  {
    id: "bug" as const,
    label: "משהו לא עובד / תקלה",
    icon: "🐛",
    description: "שגיאה, כפתור שלא מגיב, או פעולה שנכשלה",
  },
  {
    id: "relocation" as const,
    label: "שינוי מיקום של פיצ'ר",
    icon: "🔄",
    description: "להעביר כפתור, תפריט או מידע למיקום נגיש יותר",
  },
  {
    id: "text_change" as const,
    label: "שינוי טקסט או ניסוח",
    icon: "✏️",
    description: "כותרת, ניסוח מבלבל או תיקון הגדרות",
  },
  {
    id: "feature_request" as const,
    label: "רעיון לשדרוג חדש",
    icon: "💡",
    description: "יכולת חדשה שתחסוך זמן ותייעל את העבודה",
  },
  {
    id: "question" as const,
    label: "שאלה שלא מצאתי בשו״ת",
    icon: "❓",
    description: "איך מבצעים פעולה מסוימת במערכת",
  },
];

const SCREENS_LIST = [
  { id: "today", label: "מסך 'היום' (נוכחות יומית)" },
  { id: "students", label: "מסך 'תלמידים' וכרטיס תלמיד" },
  { id: "history", label: "מסך 'היסטוריה' ויומן שיעורים" },
  { id: "courses", label: "ניהול קורסים וסילבוס" },
  { id: "tasks", label: "מעקב חובות וזכאות לתעודה" },
  { id: "import", label: "ייבוא תלמידים מאקסל" },
  { id: "biometric", label: "כניסה מהירה בטביעת אצבע" },
  { id: "general", label: "כללי / בכל המערכת" },
];

const QUICK_PHRASES: Record<string, string[]> = {
  bug: [
    "כפתור מסוים לא מגיב כשלוחצים עליו",
    "מקבל הודעת שגיאה על המסך",
    "הנתונים לא מתעדכנים לאחר שמירה",
    "האפליקציה נתקעת או איטית במסך זה",
  ],
  relocation: [
    "רוצה להעביר את הכפתור לראש המסך כדי שיהיה גלוי מיד",
    "עדיף שהפעולה הזו תופיע במסך היום במקום בתפריט עוד",
    "הכפתור מוסתר מדי בתפריט וקשה למצוא אותו",
    "לשנות את סדר הכרטיסים במסך",
  ],
  text_change: [
    "הכיתוב על הכפתור מבלבל, עדיף שייקרא אחרת",
    "ההנחיה כאן לא ברורה למנחה, כדאי לשנות ניסוח",
    "יש שגיאת הקלדה או ניסוח לא מדויק",
    "להוסיף הסבר קצר מתחת לכותרת",
  ],
  feature_request: [
    "העלאת קובץ אקסל (.xlsx) ישיר במקום העתק-הדבק",
    "כפתור מחיקה סופית ומהירה של תלמיד",
    "הוספת אפשרות לסימון מרוכז בלחיצה אחת",
    "הוספת מטלת חובה נוספת לרשימת הזכאות",
  ],
  question: [
    "איפה בדיוק מגדירים את זה?",
    "איך אני מעביר תלמיד מכיתה אחת לאחרת?",
    "האם הנתונים שלי מגובים באופן אוטומטי?",
  ],
};

export function InstructorHelpHub({
  userEmail = "",
  courses = [],
  onNavigate,
  onBack,
}: {
  userEmail?: string;
  courses?: Course[];
  onNavigate?: (tab: AppTab, moreView?: "courses" | "students" | "tasks") => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"faq" | "feedback" | "history">("faq");

  // FAQ State
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState<string>("all");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>("delete-student");

  // Feedback Wizard State
  const [feedbackType, setFeedbackType] = useState<InstructorFeedbackItem["type"]>("bug");
  const [feedbackScreen, setFeedbackScreen] = useState(SCREENS_LIST[0].label);
  const [customDescription, setCustomDescription] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // History State
  const [historyItems, setHistoryItems] = useState<InstructorFeedbackItem[]>(() =>
    getStoredFeedbacks()
  );

  // FAQ Filtering
  const filteredFaqs = useMemo(() => {
    return COMPREHENSIVE_FAQ_LIST.filter((item) => {
      const matchCat = faqCategory === "all" || item.category === faqCategory;
      const q = faqSearch.trim().toLowerCase();
      const matchQuery =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [faqSearch, faqCategory]);

  // Compiled WhatsApp/Export Text
  const compiledFeedbackText = useMemo(() => {
    const typeObj = FEEDBACK_TYPES.find((t) => t.id === feedbackType);
    const dateStr = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    return `הי, יש לי משוב / בקשה לגבי מערכת הנוכחות 📋

• סוג הפנייה: ${typeObj?.icon} ${typeObj?.label}
• מסך / אזור: ${feedbackScreen}${selectedCourseName ? ` (קורס: ${selectedCourseName})` : ""}
• מנחה מדווח: ${userEmail || "מנחה"}
• תאריך: ${dateStr}

פירוט הבקשה:
${customDescription.trim() || "(נבחרה תבנית מהירה ללא פירוט נוסף)"}

— נשלח מתוך מרכז המשוב והעזרה באפליקציה`;
  }, [feedbackType, feedbackScreen, selectedCourseName, userEmail, customDescription]);

  // Handle Append Quick Phrase
  const handleAddQuickPhrase = (phrase: string) => {
    setCustomDescription((prev) => {
      if (!prev.trim()) return phrase;
      return `${prev}\n• ${phrase}`;
    });
  };

  // Handle Save Feedback to local history
  const handleSaveToHistory = () => {
    const newItem: InstructorFeedbackItem = {
      id: "fb_" + Date.now().toString(),
      type: feedbackType,
      screen: feedbackScreen,
      description: customDescription.trim() || "פנייה מהירה",
      userEmail: userEmail || "rotman555@gmail.com",
      createdAt: new Date().toISOString(),
      deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    const updated = [newItem, ...historyItems];
    setHistoryItems(updated);
    saveFeedbacksToStorage(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Handle WhatsApp Share
  const handleSendWhatsApp = () => {
    handleSaveToHistory();
    const encoded = encodeURIComponent(compiledFeedbackText);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  // Handle Copy
  const handleCopyText = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(compiledFeedbackText);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2200);
      }
    } catch {
      // Ignore
    }
  };

  // Delete History Item
  const handleDeleteHistoryItem = (id: string) => {
    const updated = historyItems.filter((i) => i.id !== id);
    setHistoryItems(updated);
    saveFeedbacksToStorage(updated);
  };

  return (
    <div className="space-y-5 text-right">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-white/14 pb-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            <span>→</span>
            <span>חזרה לתפריט ראשי</span>
          </button>
        </div>
        <span className="text-xs font-extrabold text-[#00E5E5] bg-[#00A6A6]/20 px-2.5 py-1 rounded-lg border border-[#00A6A6]/30">
          מרכז מנחים 💡
        </span>
      </div>

      {/* Main Title Card */}
      <div className="rounded-2xl border border-white/14 bg-gradient-to-r from-[#003859] to-[#00263D] p-4 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black">מרכז עזרה, שו״ת ומשוב מנחים</h2>
            <p className="mt-1 text-xs text-[#B8D8E6] leading-relaxed">
              שלום {userEmail ? <span dir="ltr" className="font-bold text-white">{userEmail}</span> : "מנחה יקר"}! כאן תמצאו תשובות מיידיות לכל הפיצ'רים באפליקציה, ותוכלו להעביר בקשות ומשוב ללא צורך בהקלדה מסורבלת.
            </p>
          </div>
          <span className="text-3xl">🤝</span>
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="flex rounded-xl bg-[#00263D] p-1 border border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("faq")}
          className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
            activeTab === "faq"
              ? "bg-[#00A6A6] text-white shadow-md"
              : "text-[#B8D8E6] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>📚</span>
          <span>ספריית שו״ת ({COMPREHENSIVE_FAQ_LIST.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
            activeTab === "feedback"
              ? "bg-[#00A6A6] text-white shadow-md"
              : "text-[#B8D8E6] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>✍️</span>
          <span>אשף פניות ומשוב</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
            activeTab === "history"
              ? "bg-[#00A6A6] text-white shadow-md"
              : "text-[#B8D8E6] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>🕒</span>
          <span>פניות ששלחתי ({historyItems.length})</span>
        </button>
      </div>

      {/* TAB 1: FAQ LIBRARY */}
      {activeTab === "faq" && (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="חפשו כל שאלה (למשל: מילואים, אקסל, מחיקה, זכאות, אופליין, סילבוס)..."
              className="w-full rounded-xl border border-white/15 bg-[#001D30] py-2.5 px-3 text-xs font-medium text-white placeholder-[#64748B] focus:border-[#00A6A6] focus:outline-none"
            />
            {faqSearch && (
              <button
                type="button"
                onClick={() => setFaqSearch("")}
                className="absolute left-3 top-2.5 text-xs text-[#94A3B8] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setFaqCategory("all")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "all"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              הכל ({COMPREHENSIVE_FAQ_LIST.length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("attendance")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "attendance"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              📅 נוכחות יומית ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "attendance").length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("students")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "students"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              👥 תלמידים ואקסל ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "students").length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("tasks")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "tasks"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              🎓 חובות וזכאות לתעודה ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "tasks").length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("syllabus")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "syllabus"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              📚 סילבוס ותוכן ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "syllabus").length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("reports")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "reports"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              📊 דוחות ושיתוף ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "reports").length})
            </button>
            <button
              type="button"
              onClick={() => setFaqCategory("auth")}
              className={`rounded-lg px-2.5 py-1 font-bold transition border ${
                faqCategory === "auth"
                  ? "bg-[#00E5E5]/20 text-[#00E5E5] border-[#00A6A6]"
                  : "bg-[#00263D] text-[#B8D8E6] border-white/10 hover:text-white"
              }`}
            >
              🔒 אבטחה ואופליין ({COMPREHENSIVE_FAQ_LIST.filter(i => i.category === "auth").length})
            </button>
          </div>

          {/* Questions Accordion */}
          <div className="space-y-2.5">
            {filteredFaqs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#00263D] p-6 text-center text-xs text-[#94A3B8]">
                לא נמצאו שאלות התואמות לחיפוש זה. נסו מילת חיפוש אחרת או עברו ללשונית "אשף פניות ומשוב" להזנת שאלה חדשה.
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="overflow-hidden rounded-xl border border-white/14 bg-[#00263D] transition hover:border-white/25"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                      className="flex w-full items-center justify-between p-3.5 text-right font-extrabold text-xs sm:text-sm text-white"
                    >
                      <span className="flex-1 pr-1">{faq.question}</span>
                      <span className="text-[#00E5E5] text-xs font-mono ml-2">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/10 bg-[#001D30]/80 p-3.5 text-xs leading-relaxed text-[#B8D8E6] space-y-3">
                        <p className="whitespace-pre-line">{faq.answer}</p>
                        {faq.actionLabel && onNavigate && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => onNavigate(faq.actionTab || "more", faq.actionMoreView)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00A6A6]/40 bg-[#00A6A6]/20 px-3 py-1.5 text-xs font-extrabold text-[#00E5E5] transition hover:bg-[#00A6A6]/30"
                            >
                              <span>{faq.actionLabel}</span>
                              <span>←</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SMART FEEDBACK & REQUEST WIZARD */}
      {activeTab === "feedback" && (
        <div className="space-y-5 rounded-2xl border border-white/14 bg-[#00263D] p-4 sm:p-5 text-white">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-base font-extrabold text-[#00E5E5]">
              אשף חכם להזנת בקשה, שינוי או דיווח
            </h3>
            <p className="mt-0.5 text-xs text-[#B8D8E6]">
              המערכת מלווה אתכם בבחירות מהירות בלחיצה אחת, כדי שלא תצטרכו להקליד ידנית את כל הפרטים הטכניים.
            </p>
          </div>

          {/* Step 1: Select Type */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-white">
              1. מה מהות הפנייה?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEEDBACK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFeedbackType(t.id)}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-right transition ${
                    feedbackType === t.id
                      ? "border-[#00A6A6] bg-[#00A6A6]/20 text-white shadow-sm"
                      : "border-white/10 bg-[#001D30] text-[#B8D8E6] hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div>
                    <strong className="block text-xs font-extrabold text-white">{t.label}</strong>
                    <span className="text-[11px] text-[#94A3B8] leading-tight block">
                      {t.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Select Screen / Area */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-white">
              2. באיזה מסך או אזור במערכת?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {SCREENS_LIST.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFeedbackScreen(s.label)}
                  className={`rounded-lg border px-2.5 py-2 text-right font-bold transition truncate ${
                    feedbackScreen === s.label
                      ? "border-[#00A6A6] bg-[#00A6A6]/20 text-[#00E5E5]"
                      : "border-white/10 bg-[#001D30] text-[#B8D8E6] hover:bg-white/5"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Course Association */}
          {courses.length > 0 && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#B8D8E6]">
                שיוך לקורס ספציפי (אופציונלי):
              </label>
              <select
                value={selectedCourseName}
                onChange={(e) => setSelectedCourseName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#001D30] p-2 text-xs font-semibold text-white focus:border-[#00A6A6] focus:outline-none"
              >
                <option value="">-- כללי / לא ספציפי לקורס --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 3: Quick Assist Suggestions */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-white">
              3. תבניות מהירות להוספה בלחיצה אחת:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(QUICK_PHRASES[feedbackType] || []).map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuickPhrase(phrase)}
                  className="rounded-lg border border-white/10 bg-[#001D30] px-2.5 py-1 text-xs text-[#B8D8E6] hover:border-[#00A6A6] hover:text-[#00E5E5] transition flex items-center gap-1"
                >
                  <span>+</span>
                  <span>{phrase}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Description textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-white">
              4. פירוט במילים שלכם (אפשר לערוך או להוסיף בחופשיות):
            </label>
            <textarea
              rows={3}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="כתבו כאן בקצרה מה לא עבד, מה תרצו להעביר או איזה שדרוג הייתם שמחים לראות..."
              className="w-full rounded-xl border border-white/15 bg-[#001D30] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#00A6A6] focus:outline-none leading-relaxed"
            />
          </div>

          {/* Step 5: Formatted Preview */}
          <div className="space-y-1 rounded-xl border border-white/10 bg-[#001D30] p-3 text-xs text-[#94A3B8]">
            <p className="font-bold text-[#B8D8E6]">תצוגה מקדימה של ההודעה שתופק:</p>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto">
              {compiledFeedbackText}
            </pre>
          </div>

          {/* Step 6: Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] px-4 py-3 text-xs font-extrabold text-white shadow-md transition"
              >
                <span>💬</span>
                <span>שליחה ישירה בוואטסאפ</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-4 py-3 text-xs font-extrabold text-white transition"
              >
                <span>📋</span>
                <span>{copiedNotification ? "✓ ההודעה הועתקה ללוח!" : "העתקת ההודעה"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveToHistory}
              className="w-full rounded-xl border border-white/15 bg-[#001D30] hover:bg-white/5 py-2.5 text-xs font-bold text-[#B8D8E6] transition"
            >
              {savedSuccess ? "✓ הפנייה נשמרה ביומן המקומי!" : "💾 שמירה ביומן פניות במכשיר ללא שליחה כרגע"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY OF SENT REQUESTS */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#B8D8E6]">
              פניות ומשובים שנרשמו במכשיר זה ({historyItems.length})
            </h3>
            {historyItems.length > 0 && (
              <span className="text-[11px] text-[#94A3B8]">נשמר באופן מקומי</span>
            )}
          </div>

          {historyItems.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#00263D] p-6 text-center text-xs text-[#94A3B8]">
              טרם נרשמו פניות במכשיר זה. ניתן להשתמש בטאב 'אשף פניות ומשוב' כדי לרשום כל הערה או בקשת שדרוג.
            </div>
          ) : (
            historyItems.map((item) => {
              const typeObj = FEEDBACK_TYPES.find((t) => t.id === item.type);
              const dateFormatted = new Intl.DateTimeFormat("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(item.createdAt));

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/14 bg-[#00263D] p-3.5 space-y-2 text-xs text-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-[#00E5E5]">
                      <span>{typeObj?.icon}</span>
                      <span>{typeObj?.label}</span>
                    </span>
                    <span className="text-[11px] text-[#94A3B8] font-mono">{dateFormatted}</span>
                  </div>

                  <p className="text-[11px] text-[#B8D8E6]">
                    <strong>מסך:</strong> {item.screen}
                  </p>

                  <p className="rounded-lg bg-[#001D30] p-2.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const encoded = encodeURIComponent(
                          `הי, לגבי פנייה קודמת שלי:\n• סוג: ${typeObj?.label}\n• מסך: ${item.screen}\n• פירוט: ${item.description}`
                        );
                        window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
                      }}
                      className="text-[#00E5E5] hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>💬</span>
                      <span>שליחה שוב בווטסאפ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      className="text-[#EF4444] hover:underline"
                    >
                      מחיקה מהיומן
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseScheduleLines, pdfLineText } from './schedule';
GlobalWorkerOptions.workerSrc = workerUrl;

export async function readSchedulePdf(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= document.numPages; p++) {
      const page = await document.getPage(p);
      const content = await page.getTextContent();
      const lines: { y: number; parts: { x: number; width: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) { line = { y, parts: [] }; lines.push(line); }
        line.parts.push({ x: item.transform[4], width: item.width, text: item.str });
      }
      pages.push(lines.sort((a,b) => b.y-a.y).map(l => pdfLineText(l.parts)).join('\n'));
    }
    const sourceText = pages.join('\n\n');
    const meetings = parseScheduleLines(sourceText.split('\n'));
    if (!meetings.length) throw new Error('לא נמצאו תאריכים בטקסט ה־PDF. לקובץ סרוק אפשר להזין או להדביק את התאריכים, או ליצור סדרה שבועית.');
    return { meetings, sourceText, sourceName: file.name };
  } finally { await task.destroy(); }
}

"use client";

import type { AppData, AttendanceStatus } from "./types";

export const CACHE_STORAGE_KEY = "class_attendance_cache_v1";
export const PENDING_QUEUE_KEY = "class_attendance_pending_queue_v1";

export type PendingAction =
  | {
      id: string;
      type: "update_attendance";
      logId: string;
      patch: { status?: AttendanceStatus; notes?: string };
      createdAt: string;
    }
  | {
      id: string;
      type: "create_attendance";
      courseId: string;
      date: string;
      time: string;
      createdAt: string;
    };

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage might be inaccessible (e.g. in restricted iframe)
  }
  return null;
}

export function isOnline(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export function saveCachedAppData(data: AppData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to cache app data to localStorage:", err);
  }
}

export function getCachedAppData(): AppData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

export function getPendingQueue(): PendingAction[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingAction[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Failed to save pending queue:", err);
  }
}

export function queuePendingAction(
  action:
    | {
        type: "update_attendance";
        logId: string;
        patch: { status?: AttendanceStatus; notes?: string };
        id?: string;
        createdAt?: string;
      }
    | {
        type: "create_attendance";
        courseId: string;
        date: string;
        time: string;
        id?: string;
        createdAt?: string;
      }
): PendingAction {
  const fullAction: PendingAction = {
    ...action,
    id: action.id || `pending_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: action.createdAt || new Date().toISOString(),
  } as PendingAction;

  const currentQueue = getPendingQueue();
  const existingIdx = currentQueue.findIndex(
    (item) => item.type === "update_attendance" && fullAction.type === "update_attendance" && item.logId === fullAction.logId
  );

  if (existingIdx >= 0 && fullAction.type === "update_attendance") {
    const existing = currentQueue[existingIdx];
    if (existing.type === "update_attendance") {
      currentQueue[existingIdx] = {
        ...existing,
        patch: { ...existing.patch, ...fullAction.patch },
      };
    }
  } else {
    currentQueue.push(fullAction);
  }

  savePendingQueue(currentQueue);
  return fullAction;
}

export function removePendingAction(id: string): void {
  const currentQueue = getPendingQueue();
  const nextQueue = currentQueue.filter((item) => item.id !== id);
  savePendingQueue(nextQueue);
}

export function clearPendingQueue(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(PENDING_QUEUE_KEY);
}

export function applyPendingActionsToData(data: AppData): AppData {
  const queue = getPendingQueue();
  if (queue.length === 0) return data;

  const clonedAttendance = data.attendance.map((log) => ({ ...log }));

  for (const action of queue) {
    if (action.type === "update_attendance") {
      const target = clonedAttendance.find((log) => log.id === action.logId);
      if (target) {
        if (action.patch.status !== undefined) target.status = action.patch.status;
        if (action.patch.notes !== undefined) target.notes = action.patch.notes;
      }
    }
  }

  return {
    ...data,
    attendance: clonedAttendance,
  };
}

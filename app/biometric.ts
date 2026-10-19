"use client";

export interface BiometricRecord {
  credentialIdBase64Url: string;
  email: string;
  createdAt: string;
}

export const BIOMETRIC_STORAGE_KEY = "class_attendance_biometric_v1";
export const BIOMETRIC_UNLOCKED_SESSION_KEY = "class_attendance_biometric_unlocked_v1";
export const BIOMETRIC_DISMISSED_SESSION_KEY = "class_attendance_biometric_dismissed_v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function createChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  const cryptoObj =
    (typeof globalThis !== "undefined" && globalThis.crypto) ||
    (typeof window !== "undefined" && window.crypto);
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(challenge);
    return challenge;
  }
  for (let i = 0; i < challenge.length; i += 1) {
    challenge[i] = Math.floor(Math.random() * 256);
  }
  return challenge;
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(padded, "base64"));
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.PublicKeyCredential === "undefined" ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
    ) {
      return false;
    }
    return Boolean(
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    );
  } catch {
    return false;
  }
}

export function getBiometricRecord(email?: string): BiometricRecord | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(BIOMETRIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BiometricRecord>;
    if (
      !parsed ||
      typeof parsed.credentialIdBase64Url !== "string" ||
      !parsed.credentialIdBase64Url ||
      typeof parsed.email !== "string" ||
      !parsed.email ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    if (email && normalizeEmail(parsed.email) !== normalizeEmail(email)) {
      return null;
    }
    return {
      credentialIdBase64Url: parsed.credentialIdBase64Url,
      email: normalizeEmail(parsed.email),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function hasBiometricEnabled(email?: string): boolean {
  return Boolean(getBiometricRecord(email));
}

export function clearBiometricRecord(): void {
  const storage = getLocalStorage();
  if (storage) {
    storage.removeItem(BIOMETRIC_STORAGE_KEY);
  }
  lockBiometricSession();
}

export function isBiometricSessionUnlocked(): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;
  return storage.getItem(BIOMETRIC_UNLOCKED_SESSION_KEY) === "true";
}

export function markBiometricSessionUnlocked(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(BIOMETRIC_UNLOCKED_SESSION_KEY, "true");
}

export function lockBiometricSession(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(BIOMETRIC_UNLOCKED_SESSION_KEY);
}

export function isBiometricPromptDismissed(): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;
  return storage.getItem(BIOMETRIC_DISMISSED_SESSION_KEY) === "true";
}

export function dismissBiometricPromptForSession(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(BIOMETRIC_DISMISSED_SESSION_KEY, "true");
}

function getRpId(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

export async function registerBiometric(email: string): Promise<BiometricRecord> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("כתובת אימייל חסרה להפעלת זיהוי ביומטרי.");
  }
  if (
    typeof window === "undefined" ||
    !window.navigator?.credentials ||
    typeof window.navigator.credentials.create !== "function"
  ) {
    throw new Error("זיהוי ביומטרי אינו נתמך בדפדפן זה.");
  }

  const challenge = createChallenge();
  const userIdBytes = new TextEncoder().encode(normalized);

  try {
    const credential = (await window.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "נוכחות",
          id: getRpId(),
        },
        user: {
          id: userIdBytes,
          name: normalized,
          displayName: normalized,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) {
      throw new Error("האימות הביומטרי בוטל או נכשל. נסו שוב.");
    }

    const record: BiometricRecord = {
      credentialIdBase64Url: uint8ArrayToBase64Url(new Uint8Array(credential.rawId)),
      email: normalized,
      createdAt: new Date().toISOString(),
    };

    const storage = getLocalStorage();
    if (storage) {
      storage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record));
    }
    markBiometricSessionUnlocked();
    return record;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ביומטרי")) {
      throw error;
    }
    throw new Error("האימות הביומטרי בוטל או נכשל. נסו שוב.");
  }
}

export async function verifyBiometric(email?: string): Promise<boolean> {
  const record = getBiometricRecord(email);
  if (!record) {
    throw new Error("לא נמצאה הגדרת טביעת אצבע במכשיר זה.");
  }
  if (
    typeof window === "undefined" ||
    !window.navigator?.credentials ||
    typeof window.navigator.credentials.get !== "function"
  ) {
    throw new Error("זיהוי ביומטרי אינו נתמך בדפדפן זה.");
  }

  const challenge = createChallenge();
  const credentialIdBytes = base64UrlToUint8Array(record.credentialIdBase64Url);

  try {
    const assertion = (await window.navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: getRpId(),
        allowCredentials: [
          {
            type: "public-key",
            id: credentialIdBytes.buffer.slice(
              credentialIdBytes.byteOffset,
              credentialIdBytes.byteOffset + credentialIdBytes.byteLength
            ) as ArrayBuffer,
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error("האימות הביומטרי בוטל או נכשל. נסו שוב.");
    }

    markBiometricSessionUnlocked();
    return true;
  } catch {
    throw new Error("האימות הביומטרי בוטל או נכשל. נסו שוב.");
  }
}

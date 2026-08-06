"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { Settings } from "lucide-react";
import { updateSettingsAction, type SettingsActionState } from "@/app/actions/settings";
import { getWhatsappQrStatusAction } from "@/app/actions/whatsapp";
import { formatIsraeliPhone } from "@/lib/phone";

const initialState: SettingsActionState = {};

export type TeacherSettings = {
  name: string;
  email: string;
  phone: string | null;
  appName: string;
  defaultLessonCapacity: number;
  defaultLessonDuration: number;
  backgroundImageUrl: string | null;
  shareImageUrl: string | null;
  shareMessage: string | null;
  whatsappConnected: boolean;
  whatsappPhone: string | null;
};

function WhatsappConnectSection({
  initialConnected,
  initialPhone,
}: {
  initialConnected: boolean;
  initialPhone: string | null;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [phone, setPhone] = useState(initialPhone);
  const [connecting, setConnecting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyStatus(status: Awaited<ReturnType<typeof getWhatsappQrStatusAction>>) {
    if (status.error) {
      setError(status.error);
      setConnecting(false);
      return;
    }
    if (status.connected) {
      setConnected(true);
      setPhone(status.phone);
      setConnecting(false);
      setQrDataUrl(null);
    } else if (status.qrDataUrl) {
      setQrDataUrl(status.qrDataUrl);
    }
  }

  useEffect(() => {
    if (!connecting) return;
    const poll = setInterval(async () => {
      applyStatus(await getWhatsappQrStatusAction());
    }, 3000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting]);

  function handleConnect() {
    setError(null);
    setConnecting(true);
    startTransition(async () => {
      applyStatus(await getWhatsappQrStatusAction());
    });
  }

  if (connected) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">וואטסאפ</span>
        <div className="flex items-center gap-2 rounded-md border border-green-300 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:text-green-400">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
          <span>מחוברת{phone ? ` · ${formatIsraeliPhone(phone)}` : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">וואטסאפ</span>

      {!connecting && (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isPending}
          className="w-fit rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "מתחברת…" : "התחברות"}
        </button>
      )}

      {connecting && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamically generated data: URI, not a static asset
            <img src={qrDataUrl} alt="קוד QR לחיבור וואטסאפ" className="h-48 w-48" />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">טוענת קוד…</p>
          )}
          <ol className="list-decimal pr-4 text-xs text-zinc-600 dark:text-zinc-400">
            <li>בטלפון שלך פתחי וואטסאפ</li>
            <li>הגדרות ← מכשירים מקושרים ← קישור מכשיר</li>
            <li>סרקי את הקוד עם המצלמה</li>
          </ol>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">הקוד מתעדכן אוטומטית</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "שומרת…" : "שמירת שינויים"}
    </button>
  );
}

export function SettingsButton({ settings }: { settings: TeacherSettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeShareImage, setRemoveShareImage] = useState(false);

  const [state, formAction] = useActionState(async (prevState: SettingsActionState, formData: FormData) => {
    const result = await updateSettingsAction(prevState, formData);
    if (!result.error) {
      setIsOpen(false);
      setRemoveImage(false);
      setRemoveShareImage(false);
    }
    return result;
  }, initialState);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="הגדרות"
        className="rounded-md border border-zinc-300 p-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <Settings className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-sm overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh]">
            <h2 className="mb-4 text-lg font-semibold">הגדרות</h2>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className="text-sm font-medium">
                  שם המורה
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={settings.name}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="phone" className="text-sm font-medium">
                  טלפון (אופציונלי)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={settings.phone ? formatIsraeliPhone(settings.phone) : ""}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium">
                  אימייל
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={settings.email}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="appName" className="text-sm font-medium">
                  שם האפליקציה
                </label>
                <input
                  id="appName"
                  name="appName"
                  type="text"
                  required
                  defaultValue={settings.appName}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="defaultLessonCapacity" className="text-sm font-medium">
                    מספר מקומות ברירת מחדל
                  </label>
                  <input
                    id="defaultLessonCapacity"
                    name="defaultLessonCapacity"
                    type="number"
                    min={1}
                    required
                    defaultValue={settings.defaultLessonCapacity}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="defaultLessonDuration" className="text-sm font-medium">
                    משך שיעור ברירת מחדל (דק׳)
                  </label>
                  <input
                    id="defaultLessonDuration"
                    name="defaultLessonDuration"
                    type="number"
                    min={1}
                    required
                    defaultValue={settings.defaultLessonDuration}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">תמונת רקע לדף התלמידות</span>
                {settings.backgroundImageUrl && !removeImage && (
                  <div className="flex items-center gap-3">
                    <Image
                      src={settings.backgroundImageUrl}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setRemoveImage(true)}
                      className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      הסרת תמונה
                    </button>
                  </div>
                )}
                {removeImage && <input type="hidden" name="removeBackgroundImage" value="on" />}
                <input
                  name="backgroundImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={() => setRemoveImage(false)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <span className="text-sm font-medium">תמונה לשיתוף בוואטסאפ</span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  התמונה שתופיע כשמפרסמים קישור לשבוע בוואטסאפ. קובץ JPEG בלבד, עד 300KB. מומלץ יחס רוחב-גובה של
                  כ-1200×630.
                </p>
                {settings.shareImageUrl && !removeShareImage && (
                  <div className="flex items-center gap-3">
                    <Image
                      src={settings.shareImageUrl}
                      alt=""
                      width={64}
                      height={34}
                      unoptimized
                      className="h-[34px] w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setRemoveShareImage(true)}
                      className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      הסרת תמונה
                    </button>
                  </div>
                )}
                {removeShareImage && <input type="hidden" name="removeShareImage" value="on" />}
                <input
                  name="shareImage"
                  type="file"
                  accept="image/jpeg"
                  onChange={() => setRemoveShareImage(false)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="shareMessage" className="text-sm font-medium">
                  הודעת ברירת מחדל לשיתוף
                </label>
                <textarea
                  id="shareMessage"
                  name="shareMessage"
                  rows={2}
                  placeholder="לדוגמה: שיעורים יתקיימו במינימום 8 משתתפות. בבקשה!"
                  defaultValue={settings.shareMessage ?? ""}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex gap-3">
                <SubmitButton />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  ביטול
                </button>
              </div>
            </form>

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <WhatsappConnectSection
                initialConnected={settings.whatsappConnected}
                initialPhone={settings.whatsappPhone}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

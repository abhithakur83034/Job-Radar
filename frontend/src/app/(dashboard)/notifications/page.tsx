"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useHydrated } from "@/lib/useHydrated";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

interface PushConfig {
  configured: boolean;
  publicKey: string | null;
  subscriptions: number;
}

interface MeData {
  hiddenCompanies: string[];
  notificationPrefs: { minScore: number; push: boolean };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (HTTP ${res.status})`);
  return body as T;
}

/** Convert the server's base64url VAPID key for PushManager.subscribe(). */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    // One request for the list; opening the page marks everything read
    api<{ items: NotificationItem[]; unread: number }>("/api/v1/me/notifications?limit=30")
      .then(async (data) => {
        setItems(data.items);
        if (data.unread > 0) {
          await api("/api/v1/me/notifications/read-all", { method: "POST" });
          router.refresh(); // clears the badge in the top bar
        }
      })
      .catch((err) => setError(err.message));
    api<{ user: MeData & Record<string, unknown> }>("/api/v1/auth/me")
      .then((data) => setMe({ hiddenCompanies: data.user.hiddenCompanies ?? [], notificationPrefs: data.user.notificationPrefs ?? { minScore: 80, push: true } }))
      .catch(() => {});
  }, [router]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-[14px] font-bold">Recent alerts</h2>
        {error ? (
          <p role="alert" className="mt-3 text-[12.5px] text-danger">{error}</p>
        ) : !items ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-[8px] bg-surface-2" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-ink-muted">
            No alerts yet. When the hourly refresh finds new jobs scoring at or above your alert score, they&apos;ll appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="py-3">
                <Link href={n.url.startsWith("/") ? n.url : "/feed"} className="block hover:opacity-90">
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 flex-none rounded-full bg-accent" aria-label="Unread" />}
                    <span className="text-[13px] font-semibold">{n.title}</span>
                    <span className="text-[11.5px] text-ink-muted">· {new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[12.5px] text-ink-muted">{n.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-5">
        {me && <AlertSettings prefs={me.notificationPrefs} />}
        {me && <HiddenCompanies initial={me.hiddenCompanies} />}
      </div>
    </div>
  );
}

function AlertSettings({ prefs }: { prefs: { minScore: number; push: boolean } }) {
  const hydrated = useHydrated();
  const [push, setPush] = useState<PushConfig | null>(null);
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "denied" | "on" | "off">("unknown");
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<{ minScore: number }>({
    defaultValues: { minScore: prefs.minScore },
  });

  useEffect(() => {
    api<PushConfig>("/api/v1/me/push").then(setPush).catch(() => {});
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? "on" : "off");
    });
  }, []);

  async function enablePush() {
    setMessage(null);
    try {
      if (!push?.publicKey) throw new Error("Push isn't configured on this server yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(push.publicKey) });
      await api("/api/v1/me/push/subscriptions", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      await api("/api/v1/me/notification-prefs", { method: "PATCH", body: JSON.stringify({ push: true }) });
      setPushState("on");
      setMessage("Browser notifications are on for this device.");
    } catch (err: any) {
      setMessage(err?.message || "Couldn't enable notifications");
    }
  }

  async function disablePush() {
    setMessage(null);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/v1/me/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
    setPushState("off");
    setMessage("Browser notifications are off for this device.");
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-[14px] font-bold">Alert settings</h2>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setMessage(null);
          await api("/api/v1/me/notification-prefs", { method: "PATCH", body: JSON.stringify({ minScore: values.minScore }) });
          reset(values);
          setMessage("Saved.");
        })}
        className="mt-3"
      >
        <label htmlFor="minScore" className="block text-[12px] font-semibold text-ink-muted">Alert me about matches scoring at least (%)</label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="minScore"
            type="number"
            inputMode="numeric"
            placeholder="Minimum match score"
            aria-invalid={errors.minScore ? true : undefined}
            className={`w-28 rounded-[9px] border bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none ${errors.minScore ? "border-danger" : "border-border focus:border-accent"}`}
            {...register("minScore", {
              valueAsNumber: true,
              required: "Required",
              min: { value: 50, message: "At least 50" },
              max: { value: 100, message: "At most 100" },
            })}
          />
          <button type="submit" disabled={!hydrated || !isDirty || isSubmitting} className="rounded-[9px] bg-sidebar px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">
            Save
          </button>
        </div>
        {errors.minScore && <p role="alert" className="mt-1 text-[11.5px] text-danger">{errors.minScore.message}</p>}
      </form>

      <div className="mt-4 border-t border-border pt-3 text-[12.5px]">
        <div className="font-semibold">Browser notifications</div>
        {push && !push.configured ? (
          <p className="mt-1 text-ink-muted">Not set up on this server yet. Alerts still appear on this page.</p>
        ) : pushState === "unsupported" ? (
          <p className="mt-1 text-ink-muted">This browser doesn&apos;t support push notifications. On iPhone, add JobRadar to your Home Screen first.</p>
        ) : pushState === "denied" ? (
          <p className="mt-1 text-ink-muted">Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.</p>
        ) : pushState === "on" ? (
          <button type="button" onClick={disablePush} className="mt-2 rounded-[8px] border border-border px-3 py-1.5 font-semibold text-ink-muted hover:text-ink">
            Turn off on this device
          </button>
        ) : (
          <button type="button" onClick={enablePush} disabled={!hydrated || pushState === "unknown" || !push} className="mt-2 rounded-[8px] bg-accent px-3 py-1.5 font-bold text-accent-ink disabled:opacity-50">
            Turn on browser notifications
          </button>
        )}
        {message && <p role="status" className="mt-2 text-ink-muted">{message}</p>}
      </div>
    </section>
  );
}

function HiddenCompanies({ initial }: { initial: string[] }) {
  const [companies, setCompanies] = useState(initial);
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-[14px] font-bold">Hidden companies</h2>
      {companies.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-muted">None. Use “Hide company” on a match to stop seeing a company&apos;s jobs.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {companies.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[12px] font-semibold">
              {c}
              <button
                type="button"
                aria-label={`Show ${c} again`}
                onClick={async () => {
                  const res = await api<{ hiddenCompanies: string[] }>(`/api/v1/me/hidden-companies/${encodeURIComponent(c)}`, { method: "DELETE" });
                  setCompanies(res.hiddenCompanies);
                }}
                className="text-ink-muted hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

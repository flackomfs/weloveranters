'use client';

import { useEffect, useState } from 'react';

type PushConfigResponse = {
  configured: boolean;
  publicKey: string;
  subscribed: boolean;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw, (character) => character.charCodeAt(0)));
}

export function PushNotificationControl({ user }: { user: { id: string } | null | undefined }) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setIsLoading(true);
      setError('');
      setSubscription(null);
      setIsEnabled(false);
      setIsConfigured(false);
      setPublicKey('');
      if (!user) {
        setIsSupported(null);
        setIsLoading(false);
        return;
      }

      const supported = 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
      setIsSupported(supported);
      if (!supported) {
        setIsLoading(false);
        return;
      }

      try {
        const browserSubscription = await (await navigator.serviceWorker.getRegistration('/'))
          ?.pushManager.getSubscription() || null;
        const endpointQuery = browserSubscription
          ? `?endpoint=${encodeURIComponent(browserSubscription.endpoint)}`
          : '';
        const response = await fetch(`/api/push-subscriptions${endpointQuery}`, {
          cache: 'no-store',
        });
        const data = await response.json() as PushConfigResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to load device notification settings.');
        if (!active) return;

        setIsConfigured(data.configured);
        setPublicKey(data.publicKey);
        setSubscription(browserSubscription);
        if (browserSubscription && data.configured && !data.subscribed) {
          const saveResponse = await fetch('/api/push-subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(browserSubscription.toJSON())
          });
          const saveData = await saveResponse.json();
          if (!saveResponse.ok) throw new Error(saveData.error || 'Unable to register this device.');
          if (!active) return;
          setIsEnabled(true);
        } else {
          setIsEnabled(Boolean(browserSubscription && data.subscribed));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load device notification settings.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, [user]);

  async function toggleNotifications() {
    if (!user || isSaving) return;
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      if (isEnabled || subscription) {
        const activeSubscription = subscription
          || await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription()
          || null;
        if (!activeSubscription) {
          setIsEnabled(false);
          setSubscription(null);
          return;
        }

        const response = await fetch('/api/push-subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: activeSubscription.endpoint })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to disable device notifications.');
        await activeSubscription.unsubscribe();
        setSubscription(null);
        setIsEnabled(false);
        setMessage('Device notifications are off on this device.');
        return;
      }

      if (!isConfigured || !publicKey) {
        throw new Error('Device notifications are not configured on the server yet.');
      }

      if (Notification.permission === 'denied') {
        throw new Error('Notifications are blocked in your browser settings. Allow them for this site, then try again.');
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Allow notifications in your browser to enable device alerts.');

      await navigator.serviceWorker.register('/sw.js');
      const readyRegistration = await navigator.serviceWorker.ready;
      let activeSubscription = await readyRegistration.pushManager.getSubscription();
      const createdSubscription = !activeSubscription;
      if (!activeSubscription) {
        activeSubscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      const response = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeSubscription.toJSON())
      });
      const data = await response.json();
      if (!response.ok) {
        if (createdSubscription) await activeSubscription.unsubscribe();
        throw new Error(data.error || 'Unable to enable device notifications.');
      }

      setSubscription(activeSubscription);
      setIsEnabled(true);
      setMessage('Device notifications are enabled on this device.');
      setIsConfigured(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update device notifications.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Device notifications</h3>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Get browser alerts for enabled notification categories, even when the site is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggleNotifications()}
          disabled={!user || isLoading || isSaving || isSupported === false || (!isConfigured && !isEnabled && !subscription)}
          className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading || isSaving
            ? 'Please wait...'
            : isEnabled || subscription ? 'Turn off on this device' : 'Enable on this device'}
        </button>
      </div>
      {isSupported === false ? (
        <p className="mt-3 text-sm text-amber-300">
          This browser does not support web push. On iPhone or iPad, add the site to your Home Screen and open it there.
        </p>
      ) : null}
      {!isConfigured && isSupported ? (
        <p className="mt-3 text-sm text-amber-300">Device notifications need to be configured by the site owner.</p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}

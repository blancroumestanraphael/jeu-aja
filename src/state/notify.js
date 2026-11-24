// Notifications de l'appareil (si autorisées) : un rappel utile par jour au plus, à l'ouverture.
import { reminders } from '../engine/guide.js';
import { isoDay } from '../engine/community.js';

const KEY = 'generation-aja-notified';
export const notificationsSupported = () => 'Notification' in window;

export async function enableNotifications() {
  if (!notificationsSupported()) return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notifyReminders(store, data) {
  if (!notificationsSupported() || Notification.permission !== 'granted' || !store.save) return;
  const today = isoDay();
  try { if (localStorage.getItem(KEY) === today) return; } catch { return; }
  const r = reminders(store.save, data, today).find((x) => x.icon !== '🔥');
  if (!r) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification('Génération AJA', { body: r.text, icon: 'icons/icon-192.png', tag: 'rappel' });
    else new Notification('Génération AJA', { body: r.text });
    localStorage.setItem(KEY, today);
  } catch { /* rien */ }
}

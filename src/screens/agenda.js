// Agenda : rendez-vous quotidiens, hebdomadaires, saisonniers, vrais matchs de l'AJA.
import { esc } from '../ui/components.js';
import { agenda } from '../engine/guide.js';
import { isoDay } from '../engine/community.js';
import * as backend from '../state/backend.js';

const fmt = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
let serverEvents = [];

export default {
  render({ store, data }) {
    const a = agenda(store.save, data, isoDay(), serverEvents);
    const block = (title, list) => `
      <section class="card"><h3>${title}</h3>
        <ul class="agenda">${list.map((x) => `<li class="${x.status || ''}"><span>${x.icon}</span><div><b>${esc(x.title)}</b>${x.status === 'en-cours' ? ' <span class="chip">en cours</span>' : ''}<br><span class="small muted">${esc(x.text)}</span></div></li>`).join('')}</ul>
      </section>`;
    return `
      <a class="back" href="#/home">‹ Accueil</a>
      <h2 class="section-title">Agenda du supporter</h2>
      <section class="card"><h3>Vrais matchs de l’AJA</h3>
        <ul class="agenda">${a.matches.map((f) => `<li><span>${f.isKeyMatch ? '⭐' : '⚽'}</span><div><b>${f.home ? `AJA – ${esc(f.club.name)}` : `${esc(f.club.name)} – AJA`}</b><br><span class="small muted">${fmt(f.realDate)} · J${f.week}${f.isKeyMatch ? ' · Match de la veille la veille au soir' : ''}</span></div></li>`).join('')}</ul>
      </section>
      ${block('Chaque jour', a.daily)}
      ${block('Chaque semaine', a.weekly)}
      ${block('Événements et saison', a.seasonal)}
      ${serverEvents.length ? '' : '<p class="small muted">Les événements communautaires s’affichent quand le serveur est joignable.</p>'}`;
  },
  bind(root, { render }) {
    if (serverEvents.length) return;
    backend.checkServer().then((ok) => ok && backend.events()).then((r) => { if (r?.events?.length) { serverEvents = r.events; render(); } }).catch(() => {});
  },
};

import { esc, toast } from '../ui/components.js';
import { answerMessage, CHOICE_LABELS } from '../engine/events.js';
import { streamFor } from '../engine/rng.js';

const STATUS = { accepted: '✅ Monté', refused: '❌ Refusé', lost: '💔 Perdu', done: '✔ Traité' };
const KIND_ICON = { coach: '🧢', rival: '⚠️', sponsor: '💼', info: '🔎' };

export default {
  render({ store }) {
    const s = store.save;
    const pending = s.messages.filter((m) => m.status === 'pending');
    const done = s.messages.filter((m) => m.status !== 'pending').slice(0, 20);
    const card = (m) => {
      const late = m.kind === 'coach' && s.week > m.waitUntil;
      return `
      <article class="card msg ${m.status === 'pending' ? 'pending' : ''}">
        <div class="msg-head"><span class="msg-i">${KIND_ICON[m.kind] || '📨'}</span>
          <div><b>${esc(m.title)}</b><br><span class="small muted">Semaine ${m.week}${m.waited ? ' · en attente' : ''}</span></div></div>
        <p>${esc(m.body)}</p>
        ${m.playerId && s.players[m.playerId] && s.players[m.playerId].team !== 'PARTI' ? `<a class="link small" href="#/player/${m.playerId}">Voir la fiche ›</a>` : ''}
        ${m.status === 'pending' ? `
          ${m.kind === 'coach' ? `<p class="small ${late ? 'warn' : 'muted'}">${late ? '⚠ Trop d’attente : 25 % de risque par semaine qu’un club rival le recrute.' : `Réponse attendue avant la semaine ${m.waitUntil + 1}.`}</p>` : ''}
          <div class="choices">${m.choices.map((c, i) => `<button class="btn ${i === 0 ? 'btn-primary' : ''}" data-msg="${m.id}" data-choice="${c}">${CHOICE_LABELS[c]}</button>`).join('')}</div>`
        : `<p class="small"><b>${STATUS[m.status] || ''}</b></p>`}
      </article>`;
    };
    return `
      <h2 class="section-title">Messages</h2>
      ${pending.length ? pending.map(card).join('') : '<p class="card muted">Aucun message en attente. Les coachs des U15 et U17 vous écrivent quand un jeune est prêt.</p>'}
      ${done.length ? `<h3 class="section-title">Historique</h3>${done.map(card).join('')}` : ''}`;
  },
  bind(root, { store, render }) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-msg]');
      if (!b) return;
      const s = store.save;
      const next = answerMessage(s, b.dataset.msg, b.dataset.choice, streamFor(s, 'answer', b.dataset.msg));
      store.set(next);
      const m = next.messages.find((x) => x.id === b.dataset.msg);
      toast(m.status === 'pending' ? 'On attend encore un peu…' : STATUS[m.status] || 'OK');
      render();
    });
  },
};

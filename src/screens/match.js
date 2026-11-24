import { esc, toast } from '../ui/components.js';
import { createKeyMatch, playKeySegment, canPlayKeyMatch, KEY_MOMENTS, saveKeyResult } from '../engine/keymatch.js';
import { INSTRUCTIONS } from '../engine/match.js';
import { advanceWeek } from '../engine/week.js';

const MS_PER_MIN = 90;
let km = null;

const ICON = { goal: '⚽', chance: '•', card: '🟨', red: '🟥', kickoff: '🏁', halftime: '⏸', fulltime: '🏁' };

function scoreboard(home, away) {
  return `
    <div class="scoreboard">
      <div class="sb-team">${esc(home)}</div>
      <div class="sb-score"><span id="sb-h">0</span> - <span id="sb-a">0</span><div class="sb-min" id="sb-min">0′</div></div>
      <div class="sb-team">${esc(away)}</div>
    </div>`;
}

/** Fait défiler les événements de fromMin à toMin. Renvoie une fonction d'arrêt. */
function animate(root, events, fromMin, toMin, { onDone, ajaSide }) {
  const feed = root.querySelector('#feed');
  const hEl = root.querySelector('#sb-h');
  const aEl = root.querySelector('#sb-a');
  const mEl = root.querySelector('#sb-min');
  let minute = fromMin;
  const shown = new Set([...feed.querySelectorAll('[data-ev]')].map((x) => x.dataset.ev));
  const tick = () => {
    mEl.textContent = `${minute}′`;
    events.forEach((ev, i) => {
      if (ev.minute <= minute && !shown.has(String(i))) {
        shown.add(String(i));
        const li = document.createElement('li');
        li.dataset.ev = i;
        li.className = `ev ev-${ev.type} ${ev.side ? (ev.side === ajaSide ? 'ev-us' : 'ev-them') : ''}`;
        li.innerHTML = `<span class="ev-m">${ev.minute}′</span><span class="ev-i">${ICON[ev.type] || ''}</span><span>${esc(ev.text || '')}</span>`;
        feed.prepend(li);
      }
    });
    const upTo = events.filter((e) => e.minute <= minute && e.type === 'goal');
    hEl.textContent = upTo.filter((e) => e.side === 'home').length;
    aEl.textContent = upTo.filter((e) => e.side === 'away').length;
  };
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    onDone?.();
  };
  tick();
  const timer = setInterval(() => {
    minute++;
    tick();
    if (minute >= toMin) end();
  }, MS_PER_MIN);
  const skip = () => {
    minute = toMin;
    tick();
    end();
  };
  return { stop: () => clearInterval(timer), skip };
}

export default {
  fullscreen: false,
  render({ store, param }) {
    const s = store.save;
    if (param === 'veille') {
      const can = canPlayKeyMatch(s, store.data);
      if (!can.ok) return `<a class="back" href="#/home">‹ Accueil</a><p class="card">Le Match de la veille n’est pas disponible ${can.played ? '(déjà joué cette semaine)' : 'pour le moment'}.</p>`;
      km = createKeyMatch(s, store.data);
      return `
        <div class="match-head key">⭐ Match de la veille · J${s.week}</div>
        ${scoreboard(km.home.name, km.away.name)}
        <div id="key-panel" class="card key-panel">
          <p>Demain, l’AJA affronte <b>${esc(km.club.name)}</b> ${km.fixture.home ? 'à l’Abbé-Deschamps' : 'à l’extérieur'}. Jouez-le ce soir : vous donnerez la consigne lors de <b>3 temps forts</b>. Le résultat comptera pour la journée.</p>
          <p class="small muted">Votre XI : note ${km[km.ajaSide].rating.toFixed(1)} · adversaire ${km.club.level}</p>
          <button class="btn btn-primary btn-big" data-action="kickoff">Coup d’envoi</button>
        </div>
        <ol class="feed" id="feed" aria-live="polite"></ol>`;
    }
    const r = s.lastReport;
    if (!r) return '<a class="back" href="#/home">‹ Accueil</a><p class="card muted">Aucun match joué pour l’instant.</p>';
    return `
      <div class="match-head">Ligue 1 · J${r.week}${r.l1.fromKeyMatch ? ' · ⭐ joué la veille' : ''}</div>
      ${scoreboard(r.l1.home, r.l1.away)}
      <div class="row-center"><button class="btn btn-small" data-action="skip">Passer ⏭</button></div>
      <ol class="feed" id="feed" aria-live="polite"></ol>
      <section class="card hidden" id="after">
        <h3>Bilan de la semaine ${r.week}</h3>
        <p><b>Classement :</b> ${r.position}<sup>e</sup> de Ligue 1</p>
        <p><b>U19 :</b> ${esc(r.u19.home)} ${r.u19.hg}-${r.u19.ag} ${esc(r.u19.away)}</p>
        ${r.progress.length ? `<p><b>Progression des jeunes :</b> ${r.progress.length} joueur(s) ont gagné en note.</p>` : ''}
        ${r.newMessages.length ? `<p><b>Nouveaux messages :</b> ${r.newMessages.map(esc).join(' · ')}</p>` : ''}
        ${r.lines.map((l) => `<p class="small">${esc(l)}</p>`).join('')}
        ${r.xp ? `<p class="small ok">+${r.xp} XP de fidélité · <a href="#/supporter">espace supporter</a></p>` : ''}
        <div class="choices">
          <a class="btn btn-primary" href="#/home">Continuer</a>
          ${r.newMessages.length ? '<a class="btn" href="#/messages">Lire les messages</a>' : ''}
        </div>
      </section>`;
  },

  bind(root, { store, data, param, go }) {
    let anim = null;
    const ajaSideOf = (r) => (r.l1.home === 'AJ Auxerre' ? 'home' : 'away');
    if (param !== 'veille') {
      const r = store.save.lastReport;
      if (!r) return null;
      const done = () => root.querySelector('#after')?.classList.remove('hidden');
      anim = animate(root, r.l1.events, 0, 90, { onDone: done, ajaSide: ajaSideOf(r) });
      root.querySelector('[data-action="skip"]').addEventListener('click', () => anim.skip());
      return () => anim?.stop();
    }
    if (!km) return null;
    const panel = root.querySelector('#key-panel');
    const minuteOf = (slice) => slice * 5;

    const askInstruction = () => {
      const n = km.choices.length + 1;
      panel.innerHTML = `
        <p class="eyebrow">Temps fort ${n}/3 · ${minuteOf(KEY_MOMENTS[n - 1])}′</p>
        <p>${['L’adversaire monte en pression. Quelle consigne ?', 'La mi-temps approche, il faut décider du plan.', 'Dernier quart d’heure : tout se joue maintenant !'][n - 1]}</p>
        <div class="choices col">${Object.entries(INSTRUCTIONS).map(([k, v]) => `
          <button class="btn instr" data-instr="${k}"><b>${v.label}</b><span class="small">${v.desc}</span></button>`).join('')}</div>`;
    };

    const finish = () => {
      const st = km.state;
      store.set(saveKeyResult(store.save, km));
      const aja = km.ajaSide === 'home' ? st.homeGoals : st.awayGoals;
      const opp = km.ajaSide === 'home' ? st.awayGoals : st.homeGoals;
      panel.innerHTML = `
        <h3>${aja > opp ? '🎉 Victoire !' : aja < opp ? 'Défaite…' : 'Match nul'} ${st.homeGoals}-${st.awayGoals}</h3>
        <p class="small ok">+25 XP supporter · Match de la veille joué</p>
        <p>Ce résultat est enregistré pour la J${store.save.week}. Consignes : ${km.choices.map((c) => INSTRUCTIONS[c].label).join(' → ')}.</p>
        <div class="choices">
          <button class="btn btn-primary" data-action="advance">Passer à la semaine suivante ▶</button>
          <a class="btn" href="#/home">Accueil</a>
        </div>`;
      km = { ...km, done: true };
    };

    const runSegment = (instr) => {
      const fromMin = minuteOf(km.state.slice);
      playKeySegment(km, data, instr);
      const toMin = Math.min(90, minuteOf(km.state.slice));
      panel.innerHTML = `<p class="center muted">${instr ? `Consigne : <b>${INSTRUCTIONS[instr].label}</b>` : 'Le match est lancé…'}</p>
        <div class="row-center"><button class="btn btn-small" data-action="skip-seg">Accélérer ⏭</button></div>`;
      anim = animate(root, km.state.events, fromMin, toMin, {
        ajaSide: km.ajaSide,
        onDone: () => (km.state.finished ? finish() : askInstruction()),
      });
    };

    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action],[data-instr]');
      if (!b) return;
      if (b.dataset.action === 'kickoff') runSegment(null);
      else if (b.dataset.action === 'skip-seg') anim?.skip();
      else if (b.dataset.instr) {
        km.choices.push(b.dataset.instr);
        runSegment(b.dataset.instr);
      } else if (b.dataset.action === 'advance') {
        const { save } = advanceWeek(store.save, data);
        store.set(save);
        toast('Semaine suivante');
        go('match', 'replay');
      }
    });
    return () => anim?.stop();
  },
};

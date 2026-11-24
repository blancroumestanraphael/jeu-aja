// Tableau de bord administrateur : engagement, rétention, événements, campagnes partenaires, erreurs.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = sessionStorage.getItem('aja-admin') || '';

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

async function load() {
  const app = $('#app');
  try {
    const [st, ev, camp] = await Promise.all([api('GET', '/admin/stats'), api('GET', '/events'), api('GET', '/admin/campaigns')]);
    const max = Math.max(1, ...st.days.map((d) => d.active));
    const pct = (v) => (v === null ? '–' : `${v} %`);
    app.innerHTML = `
      <section class="card"><h2>Engagement</h2>
        <div class="kpis">
          <div class="kpi"><b>${st.users}</b><span>supporters inscrits</span></div>
          <div class="kpi"><b>${st.dau}</b><span>actifs aujourd’hui (DAU)</span></div>
          <div class="kpi"><b>${st.wau}</b><span>actifs 7 jours (WAU)</span></div>
          <div class="kpi"><b>${st.mau}</b><span>actifs 30 jours (MAU)</span></div>
          <div class="kpi"><b>${pct(st.retention.d1)}</b><span>rétention J1</span></div>
          <div class="kpi"><b>${pct(st.retention.d7)}</b><span>rétention J7</span></div>
          <div class="kpi"><b>${pct(st.retention.d30)}</b><span>rétention J30</span></div>
          <div class="kpi"><b>${st.avgActiveDays}</b><span>jours actifs moyens</span></div>
        </div>
      </section>
      <div class="grid2">
        <section class="card"><h2>Supporters actifs par jour (14 jours)</h2>
          <div class="bars">${st.days.map((d) => `<div title="${d.day} : ${d.active} actifs, ${d.actions} actions"><span>${d.active}</span><i style="height:${(d.active / max) * 90}px"></i><span>${d.day.slice(8)}</span></div>`).join('')}</div>
        </section>
        <section class="card"><h2>Actions des 14 derniers jours</h2>
          <table><tbody>${Object.entries(st.days.reduce((t, d) => { for (const [k, v] of Object.entries(d.byType)) t[k] = (t[k] || 0) + v; return t; }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td class="muted">Aucune action.</td></tr>'}</tbody></table>
          <h2 style="margin-top:12px">Supporters par commune</h2>
          <table><tbody>${Object.entries(st.communes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td class="muted">—</td></tr>'}</tbody></table>
        </section>
      </div>
      <section class="card"><h2>Défis collectifs et événements</h2>
        <table><thead><tr><th>Événement</th><th>Période</th><th>Portée / mesure</th><th>Progression</th><th></th></tr></thead><tbody>
          ${ev.events.map((e) => `<tr><td><b>${esc(e.title)}</b><br><span class="muted">${esc(e.id)}</span></td><td>${e.start} → ${e.end}<br><span class="muted">${e.status}</span></td><td>${e.scope} / ${e.metric}</td><td>${e.progress} / ${e.target}${e.completed ? ' ✅' : ''}<br><span class="muted">${e.contributors} contributeurs</span></td>
          <td><button class="ghost" data-edit='${esc(JSON.stringify(e))}'>Modifier</button> <button class="danger" data-del="${esc(e.id)}">Supprimer</button></td></tr>`).join('')}
        </tbody></table>
        <h2 style="margin-top:14px">Créer / modifier un événement</h2>
        <form id="ev-form">
          <label>Identifiant<input name="id" required pattern="[a-z0-9-]{3,40}" placeholder="defi-printemps"></label>
          <label>Titre<input name="title" required></label>
          <label>Portée<select name="scope"><option value="global">Tous les supporters</option><option value="yonne">Supporters de l’Yonne (89)</option><option value="commune">Compétition entre communes</option></select></label>
          <label>Mesure<select name="metric"><option value="actions">actions</option><option value="wins">victoires</option><option value="goals">buts</option><option value="quiz">bonnes réponses</option><option value="missions">missions</option><option value="recruits">recrutements</option></select></label>
          <label>Objectif<input name="target" type="number" min="1" required></label>
          <label>Début<input name="start" type="date" required></label>
          <label>Fin<input name="end" type="date" required></label>
          <label>Badge (récompense)<input name="badge"></label>
          <label>Icône<input name="icon" maxlength="4" value="🎯"></label>
          <label style="grid-column:1/-1">Texte<textarea name="text" rows="2"></textarea></label>
          <div><button>Enregistrer l’événement</button></div>
        </form>
      </section>
      <section class="card"><h2>Campagnes partenaires</h2>
        <p class="muted">Un partenariat « réel » exige une référence d’accord signé (club + partenaire). Les récompenses réelles ne sont proposées qu’après validation.</p>
        <table><thead><tr><th>Partenaire</th><th>Statut</th><th>Condition</th><th>Récompense en jeu</th><th>Récompense réelle</th><th>Utilisations</th></tr></thead><tbody>
          ${camp.campaigns.map((c) => `<tr><td><b>${esc(c.partner)}</b><br><span class="muted">${esc(c.city || '')} ${c.start || ''} → ${c.end || ''}</span></td><td><span class="tag ${c.status}">${c.status}</span>${c.agreementRef ? `<br><span class="muted">${esc(c.agreementRef)}</span>` : ''}</td><td>${esc(c.condition)}</td><td>${esc(c.rewardInGame)}</td><td>${esc(c.rewardReal || '—')}</td><td>${c.redemptions}</td></tr>`).join('') || '<tr><td class="muted" colspan="6">Aucune campagne.</td></tr>'}
        </tbody></table>
        <h2 style="margin-top:14px">Créer une campagne</h2>
        <form id="camp-form">
          <label>Identifiant<input name="id" required pattern="[a-z0-9-]{3,40}"></label>
          <label>Partenaire<input name="partner" required></label>
          <label>Commune<input name="city" placeholder="sens"></label>
          <label>Statut<select name="status"><option value="fictif">fictif (démonstration)</option><option value="reel">réel (accord signé)</option></select></label>
          <label>Référence d’accord<input name="agreementRef" placeholder="obligatoire si réel"></label>
          <label>Condition<input name="condition" placeholder="Mission de Sens accomplie"></label>
          <label>Récompense en jeu<input name="rewardInGame" placeholder="Badge + 40 XP"></label>
          <label>Récompense réelle<input name="rewardReal" placeholder="-10 % (si autorisée)"></label>
          <label>Début<input name="start" type="date"></label>
          <label>Fin<input name="end" type="date"></label>
          <div><button>Enregistrer la campagne</button></div>
        </form>
      </section>
      <section class="card"><h2>Dernières erreurs remontées</h2>
        <table><tbody>${st.errors.map((e) => `<tr><td>${esc(e.at)}</td><td>${esc(e.route)}</td><td>${esc(e.msg)}</td><td>${esc(e.version)}</td></tr>`).join('') || '<tr><td class="muted">Aucune erreur 🎉</td></tr>'}</tbody></table>
      </section>`;
    bind();
  } catch (e) {
    app.innerHTML = `<p class="card err">${esc(e.message)}</p>`;
  }
}

function bind() {
  $('#ev-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await api('POST', '/admin/events', { event: { ...f, target: Number(f.target), reward: f.badge ? { badge: f.badge, icon: f.icon || '🎯' } : null } });
      load();
    } catch (err) { alert(err.message); }
  });
  $('#camp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('POST', '/admin/campaigns', { campaign: Object.fromEntries(new FormData(e.target)) }); load(); } catch (err) { alert(err.message); }
  });
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (confirm(`Supprimer l’événement ${b.dataset.del} ?`)) { await api('DELETE', `/admin/events/${b.dataset.del}`); load(); }
  }));
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const ev = JSON.parse(b.dataset.edit);
    const form = $('#ev-form');
    for (const k of ['id', 'title', 'scope', 'metric', 'target', 'start', 'end', 'text']) form.elements[k].value = ev[k] ?? '';
    form.elements.badge.value = ev.reward?.badge || '';
    form.elements.icon.value = ev.reward?.icon || '🎯';
    form.scrollIntoView({ behavior: 'smooth' });
  }));
}

$('#login').addEventListener('submit', (e) => {
  e.preventDefault();
  token = $('#token').value;
  sessionStorage.setItem('aja-admin', token);
  load();
});
if (token) load();

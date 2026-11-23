import { esc, clubNav } from '../ui/components.js';
import { sortedTable } from '../engine/league.js';
import { clubById } from '../engine/week.js';

export default {
  render({ store, data }) {
    const s = store.save;
    const rows = sortedTable(s.table).map((r, i) => {
      const c = clubById(data, r.id);
      const zone = i === 0 ? 'z-cl' : i < 4 ? 'z-cl' : i < 6 ? 'z-eu' : i === 15 ? 'z-bar' : i >= 16 ? 'z-rel' : '';
      return `<tr class="${r.id === 'auxerre' ? 'me' : ''} ${zone}">
        <td>${i + 1}</td><td class="team"><span class="fx-dot" style="background:${esc(c.color)}"></span>${esc(c.short)}</td>
        <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td>
        <td class="form">${r.form.map((f) => `<i class="f-${f}">${f}</i>`).join('')}</td></tr>`;
    }).join('');
    return `
      ${clubNav('table')}
      <h2 class="section-title">Ligue 1 ${esc(s.season)} — classement simulé</h2>
      <div class="card scroll-x">
        <table class="tbl standings">
          <thead><tr><th>#</th><th>Club</th><th>J</th><th>G</th><th>N</th><th>P</th><th>Diff</th><th>Pts</th><th>Forme</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="small muted">Bleu : Ligue des champions · vert : Europe · orange : barrage · rouge : relégation. Les autres clubs ont un niveau fixe.</p>`;
  },
};

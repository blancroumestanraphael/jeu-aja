// Profil public d'un supporter.
import { esc } from '../ui/components.js';
import * as backend from '../state/backend.js';
import { profileCard } from './community.js';

export default {
  render() {
    return '<a class="back" href="#/community">‹ Communauté</a><div id="pp"><div class="card"><p class="muted">Chargement du profil…</p></div></div>';
  },
  bind(root, { param }) {
    backend.publicProfile(param)
      .then(({ profile }) => { root.querySelector('#pp').innerHTML = profileCard(profile); })
      .catch((e) => { root.querySelector('#pp').innerHTML = `<p class="card warn">${esc(e.message)}</p>`; });
  },
};

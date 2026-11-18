import { crest } from '../ui/components.js';

export default {
  render({ data }) {
    return `
      <div class="welcome">
        ${crest(96)}
        <h1>Génération <b>AJA</b></h1>
        <p class="lead">Dirigez l’équipe 1 de l’AJ Auxerre et ses U19, faites grandir les jeunes et recrutez dans toute l’Yonne.</p>
        <ul class="welcome-list">
          <li>⚽ Effectif réel ${data.fixtures.season} — notes EA SPORTS FC 27</li>
          <li>📅 Vrai calendrier de Ligue 1 (34 journées)</li>
          <li>🌱 Centre de formation : U19 gérés, U17 et U15 simulés</li>
          <li>🗺️ 8 villes de l’Yonne à conquérir</li>
        </ul>
        <button class="btn btn-primary btn-big" data-action="new">Nouvelle partie</button>
        <p class="muted small">Jeu non officiel, sans lien avec l’AJ Auxerre. Sauvegarde automatique sur cet appareil.</p>
      </div>`;
  },
  bind(root, { store, go }) {
    root.querySelector('[data-action="new"]').addEventListener('click', () => {
      store.newGame();
      go('home');
    });
  },
};

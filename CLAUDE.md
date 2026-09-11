# Support IT — boîte à outils IA pour techniciens de support

Avant toute modification, lire dans cet ordre :

1. `etat-d-avancement.md` — où on en est, les invariants, et la liste à
   suivre selon ce que tu modifies (section 4).
2. `plan.md` section 0 — le vocabulaire (« skill » a un sens précis ici) et
   les décisions de fond.
3. `fin-de-projet.md` — ce qui est livré et les décisions prises.

Après toute modification, depuis `produit/serveur/` :

```bash
npm run build && node dist/cli.js valider && npm test
```

Règles qui ne se discutent pas : tout en français ; aucune donnée
d'entreprise dans `produit/contenu/` ; le modèle ne fabrique jamais un
chemin, un identifiant ou une date ; rien n'est écrit hors de
`installation/` ; le contexte n'est jamais écrit sans le oui du technicien.

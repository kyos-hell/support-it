# Audit de l'installation

## Ce qu'on fait ici

Ce n'est pas un ticket. Le technicien (ou le référent) a demandé
« /support audit ». Le serveur vient de **calculer et d'écrire** le rapport
qui suit — daté, conservé dans `installation/audits/`. Tu ne comptes rien,
tu ne recalcules rien : tu **présentes** les constats et tu **proposes**,
un par un. Tu n'écris jamais de toi-même.

## Règles

- **Une question, puis tu attends la réponse.** Un constat à la fois, dans
  l'ordre du rapport ; le suivant seulement après la réponse.
- **Rien n'est écrit sans un oui explicite** sur ce qui est montré. Tes
  seules écritures possibles : `save_ticket` (clôturer un vieux brouillon),
  `publish_kb` (publier un résolu), `update_context` (confirmer ou corriger
  une section). Rien d'autre. Un silence, un « bof », un « on verra » ne
  sont pas des oui.
- **Jamais une archive.** Un ticket clôturé, un journal, une entrée de base
  ne se modifient pas. Ce qui les concerne (tag hors bibliothèque, domaine
  inconnu, YAML cassé, titre mal formé, doublon) se **signale** : « à
  corriger à la main », avec le fichier et la ligne. Pas d'appel.
- **Le manifeste ne se touche pas ici.** Un écart du jeu de test du triage
  désigne un signal à revoir par le référent, plus tard, hors ticket. Tu le
  nommes, tu ne le corriges pas.

## Déroulé

1. **Annoncer** le rapport en trois lignes : où il est écrit, combien de
   constats, ce qui demande un oui et ce qui se corrige à la main.
2. **Brouillons anciens** — pour chacun : référence, âge, étape, prochaine
   étape notée. « Clôturer en `non-resolu` ? » Sur oui : `resume_ticket(id)`
   pour le rendre courant, `load_skill(["cloture"])`, puis `save_ticket`
   avec le statut `non-resolu`, la conclusion « abandonné à l'audit du
   <date>, à l'étape <étape> », sans plan. Sur non : suivant.
3. **Résolus jamais publiés** — pour chacun : référence, domaine, conclusion
   (la lire avec `read_kb` n'est pas possible tant qu'il n'est pas publié :
   citer la ligne du rapport). « Publier ? » Sur oui : `publish_kb(id)`,
   sans tag supplémentaire sauf si le technicien en coche.
4. **Sections périmées** — pour chacune : la charger avec `get_context`, la
   montrer en entier. « Toujours vrai ? » Oui : `update_context` avec le
   contenu **identique** (le serveur re-date seulement). Non : demander ce
   qui a changé, montrer le nouveau contenu, oui, `update_context`.
5. **File des candidats** — pour chaque section, la plus demandée en tête :
   montrer le contenu candidat en entier, à côté de ce que la section
   contient aujourd'hui (`get_context`). Une contradiction se tranche par le
   technicien : « le contexte dit X, le ticket a constaté Y — lequel est
   vrai ? ». Oui → `update_context`.
6. **Le reste se signale** : zombies et orphelins (fichiers à supprimer à
   la main), tags hors bibliothèque, santé des fichiers, points d'étape à
   plusieurs actions (un indice : rappeler « une commande, puis j'attends la
   sortie »), volumineuses, placeholders, copies dans `historique/`. Une
   ligne par constat, l'action à faire, par qui.
7. **Le jeu de test du triage et les mesures** ne demandent rien : les
   résumer en deux lignes (nombre d'écarts, ce qu'ils désignent ; durées et
   questions par ticket) et renvoyer au rapport écrit.
8. **Terminer** en une ligne : ce qui a été fait, ce qui reste à la main.

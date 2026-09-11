# État d'avancement — à lire avant de toucher au projet

> Écrit pour une IA (ou un humain) qui ouvre ce dépôt à froid. Il dit où on
> en est, ce qui ne se casse pas, et ce qu'il faut mettre à jour quand on
> modifie telle ou telle partie. Il complète `plan.md` (l'étude, le
> pourquoi) et `fin-de-projet.md` (ce qui a été livré et décidé, le quoi).
> Dernière mise à jour : 2026-09-11. Vérifier `git log` : ce fichier décrit
> l'arbre de travail, pas forcément le dernier commit.

---

## 1. Où on en est

**Bêta 0.1.0 livrée le 2026-09-09, testée par l'auteur seul, sur son poste,
avec Claude Code.** Deux domaines couverts (réseau, système), quatre décrits
mais hors bêta (poste de travail, matériel, identité, applicatif). Deux
tickets réels joués (un build Azure, un build AWS), qui ont chacun révélé
un manque et conduit à une évolution le jour même.

**Bêta v2 (`0.2.0-beta`) le 2026-09-11 : les six domaines sont couverts.**
Les quatre nouveaux n'ont jamais été joués sur un ticket réel — ce sont des
hypothèses, à éprouver domaine par domaine. Le manifeste n'a plus de
domaine `decrit` ; la branche « hors bêta » du serveur reste testée par un
domaine synthétique dans le test de fumée.

Depuis la version commitée, dans l'arbre de travail :

| Date | Évolution | Déclencheur |
| --- | --- | --- |
| 2026-09-09 | `update_context` + skill `remplissage` + consigne du gabarit renvoyée sur section vide | Tester à vide : le contexte doit se remplir par conversation |
| 2026-09-09 | Taxonomie du contexte (structure / pivots / instances), section `general/plateformes` | L'outil proposait d'inscrire une VM de projet dans le contexte |
| 2026-09-09 | Référence du ticket externe demandée avant le triage, champ `reference` | Le technicien part toujours d'un ticket de son outil |
| 2026-09-10 | `save_progress` + `resume_ticket` : brouillon par ticket dans `en-cours/`, pause, reprise, passation | Impossible de changer de ticket ou de passer la main |
| 2026-09-10 | Taxonomie du brouillon : limites par entrée refusées par le serveur, corps du fichier réduit | Premier brouillon réel : 29 Ko de récit |
| 2026-09-10 | Schéma `architecture/schema/routage_support_v3.svg` | Nouveau flux |
| 2026-09-11 | Boucle de fraîcheur du contexte (différée), périmètre I documentation, section 5 montée en charge | Discussion : garder le contexte à jour, RAG, passage à l'échelle |
| 2026-09-11 | Décision : le cloud est une plateforme, pas un domaine | Point ouvert depuis le premier ticket |
| 2026-09-11 | **Bêta v2** : quatre domaines de plus (skill, demandes, gabarit), 44 sections, smoke sur six domaines | Le deuxième ticket avait besoin d'identité |
| 2026-09-11 | Journal : un fichier par ticket au lieu d'un par question | Onze fichiers pour deux tickets, redondants avec le ticket |
| 2026-09-11 | Scripts d'installation : `tester` à l'étape 3, `init` note `installation/VERSION` et annonce « MISE À JOUR », `.gitattributes` (LF / CRLF + BOM), bit exécutable de `install.sh`, console UTF-8, note ExecutionPolicy | L'auteur n'installe que par les scripts ; la mise à jour v1 → v2 devait être visible et sûre |

État des contrôles : `npm run build` propre, `node dist/cli.js valider`
zéro erreur (six avertissements de longueur acceptés, tous entre 101 et
107 lignes), `npm test` vert sur les huit appels et les six domaines.

**Ce qui reste à faire**, dans l'ordre :

1. Commiter l'arbre de travail (`git add -A`, message de version 0.2.0-beta).
2. Sur l'installation existante : `node dist/cli.js init` (mode rejoindre)
   pour recevoir les quatre nouveaux gabarits ; `etat` doit passer de
   « ABSENT » à « vide » sur les quatre.
3. Les tests de la porte 1 par le testeur : `conception/validation.md` §3,
   T-P1 à T-P9, **et** T-A1, T-B5, T-B6 sur les quatre nouveaux domaines.
   Noter dans `conception/retours-beta.md`.
4. `creation-vm` côté système avec la plateforme en prérequis, et la
   nuance « destination créée par le même plan » dans `ouverture-flux` —
   après avoir implémenté « une demande par fichier » (`validation.md` §6),
   `demandes.md` système étant à sa limite.
5. Faire monter au manifeste les tags libres qui reviennent (règle : trois
   occurrences).
6. Porte 2 (collègues, partage réseau) : implémenter l'empreinte optimiste
   sur le contexte et les brouillons (`architecture/D-serveur-mcp.md` §8).

## 2. Carte du dépôt — quoi lire pour quoi

| Besoin | Fichier |
| --- | --- |
| Comprendre le produit, le vocabulaire, les décisions de fond | `plan.md` section 0 (à lire en entier avant tout) |
| Ce qui a été livré, les 26 décisions prises seul, les limites | `fin-de-projet.md` |
| Le contrat des huit appels MCP, dans le détail | `conception/contrat-mcp.md` |
| Comment le serveur est construit, ses cas limites | `architecture/D-serveur-mcp.md` |
| Le flux en image | `architecture/schema/routage_support_v3.svg` |
| Ce qu'un skill contient et ne contient pas | `conception/format-skill.md` |
| Ce qu'un contexte contient, et surtout ce qu'il ne contient pas | `conception/format-contexte.md` (§4.1 : la taxonomie) |
| Comment le triage décide, l'escalade, la reprise | `conception/triage.md` et le texte livré `produit/contenu/general/triage.md` |
| Les tests et le journal de ce qui a été joué | `conception/validation.md` |
| Les observations de la bêta | `conception/retours-beta.md` |
| Installer, mettre à jour, distribuer | `conception/deploiement.md`, `produit/install.ps1`, `produit/install.sh` |

Le contenu que le modèle lit à l'usage est **entièrement** dans
`produit/contenu/` : `manifeste.yaml`, `general/{triage,cloture,remplissage,contexte.exemple}.md`,
`domaines/<id>/{skill,demandes,contexte.exemple}.md`. Rien d'autre n'arrive
jamais en contexte du modèle.

## 3. Les invariants — ce qui ne se casse pas

Chaque invariant dit **où il est tenu**. S'il n'est tenu que par le prompt,
il est fragile et il faut le savoir.

| Invariant | Tenu par |
| --- | --- |
| Le serveur ne raisonne jamais ; l'intelligence est dans `contenu/`, le déterminisme dans `serveur/`. | Architecture : aucun appel ne prend une décision qu'un skill pourrait prendre. |
| Le modèle ne fabrique jamais un chemin, un identifiant, une date. | Contrat : aucun appel n'a de paramètre de chemin ; le serveur fabrique tout (`ids.ts`). |
| Rien n'est écrit hors de `installation/` ; `produit/` se remplace en bloc. | Code (`config.ts`), scripts d'installation, test de fumée (liste des dossiers créés). |
| Aucune donnée d'entreprise dans `produit/contenu/`, même en exemple. | `valider` (regex IP, UNC, mail, domaine interne, nom d'hôte plausible). Placeholders `<...>` uniquement. |
| Un ticket clôturé, un journal, une entrée de base : écrits une fois, jamais modifiés. | Code (`flag: "wx"`). |
| Seules deux matières sont mutables : le contexte (`update_context`, avec copie dans `contexte/historique/`) et les brouillons (`save_progress`, fusion). La seule suppression est le brouillon à la clôture. | Code. Concurrence non protégée en mono-poste ; empreinte prévue à la porte 2. |
| Le contexte n'est jamais écrit sans un oui explicite du technicien. | **Prompt seulement** (`remplissage.md`, `cloture.md`, description de l'outil). |
| Trois points de validation humaine : triage ambigu, plan d'action, publication. Pas de quatrième. | Prompt (`triage.md`, `cloture.md`) + contrat (`publish_kb` distinct de `save_ticket`). |
| L'IA n'exécute rien : le technicien exécute et rapporte. | **Prompt + mode de permission de Claude Code.** Aucun appel MCP n'exécute quoi que ce soit, mais l'outil hôte, lui, pourrait. |
| Une question à la fois. | Prompt seulement. |
| Un skill fait ~100 lignes (110 max), pas de persona au-delà d'une ligne, chaque ligne passe le test de valeur. | `valider` (longueur) + relecture (T-B1). |
| Les identifiants de sections (`domaine/section`) sont le contrat entre skills, gabarits et serveur ; renommer un `id` est interdit sans note de version. | `valider` (contrat B/C dans les deux sens). |
| Le symptôme initial est conservé tel qu'exprimé. | Prompt + obligatoire à la création d'un brouillon et d'un ticket. |
| Le contexte reçoit la structure et les pivots, jamais les instances d'un ticket. | Prompt (`remplissage.md`, `cloture.md`) + signal « volumineuse » de `etat`. |

## 4. Si tu modifies… — les listes à suivre

Toute modification se termine par les trois mêmes commandes, depuis
`produit/serveur/` :

```bash
npm run build && node dist/cli.js valider && npm test
```

Puis : une ligne au journal de `conception/validation.md` §7, une ligne
dans le tableau des décisions de `fin-de-projet.md` §4 (numérotée, avec le
pourquoi), et une date **absolue** partout où l'on écrit « aujourd'hui ».

### 4.1 Une section de contexte (gabarit)

- Titre `## id — Titre lisible`, `id` en kebab-case, jamais renommé ensuite.
- Consigne de remplissage en commentaire HTML sous le titre ; placeholders
  `<...>` uniquement ; ligne `Dernière mise à jour : <date>` si la section
  périme vite.
- Vérifier qu'elle est de **niveau 1 ou 2** (`format-contexte.md` §4.1) :
  ce que l'entreprise possède ou un pivot, pas un inventaire d'instances.
- La déclarer dans au moins un skill (`requis` ou `selon-cas`), sinon
  `valider` avertit. Mettre à jour la liste de `format-contexte.md` §6.
- Effet chez un client déjà installé : `etat` la montre **manquante**, et
  `update_context` l'ajoutera au premier remplissage (cas H4). Ne jamais
  migrer le fichier du client par script.

### 4.2 Un domaine

- `manifeste.yaml` : `id`, `libelle`, `statut: beta`, `suit`, `signaux`
  (des faits observables, pas des composants), `tags`.
- `contenu/domaines/<id>/` : `skill.md`, `demandes.md`, `contexte.exemple.md`
  depuis `_template/`. En-tête YAML : `domaine` = nom du dossier,
  `contexte.requis`, `contexte.selon-cas` dont chaque clé est citée dans le
  corps et figure dans les `tags` du manifeste.
- `conception/taxonomie.md` : section du domaine, voisins, symptômes ambigus
  → jeu de test T-A1.
- `conception/validation.md` : scénarios T-B5 / T-B6 du domaine.
- Un domaine `decrit` (hors bêta) n'a **pas** de dossier ; le serveur refuse
  de le charger et le triage répond « hors des domaines couverts ». Depuis
  la bêta v2 il n'y en a plus dans le produit : le test de fumée fabrique
  un manifeste temporaire avec un domaine `exemple-decrit` pour garder
  cette branche testée. Ne pas retirer ce scénario.
- Un nouveau domaine chez un client déjà installé : `etat` montre le
  fichier « ABSENT », `init` (rejoindre) copie le gabarit sans toucher au
  reste. Jamais de migration.

### 4.3 Une demande (dans `demandes.md`)

- Une entrée `## Demande — <nom>` avec prérequis, à collecter (une question à
  la fois), vérifications contre le contexte, gabarit de plan d'action
  (impact, retour arrière, mise à jour de contexte en dernière étape).
- La clé `<nom>` dans `selon-cas` de l'en-tête, ses sections dans un
  gabarit, et dans les `tags` du domaine au manifeste.
- Rester sous 110 lignes ; sinon scinder en un fichier par demande.

### 4.4 Un appel MCP (ajout ou changement de signature)

- `serveur/src/index.ts` : `registerTool`, schéma zod, description en
  français qui dit **quand** l'appeler ; erreurs d'usage en `isError` texte,
  jamais d'exception.
- Le module concerné (`skills`, `contexte`, `tickets`, `kb`, `encours`) ;
  dépendances dans un seul sens (`architecture/D-serveur-mcp.md` §2).
- `test/smoke.ts` : la liste des outils (ordre alphabétique) et les cas
  nominaux + erreurs.
- Documents, dans cet ordre : `conception/contrat-mcp.md` (section de
  l'appel, invariants §6, §7), `plan.md` (0.3 flux, tableau des appels en D,
  décisions D), `architecture/D-serveur-mcp.md` (structure, formats, cas
  limites), `fin-de-projet.md` (§2 tableau des appels, §4 décision), le
  schéma SVG, et `grep -rn "huit appels\|huit outils"` pour le compte.
- Le texte livré qui doit appeler l'outil : `triage.md`, `cloture.md` ou
  `remplissage.md`. Ces fichiers ont une limite : `triage.md` ≤ 130 lignes
  (avertissement de `valider`).

### 4.5 Le triage, la clôture, le remplissage (`contenu/general/*.md`)

- Ce sont les seuls endroits où le modèle apprend le flux. Toute étape
  ajoutée doit être cohérente avec `plan.md` 0.3 et le schéma SVG.
- Une contrainte vaut mieux qu'une description ; une règle qui n'est tenue
  que par le prompt est à consigner comme telle (§3 ci-dessus).
- Les descriptions des champs d'un outil (`index.ts`) sont relues à chaque
  appel : c'est là que vont les règles de forme (ex. taxonomie du brouillon),
  pas dans `triage.md`.

### 4.6 Un format de fichier (ticket, brouillon, journal, contexte)

- `markdown.ts` lit tout (en-tête YAML, sections `## id — titre`,
  commentaires). Un nouveau fichier suit le même format.
- Schémas documentés dans `conception/base-connaissances.md` (§1 arbre, §2
  ticket, §2 bis brouillon, §3 journal : un fichier par ticket depuis le
  2026-09-11 ; les `<id>-qNN.md` antérieurs restent et doivent être lus par
  tout futur outil du référent). Le brouillon a l'en-tête pour source de vérité
  et un corps réduit ; le ticket final est écrit une fois.
- Jamais de renommage de section ni de champ sans traiter les fichiers
  existants chez le client : ils ne sont **jamais** migrés par script.

### 4.7 Les scripts d'installation

- `install.ps1` et `install.sh` : mêmes six étapes, mêmes messages. Tout le
  travail est dans `dist/cli.js` (`outillage.md`) : ajouter une commande au
  CLI, pas de logique dans les scripts.
- `install.ps1` en **UTF-8 avec BOM** (PowerShell 5.1) ; `install.sh` en
  **LF** sans CR et exécutable dans l'index Git ; les deux tenus par
  `.gitattributes` et vérifiés par `valider`. Les écrire avec un outil qui
  respecte l'encodage, jamais par un heredoc du shell.
- Tester avec `-SansClaude -SansBuild` sur un dossier temporaire, deux
  fois (initialiser, puis rejoindre), puis une mise à jour simulée
  (`installation/VERSION` plus ancien, un gabarit retiré) ; jamais
  d'écriture dans `installation/` existant hors `VERSION` et des gabarits
  manquants.
- L'étape 3 lance `tester` (le smoke) : si on ajoute un cas au smoke, il
  doit rester rapide et n'écrire que dans un dossier temporaire —
  il tourne à chaque installation.

## 5. Pièges déjà rencontrés — ne pas refaire

- Une section copiée du gabarit avec ses placeholders passait pour remplie :
  « vide » = identique au gabarit livré (`contexte.ts`).
- `srv-paris-01` en exemple dans un template : attrapé par `valider`. Aucun
  nom qui pourrait exister, même pour dire de ne pas le faire.
- `install.ps1` sans BOM cassait sur les guillemets français.
- Un rattachement de brouillon par référence en minuscules écrasait la casse
  de la référence d'origine.
- Le modèle écrit des récits si on ne le contraint pas : limites par entrée
  côté serveur, pas de consigne de style.
- Un heredoc bash avec des `\n` dans un script Node passé en ligne : les
  séquences sont interprétées. Écrire le script dans un fichier.
- Le proposer d'inscrire une VM de projet dans `systeme/serveurs` : c'est la
  plateforme qui manquait au contexte, pas la VM (`format-contexte.md` §4.1).
- Le test de fumée vérifiait « hors bêta » sur `materiel` : le jour où
  `materiel` est passé en bêta, l'assertion est devenue fausse. Un test qui
  dépend du statut d'un vrai domaine casse à chaque évolution du produit ;
  d'où le domaine synthétique.
- Un heredoc bash long avec du markdown français passé au shell : tronqué
  ou mal fermé. Écrire le script de patch dans un fichier, puis l'exécuter.

## 6. Conventions de rédaction

- Tout en français, y compris le code (noms, commentaires, messages).
- Une décision s'écrit avec sa raison, dans le tableau de décisions du
  périmètre concerné, avec une date absolue.
- Les documents de `conception/` sont l'atelier ; `architecture/` fige ; ni
  l'un ni l'autre n'est livré. Seul `produit/` part chez un client.
- Ce qui s'apprend d'un ticket réel va dans `conception/retours-beta.md`,
  puis, si ça change le produit, dans le document de conception concerné.
- Ne pas ouvrir de « plan d'architecture » pour un périmètre sans code : le
  document de conception tient lieu de référence (`plan.md` 2.1).

# État d'avancement — à lire avant de toucher au projet

> Écrit pour une IA (ou un humain) qui ouvre ce dépôt à froid. Il dit où on
> en est, ce qui ne se casse pas, et ce qu'il faut mettre à jour quand on
> modifie telle ou telle partie. Il complète `plan.md` (l'étude, le
> pourquoi) et `fin-de-projet.md` (ce qui a été livré et décidé, le quoi).
> Dernière mise à jour : 2026-09-18. Vérifier `git log` : ce fichier décrit
> l'arbre de travail, pas forcément le dernier commit.

---

## 1. Où on en est

**Bêta 0.1.0 livrée le 2026-09-09**, deux domaines ; **bêta v2
(`0.2.0-beta`) le 2026-09-11**, six domaines, dont quatre jamais joués sur
un ticket réel. Trois tickets réels et une relecture du code ont produit
`retours-beta.md` : le modèle avait encore la main sur la mécanique
(tags libres, référence inventée, symptôme paraphrasé, signaux rédigés,
ordre du flux tenu par le prompt seul, outils de l'hôte non bornés).

**Lot déterminisme (`0.3.0-beta`), implémenté le 2026-09-18** depuis
`plan-after-beta.md` — dix décisions prises une à une, puis la section 2
(le plan, un chantier par décision) et la section 3 (le plan de test).
Tout a été implémenté en une passe, sur la branche `v0.3.0-beta`, un
commit par chantier :

| Chantier | Ce qui a changé | Décision |
| --- | --- | --- |
| 2.1 corrections sans contrat | UTC ; dédoublonnage normalisé ; zombies ; domaines contrôlés ; rattachement par symptôme ; référence stable et jamais inventée ; le brouillon est la source (symptôme, domaines proposés, plan, questions) ; `resolu_par` null, durée calculée ; `publish_kb` refuse un non-résolu ; seuil en caractères ; « vide » indépendant du gabarit ; liste des brouillons plafonnée | 6 (lot a) |
| 2.2 une question, une commande | Deux règles mot pour mot dans les douze skills, contrôlées par `valider` ; plan en séquence numérotée ; T-B8 | 10 |
| 2.3 l'hôte | `.claude/settings.json` déposé par `install` (`hote`) : `Bash`, `PowerShell`, écriture dans `installation/`, lecture de `kb/` et `en-cours/` refusés au modèle | 5 |
| 2.4 état de session | `session.ts` : brouillon courant, skills chargés, sections servies, cas lus ; refus hors séquence ; étape et escalades dérivées ; reconstruction à la reprise | 3 |
| 2.5 `read_kb` et D2 | Neuvième appel ; score par rareté, rendu compact, plafond fixe | 4 |
| 2.6 signaux | `{ id, libelle }` au manifeste, enum au démarrage, `{ id, preuve }` cochés, classement des domaines par le serveur | 2 |
| 2.7 tags | Bibliothèque produit ∪ client (`tags.yaml`), enum ≤ 5, filtrée par domaines validés, servie par `cloture` | 1 |
| 2.8 validité du contexte | Péremption 90 j annotée, confirmation à l'identique (re-date), `contradictions`, file des candidats | 9 |
| 2.9 audit | `audit.ts` : rapport tickets + contexte, écrit dans `audits/`, commande CLI et skill `audit` | 8 |

**Ce qui est amendé par rapport aux décisions écrites**, et pourquoi :
la décision 6 (ordre des lots) est remplacée par « tout en une passe, puis
dix tickets » (section 2.0 du plan) ; le manifeste a 20 signaux, pas 24 ;
les règles « à confirmer » et « contradiction » ne sont pas répétées dans
chaque skill (budget de lignes — elles voyagent avec la donnée,
`format-skill.md` §6) ; le refus « domaine proposé sans signal coché » ne
s'applique qu'aux incidents et dès qu'un signal est coché ; T-H4 existait
déjà, le test manuel de l'hôte est T-H5 ; `PowerShell` est interdit avec
`Bash` (l'outil shell de Claude Code sous Windows).

État des contrôles : `npm run build` propre, `node dist/cli.js valider`
zéro erreur (six avertissements de longueur acceptés, tous ≤ 110 lignes),
`npm test` vert sur les neuf appels, les six domaines et quatre sessions
serveur (catalogue, séquence complète avec les refus, reprise après
redémarrage, tickets du jeu de test du triage — la quatrième depuis OA6, le
2026-09-21).

**Campagne de test 0.3.0-beta jouée les 2026-09-19/20** (journal :
`campagne-test-0.3.0-beta.md` ; report dans `validation.md` §7 et
`retours-beta.md`) : onze tickets, vingt refus, C1–C11, D. Critère de
sortie atteint ; dix-huit écarts et onze observations. **Corrections faites
le 2026-09-20** (`fin-de-projet.md` §11, décisions 42–44) : union des
domaines validés (E5), signal requis pour toute nature + domaine
`hors-perimetre` décrit + signaux de demande `objet-…` (E10), enregistrement
MCP en portée projet `.mcp.json` (E18), résolu refusé sans skill de domaine
(E15), règle « une commande » réécrite (E3/E4), référence retirée du symptôme
(E11), annotation de péremption en tête (E13), tags structurels connus et
dédoublonnage en base (E2/E7), audit enrichi (O10/O11), générateur corrigé
(E6/E17). Restent à trancher : O1, O2, O3, O7, O8 (voir le journal §1).

**Campagne sans jeu de données jouée le 2026-09-21** (journal :
`campagne-test-0.3.0-beta-sans-jeu-de-donnees.md`, sur `859ffec`) : le
parcours d'un client — `install.ps1` sans option, mode INITIALISER, 45
sections vides, base à 0 cas, puis remplissage depuis rien, trois tickets
sur contexte vide, remplissage avec candidats, audit, refus. Verdict : la
première installation fonctionne de bout en bout ; sur un contexte vide le
modèle demande, il n'invente pas. **Corrections faites le 2026-09-21**
(`fin-de-projet.md` §12, décisions 45–46) : structurels de `search_kb`
depuis le manifeste (EA1), en-tête de tableau contrôlé par `update_context`
(EA2), candidat comparé en entier (EA3) — **rejouées le même jour** sur un
vrai clone (`C:\Projet-IT\it-support-test\support-it`, `cf7f708`), vertes.
**Second lot le 2026-09-21** (`fin-de-projet.md` §12, décisions 47–48) :
OA1 (audit : sections vides en information), OA2 (section vide « remplie »,
sans copie), OA3/OA5 (réponses = les mots du technicien, `section`
seulement pour une donnée réutilisable — descriptions des champs, clôture,
triage), OA4 (exécution reportée = pause), O6 (rappel `/support` au lieu de
`/mcp`), O8 (durée active, `points_etape`, calendaire à côté). Laissés
pour 0.3.0 : O1, O2, O3, O7.

**Passe sur le manifeste faite le 2026-09-21** (décision 49) : aucun
signal fautif dans les deux jeux de test du triage ; définition de l'écart
corrigée (OA6) ; `un-service-touche` et `un-seul-poste` resserrés,
identifiants inchangés.

**Rejeux du 2026-09-21 après-midi** (journal §5) : durée active
plafonnée en vrai (EX-3104 : 32 min actives pour 40 calendaires), section
vide « remplie » sans copie, audit « 0 écart » et ligne d'information,
triages nets système et poste de travail sur les libellés resserrés.

**`0.3.0` sortie le 2026-09-21** (`fin-de-projet.md` §13) :
`produit/VERSION`, `package.json`, `package-lock.json`, `README.md`.

**Ce qui reste à faire**, dans l'ordre :

1. ~~Tag git `v0.3.0`~~ fait (branche `release`, tag `v0.3.0`, mise à
   jour `0.3.0-beta → 0.3.0` vue sur l'env de test). Reste l'archive zip de
   `produit/` pour un client sans Git (H5), et la branche par défaut du
   dépôt à passer sur `release`.
4. Pendant les tests, observer le cycle de vie du processus serveur dans
   Claude Code (`/clear`, `--resume`, reconnexion) : si l'état de session
   est perdu plus souvent que « une session = un ticket », la
   reconstruction par `resume_ticket` devient la voie principale
   (`D-serveur-mcp.md` §5).
5. ~~Le schéma v4~~ fait le 2026-09-21 :
   `architecture/schema/routage_support_v4.svg` (neuf appels, `read_kb`,
   étape et escalades dérivées, refus hors séquence, audit et file des
   candidats, hôte, durée active). La v3 est gardée pour l'historique.
6. Porte 2 (collègues, partage réseau) : l'empreinte optimiste sur le
   contexte et les brouillons (`D-serveur-mcp.md` §8), et ce que la
   décision 7 a explicitement remis à plus tard.

## 2. Carte du dépôt — quoi lire pour quoi

| Besoin | Fichier |
| --- | --- |
| Comprendre le produit, le vocabulaire, les décisions de fond | `plan.md` section 0 (à lire en entier avant tout) |
| Ce qui a été livré, les décisions prises (1 à 39), les limites | `fin-de-projet.md` |
| Les dix décisions du lot déterminisme, le plan d'implémentation, le plan de test | `conception/plan-after-beta.md` |
| Le contrat des neuf appels MCP, dans le détail | `conception/contrat-mcp.md` |
| Comment le serveur est construit, ses cas limites | `architecture/D-serveur-mcp.md` |
| Le flux en image | `architecture/schema/routage_support_v4.svg` (0.3.0, 2026-09-21 ; v3 et v2 gardées pour l'historique) |
| Ce qu'un skill contient et ne contient pas | `conception/format-skill.md` |
| Ce qu'un contexte contient, et surtout ce qu'il ne contient pas | `conception/format-contexte.md` (§4.1 : la taxonomie) |
| Comment le triage décide, l'escalade, la reprise | `conception/triage.md` et le texte livré `produit/contenu/general/triage.md` |
| Les tests et le journal de ce qui a été joué | `conception/validation.md` |
| Les observations de la bêta | `conception/retours-beta.md` |
| Installer, mettre à jour, distribuer | `conception/deploiement.md`, `produit/install.ps1`, `produit/install.sh` |

Le contenu que le modèle lit à l'usage est **entièrement** dans
`produit/contenu/` : `manifeste.yaml`, `general/{triage,cloture,remplissage,audit,contexte.exemple}.md`,
`domaines/<id>/{skill,demandes,contexte.exemple}.md`. Rien d'autre n'arrive
jamais en contexte du modèle.

## 3. Les invariants — ce qui ne se casse pas

Chaque invariant dit **où il est tenu**. S'il n'est tenu que par le prompt,
il est fragile et il faut le savoir.

| Invariant | Tenu par |
| --- | --- |
| Le serveur ne raisonne jamais ; l'intelligence est dans `contenu/`, le déterminisme dans `serveur/`. | Architecture : aucun appel ne prend une décision qu'un skill pourrait prendre. |
| Le modèle ne fabrique jamais un chemin, un identifiant, une date. | Contrat : aucun appel n'a de paramètre de chemin ; le serveur fabrique tout (`ids.ts`). Une référence fabriquée est refusée (A6). |
| **Le modèle n'a pas de choix sur la mécanique** (principe du 2026-09-14) : domaines, signaux, tags, sections sont des enums ; le symptôme, les domaines proposés, le plan, les questions viennent du brouillon ; l'étape, les escalades, les cas lus, la durée sont dérivés ; l'ordre du flux est tenu par l'état de session ; **les colonnes d'un tableau de contexte** sont celles du gabarit ou celles en place (décision 45, 2026-09-21). | **Code** : schémas construits au démarrage (`index.ts`), `session.ts`, `encours.ts`, `tickets.ts`, `contexte.ts` (`enTeteTableau`). Il reste au modèle : net ou ambigu, la question, la conclusion, le plan, les preuves des signaux, le constat d'une contradiction. |
| Rien n'est écrit hors de `installation/` ; `produit/` se remplace en bloc. Et rien n'est écrit dans `installation/` hors des appels. | Code (`config.ts`), scripts d'installation, test de fumée (liste des dossiers créés) ; **l'hôte** : `.claude/settings.json` refuse `Edit`/`Write` sur `installation/**` au modèle (décision 5) ; prompt : règle explicite dans triage et clôture depuis E14. Exception assumée : `install` écrit `.mcp.json` et `.claude/settings.json` dans le dossier de lancement (décision 44). |
| Aucune donnée d'entreprise dans `produit/contenu/`, même en exemple. | `valider` (regex IP, UNC, mail, domaine interne, nom d'hôte plausible). Placeholders `<...>` uniquement. |
| Un ticket clôturé, un journal, une entrée de base : écrits une fois, jamais modifiés. | Code (`flag: "wx"`). |
| Seules deux matières sont mutables : le contexte (`update_context`, avec copie dans `contexte/historique/`) et les brouillons (`save_progress`, fusion). La seule suppression est le brouillon à la clôture. | Code. Concurrence non protégée en mono-poste ; empreinte prévue à la porte 2. |
| Le contexte n'est jamais écrit sans un oui explicite du technicien. | **Prompt seulement** (`remplissage.md`, `cloture.md`, `audit.md`, description de l'outil). Irréductible : il faut un humain. |
| Une réponse tracée est **ce que le technicien a dit**, jamais une déduction du modèle ; `section` n'est posé que sur une donnée d'entreprise réutilisable. | **Prompt seulement** (descriptions des champs `questions` de `save_progress`/`save_ticket`, `cloture.md`, `triage.md` point 2 — OA3/OA5 du 2026-09-21). Irréductible : le serveur ne sait pas qui a dit quoi. La file des candidats hérite de ce qui est tracé. |
| Trois points de validation humaine : triage ambigu, plan d'action, publication. Pas de quatrième. | Prompt (`triage.md`, `cloture.md`) + contrat (`publish_kb` distinct de `save_ticket`). `resolu_par` est une **question** à la clôture, pas un quatrième point (E8, prompt seul). |
| L'IA n'exécute rien : le technicien exécute et rapporte. | Prompt + **l'hôte** : `Bash` et `PowerShell` retirés du contexte du modèle par `.claude/settings.json` (décision 5). Aucun appel MCP n'exécute quoi que ce soit. |
| Une question, puis j'attends la réponse. | Prompt seulement (`format-skill.md` §6, mot pour mot dans chaque skill ; `valider` contrôle la présence, pas le respect). |
| Une commande, puis j'attends la sortie — le plan s'applique une étape à la fois, un résultat inattendu l'arrête. | **Prompt seulement** (décision 10 du 2026-09-18 ; règle réécrite le 2026-09-20 après E3 : « une étape du plan par tour, commande, manipulation ou question », le pipe `\|` est une invocation). Les actions se passent hors de tout appel : aucun garde-fou serveur possible. L'audit signale un `save_progress` à plusieurs `actions` (indice). Test de référence : T-B8 ; la campagne a compté 7 écarts sur 11 tickets avant la réécriture. |
| Un skill fait ~100 lignes (110 max), pas de persona au-delà d'une ligne, chaque ligne passe le test de valeur. | `valider` (longueur) + relecture (T-B1). |
| Les identifiants de sections (`domaine/section`) sont le contrat entre skills, gabarits et serveur ; renommer un `id` est interdit sans note de version. | `valider` (contrat B/C dans les deux sens). |
| Le symptôme initial est conservé tel qu'exprimé. | Code : le brouillon est la source, la clôture ne le remplace pas (A1) ; le préfixe « référence : » est retiré par le serveur (E11). Irréductible : la première copie, au premier `save_progress`, est celle du modèle — T10 l'a enrichie des réponses suivantes (E16), tenu par le prompt seul. |
| Un ticket clôturé, un journal, une entrée de base ne sont jamais corrigés par l'outil, même à l'audit. | Prompt (`audit.md`) + code (l'audit n'a aucune écriture hors `audits/`). |
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
- Le module concerné (`skills`, `contexte`, `tickets`, `kb`, `encours`,
  `audit`) ; dépendances dans un seul sens (`architecture/D-serveur-mcp.md`
  §2). Un enum (domaine, signal, tag, section) se construit au démarrage
  dans `index.ts` depuis le manifeste, la bibliothèque ou les gabarits.
- `session.ts` si l'appel doit noter ou refuser quelque chose : ce qu'il
  note, ce que `save_progress` recopie dans le brouillon, ce que
  `resume_ticket` reconstruit.
- `test/smoke.ts` : la liste des outils (ordre alphabétique) et les cas
  nominaux + erreurs.
- Documents, dans cet ordre : `conception/contrat-mcp.md` (section de
  l'appel, invariants §6, §7), `plan.md` (0.3 flux, tableau des appels en D,
  décisions D), `architecture/D-serveur-mcp.md` (structure, formats, cas
  limites), `fin-de-projet.md` (§2 tableau des appels, §4 décision), le
  schéma SVG, et `grep -rn "neuf appels\|neuf outils"` pour le compte.
- Le texte livré qui doit appeler l'outil : `triage.md`, `cloture.md`,
  `remplissage.md` ou `audit.md`. Ces fichiers ont une limite : ≤ 130 lignes
  (avertissement de `valider`) ; `triage.md` y est, chaque ligne ajoutée
  en coûte une ailleurs.

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

- `install.ps1` et `install.sh` : mêmes six étapes, mêmes messages. Depuis
  le 2026-09-20, `enregistrer` écrit `.mcp.json` dans le dossier de
  lancement (portée projet, décision 44) et retire une entrée utilisateur
  qui pointait sur ce produit ; un test sur un dossier temporaire ne touche
  donc plus la machine. Ne jamais revenir à `~/.claude.json`. Tout le
  travail est dans `dist/cli.js` (`outillage.md`) : ajouter une commande au
  CLI, pas de logique dans les scripts. **Une seule exception, l'étape 1**
  (prérequis) : tant que Node.js n'est pas là, aucun CLI ne peut tourner,
  donc la détection de node/npm, la proposition d'installation par le
  gestionnaire du poste (oui explicite, jamais silencieux) et le
  rechargement du PATH vivent dans les deux scripts, en double. Ne pas la
  « nettoyer » vers le CLI ; garder les deux versions alignées message pour
  message.
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
- Une correction vérifiée seulement sur une base pleine (E2 : structurels
  déduits des cas publiés) revenait telle quelle sur une base vide (EA1).
  Ce qui vient du manifeste se lit dans le manifeste, pas dans les données.
- Comparer un contenu par son **préfixe** (60 caractères, file des
  candidats) perd tout ce qui l'étend : une section reprise et complétée
  commence comme l'original (EA3). Comparer en entier.
- Le smoke écrivait des tableaux de contexte avec des colonnes qui ne sont
  pas celles des gabarits — ça passait parce que rien ne les contrôlait.
  Depuis la décision 45, un tableau se teste avec les colonnes du gabarit ;
  un squelette « d'un gabarit plus ancien » (C2) s'écrit à la main dans le
  fichier, pas par `update_context`.

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

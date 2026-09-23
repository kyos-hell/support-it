# Plan 0.4.0 — plusieurs entreprises dans une installation (porte 2)

> Rédigé le 2026-09-21, le jour de la sortie de `0.3.0`. Rien n'est codé.
> Ce document remplace l'ancienne « porte 2 » (collègues, partage réseau),
> qui devient la **porte 3** : le multi-entreprise fixe la frontière des
> données, le partage la distribue — dans cet ordre.

## 0. Le problème, et le cadre

Aujourd'hui `installation/` est **une** entreprise : un contexte, une base,
des tickets, un `tags.yaml`. Un technicien de prestataire qui suit dix
entreprises n'a pas de place pour la deuxième. Ce qu'on veut : le
technicien reste dans **un seul dossier `support-it`**, n'agit que par le
prompt, et chaque entreprise a ses données à part, sans qu'aucune ne
puisse fuir dans une autre.

Vocabulaire :

- **Entreprise** : un client du support, identifié par un `id` kebab-case
  (`troispoint-plus`) et un libellé (« troispoint&plus »). C'est un
  **enum** construit au démarrage du serveur, comme les domaines et les
  tags : le modèle en coche un, il n'en écrit jamais.
- **Installation** : toujours un seul dossier, `installation/`, qui contient
  maintenant un dossier par entreprise. Le produit (`produit/`) reste
  unique et partagé ; le serveur MCP aussi.
- **Mono-entreprise** : une installation qui n'a qu'une entreprise. Elle
  se comporte comme `0.3.0` du point de vue du technicien : aucune question
  d'entreprise, jamais.

Ce que ça ne change pas : les neuf appels restent neuf ; le modèle n'a
toujours pas de choix sur la mécanique ; rien n'est écrit hors de
`installation/` ; une réponse tracée = les mots du technicien.

## 1. Décisions

| # | Décision | Raison | État |
| --- | --- | --- | --- |
| M1 | **Une entreprise est créée par le référent, jamais par le modèle ni par un texte libre du technicien.** Deux voies : `install.*` demande la première entreprise ; `node dist/cli.js entreprise ajouter "Durand SA"` en ajoute une. Le serveur lit `installation/entreprises.yaml` (`id`, `libelle`, `cree`) et refuse tout `id` absent — **une seule forme, l'id, pas de rapprochement** : une faute d'orthographe est refusée avec la liste `id (libellé)`, et le modèle pose une question. | Le risque nommé le 2026-09-21 : « il suffit que le technicien écrive n'importe quoi et ça crée une entreprise ». Un enum, un refus lisible, et aucune correction automatique le suppriment. | décidé |
| M2 | **Pas de dixième skill ni de dixième appel.** Un paramètre `entreprise` (enum) sur les appels qui **ouvrent** une session : `save_progress` à la création du brouillon, `load_skill(["remplissage"])`, `load_skill(["audit"])`. Tout le reste de la session s'enracine dans l'entreprise courante sans la redire. `resume_ticket(réf)` cherche dans toutes les entreprises et reconstruit l'entreprise courante depuis le brouillon. | Le flux reste le même ; l'entreprise est un fait de session, comme le brouillon courant (décision 3 du lot déterminisme). | proposé |
| M3 | **Le serveur refuse hors séquence** : `load_skill(domaine)`, `get_context`, `search_kb`, `read_kb`, `update_context`, `save_ticket`, `publish_kb` sans entreprise en session → « choisir l'entreprise d'abord : save_progress(entreprise) ou resume_ticket ». En mono-entreprise, l'entreprise unique est prise d'office : aucun refus, aucun paramètre exigé. | Même mécanique que « le cas n'est pas instruit ». Le mono-entreprise ne doit rien voir changer. | proposé |
| M4 | **Ce qui est par entreprise** : `contexte/` (+ `historique/`), `en-cours/`, `tickets/`, `journal/`, `kb/`, `tags.yaml`, `audits/`. **Partagé** : `produit/`, le serveur, `entreprises.yaml`, `VERSION`. La base de connaissances est **strictement** par entreprise : `search_kb` et `read_kb` ne voient que `installation/<entreprise courante>/kb/`. | Décidé avec toi le 2026-09-21. Un cas publié contient des noms de serveurs et des adresses. Un étage « générique » partagé est hors de cette release (§5). | décidé |
| M5 | **Le triage reçoit la liste des entreprises** (id, libellé, tickets en cours par entreprise) avec la liste des tickets. Règle : « `/support <id-entreprise> <réf> …` ; entreprise absente de l'argument et installation multi → **une question**, avant la référence ; jamais l'entreprise du ticket précédent par défaut ». | La première question d'un ticket chez un prestataire, c'est « pour qui ? ». Un défaut est une supposition. | décidé |
| M6 | **Migration d'une installation `0.3.0`** (une entreprise à la racine) : faite par `install.*`, **après** que les tests de la release sont passés — demande le nom de l'entreprise, déplace le contenu dans `installation/<id>/`, écrit `entreprises.yaml`, et garde une **sauvegarde** `installation.avant-0.4.0/` ; `node dist/cli.js migration annuler` remet l'état d'avant. Tant que la sauvegarde existe, `etat` la signale. | Décidé avec toi le 2026-09-21 : sauvegarde et retour arrière obligatoires ; l'ordre du patch (migrer d'abord ou après) se décide après les jeux de test. C'est la première exception assumée à « jamais de migration par script » (H4) : elle est explicite, réversible, et demandée. | décidé (le principe) |
| M7 | **Option mono-entreprise** : `install.* -MonoEntreprise` / `--mono-entreprise` crée `installation/<id>/` avec une seule entrée et note `mono: true` dans `entreprises.yaml`. Le serveur ne pose alors jamais la question et n'exige jamais le paramètre. `entreprise ajouter` refuse tant que `mono: true` (le référent le retire à la main pour passer en multi). | Décidé avec toi le 2026-09-21 : « pour ceux qui le souhaitent ». Une structure unique (toujours un dossier par entreprise), deux comportements. | décidé |
| M8 | **L'audit est par entreprise, pas d'audit global** (pour l'instant). Même mécanique que `/support` : `load_skill(["audit"], entreprise)` ; sans entreprise en multi, le serveur répond « choisir l'entreprise : troispoint-plus, durand-sa » et le modèle pose **une** question — `/support audit troispoint-plus` ou `/support audit` puis la question. CLI : `node dist/cli.js audit <entreprise>`, obligatoire en multi, refus avec la liste sinon ; en mono, l'entreprise unique est prise d'office. `etat` reste global (une page, toutes les entreprises : c'est de l'état, pas un audit). | Décidé avec toi le 2026-09-21. Un rapport global mélangerait deux référents ; et l'audit propose des écritures (`update_context`, `publish_kb`) qui ne peuvent viser qu'une entreprise à la fois. | décidé |
| M10 | **Une session = une entreprise, et elle ne se change pas en cours de route.** L'entreprise est posée en session par le premier appel qui la nomme (`save_progress` de création, `resume_ticket`, `load_skill` remplissage/audit). Ensuite : tout appel qui nomme une **autre** entreprise est refusé (« la session est sur troispoint-plus ; pour durand-sa : clôturer ou mettre en pause, puis nouveau ticket ») ; tout appel qui n'en nomme pas travaille dans celle de la session ; **aucun appel ne prend de chemin**, le serveur résout `installation/<entreprise>/…` lui-même. L'entreprise se vide avec le brouillon courant (clôture) ; après une `pause: true`, une nouvelle création ou reprise peut en poser une autre — et remet à zéro skills, sections servies, cas lus. `resume_ticket(réf)` d'un ticket d'une autre entreprise pendant une session active est refusé de la même façon. | Décidé avec toi le 2026-09-21 : « une fois l'entreprise choisie, zéro chance de se déplacer dans une autre ». Le modèle n'a aucun appel qui lise B pendant qu'il est sur A ; c'est le serveur qui tient la frontière, pas le prompt. | décidé |
| M11 | **L'hôte interdit `Read(/installation/**)` en entier** (aujourd'hui : `kb/` et `en-cours/` seulement ; `contexte/` et `tickets/` restaient lisibles). `Edit(/installation/**)`, `Bash`, `PowerShell` inchangés. | Le second chemin vers un fichier, c'est l'outil `Read` de Claude Code : en multi, il permettrait de lire le contexte de B pendant un ticket de A. Tout ce que le modèle doit lire passe déjà par `get_context`, `search_kb`, `read_kb`, `resume_ticket`. `hote` fusionne : une installation `0.3.0` reçoit la nouvelle règle à la mise à jour. | décidé (découle de M10) |
| M12 | **Rien de support-it n'existe hors du dossier `support-it`, ni en dessous sans les permissions** : point d'entrée, `.mcp.json` et `.claude/settings.json` ont la même portée, le projet (décision 50, `0.3.1`). La migration vers `0.4.0` **s'arrête** s'il reste un skill `support` ou une entrée MCP `support-it` en portée utilisateur ; la garde « session ouverte dans un sous-dossier » (prévue `0.3.2`) est reprise ici. | Constaté le 2026-09-23 : `/support` global chargé hors du dossier, sans les permissions ; et depuis un sous-dossier d'un clone, skill et serveur trouvés mais `settings.json` non appliqué (T-H6). Or M10 et M11 ne tiennent que dans le dossier : `Read(/installation/**)` n'existe pas dans une session ouverte ailleurs, qui lirait le contexte d'une autre entreprise par un chemin absolu. Un skill personnel passe avant celui du projet : un ancien point d'entrée `0.3.x` masquerait la syntaxe `<entreprise> <réf>` de a9. | décidé (découle de la décision 50) |
| M9 | **Le jeu de test du triage et les mesures T-P7** restent dans l'audit de chaque entreprise ; pas de vue consolidée dans cette release (M8 : pas de global). Le référent produit lit les rapports un par un. | Ce sont des mesures du produit, mais un consolidé est un audit global déguisé. À rouvrir si le nombre d'entreprises le justifie. | décidé (par M8) |

## 2. Le plan — un chantier par bloc

| # | Bloc | Fichiers | Ce qui change |
| --- | --- | --- | --- |
| a1 | Racines par entreprise | `config.ts` | `chemins(r, entreprise)` : tous les chemins de données prennent l'entreprise ; `entreprises.yaml` lu au démarrage (`lireEntreprises`) ; mono détecté (`mono: true` ou une seule entrée) |
| a2 | L'enum | `index.ts` | `ENTREPRISE = z.enum(ids)` ; paramètre sur `save_progress` (création), `load_skill` (remplissage, audit) ; description : « une entreprise se coche, ne s'écrit pas ; liste : … » ; en mono, `.optional()` et valeur d'office |
| a3 | État de session | `session.ts` | `entrepriseCourante: string \| null` ; posée par `save_progress` (création), `resume_ticket`, `load_skill(remplissage/audit)` ; refus hors séquence (M3) ; **refus de toute autre entreprise tant qu'elle est posée** (M10) ; vidée à la clôture avec le brouillon ; changement après pause = remise à zéro de l'état |
| a4 | Brouillons et tickets | `encours.ts`, `tickets.ts` | en-tête `entreprise:` sur le brouillon et le ticket ; `resume_ticket` parcourt `installation/*/en-cours/` ; la liste des en-cours du triage groupe par entreprise ; `save_ticket` écrit sous l'entreprise du brouillon |
| a5 | Contexte, base, tags | `contexte.ts`, `kb.ts`, `manifeste.ts` | racines par entreprise ; la bibliothèque de tags = produit ∪ `tags.yaml` **de l'entreprise courante** (l'enum des tags devient dépendant de la session : à construire à la demande, pas au démarrage — ou construire l'union et vérifier à l'appel) |
| a6 | Audit | `audit.ts` | `calculerAudit(r, entreprise)` ; rapport dans `installation/<id>/audits/` ; pas de global (M8) |
| a7 | CLI | `cli.ts` | `entreprise lister`, `entreprise ajouter "<libellé>"` (id dérivé, refus de doublon, refus en mono), `audit <entreprise>` (obligatoire en multi, refus avec la liste), `migration annuler` ; `etat` multi ; `init` crée `entreprises.yaml` et le dossier de la première entreprise |
| a8 | Installateur et hôte | `install.ps1`, `install.sh`, `entrees/claude-code/settings.json`, `cli.ts` (`hote`) | question « première entreprise ? » (o explicite, jamais silencieux) ; `-MonoEntreprise` ; migration `0.3.0 → 0.4.0` avec sauvegarde et message de retour arrière ; messages alignés dans les deux scripts ; `deny` : `Read(/installation/**)` remplace les deux motifs `kb/` et `en-cours/` (M11), fusionné par `hote` sur une installation existante ; **M12** : avant la migration, refus s'il reste `~/.claude/skills/support/` ou `mcpServers.support-it` dans `~/.claude.json` (message : relancer `entree` / `enregistrer`, ou retirer à la main), et la garde « sous-dossier » si `0.3.2` ne l'a pas livrée |
| a9 | Contenu | `triage.md`, `remplissage.md`, `audit.md`, `cloture.md`, `SKILL.md` | triage : la liste des entreprises, la règle « pour qui ? » (une ligne, budget 130 lignes : une autre ligne saute) ; remplissage et audit : « pour quelle entreprise ? » si multi ; `/support` : syntaxe `<entreprise> <réf> …` |
| a10 | Smoke | `test/smoke.ts` | une installation à deux entreprises : refus d'un id inconnu, isolement (le contexte d'A n'est pas servi dans B, `search_kb` en B ne voit pas la base d'A), `resume_ticket` qui retrouve l'entreprise, mono sans paramètre ; migration sur une copie temporaire d'une installation `0.3.0` puis `migration annuler` |
| a11 | Documents | `contrat-mcp.md`, `base-connaissances.md` §1, `deploiement.md`, `etat-d-avancement.md`, `fin-de-projet.md`, `README.md`, schéma v5 | l'arbre, le paramètre, la migration, les invariants |

Ordre proposé : a1 → a3 → a2 → a4 → a5 → a6 → a7 → a10 (vert) → a9 → a8 → a11. La migration (a8) en dernier, comme convenu.

## 3. Plan de test

Sur des installations neuves, avant tout ticket réel :

| # | Scénario | Attendu |
| --- | --- | --- |
| P1 | `install.ps1` vierge, première entreprise « troispoint&plus » | `installation/troispoint-plus/` avec les sept gabarits, `entreprises.yaml`, `etat` par entreprise |
| P2 | `entreprise ajouter "Durand SA"` puis redémarrage de Claude Code | triage : deux entreprises listées ; `/support EX-1 : …` sans entreprise → une question ; `/support durand-sa EX-1 : …` → brouillon dans `durand-sa/en-cours/` |
| P3 | Isolement | contexte rempli chez A, ticket chez B : sections servies vides chez B ; cas publié chez A : `search_kb` chez B renvoie « base vide » |
| P4 | Refus | `save_progress(entreprise: "tripoint")` → « entreprise inconnue : troispoint-plus, durand-sa » ; `load_skill(reseau)` sans entreprise → « choisir l'entreprise d'abord » ; session sur A, `save_progress(entreprise: B)` ou `resume_ticket` d'un ticket de B → « la session est sur A : clôturer ou mettre en pause » (M10) ; après `pause: true`, la création chez B passe et l'état est remis à zéro |
| P4 bis | Hôte (T-H5 étendu) | pendant un ticket chez A, « lis `installation/durand-sa/contexte/reseau.md` » → refusé par l'hôte (`Read(/installation/**)`), le modèle ne contourne pas et renvoie à `get_context` (qui ne sert que A) |
| P4 ter | Hors du dossier (M12, T-H6 étendu) | session ouverte hors de `support-it` : `/support` inconnu, aucun outil `support-it` ; session ouverte dans `support-it/produit/` : refus (garde sous-dossier) ou, à défaut, Bash/PowerShell absents ; poste avec un ancien `~/.claude/skills/support/` : la migration s'arrête et le dit |
| P5 | Reprise | `/support EX-1` (sans entreprise) sur un brouillon de B → `resume_ticket` retrouve B, l'état est reconstruit avec l'entreprise |
| P6 | Mono | `install.ps1 -MonoEntreprise` : aucune question d'entreprise au triage, aucun paramètre exigé, `entreprise ajouter` refusé |
| P7 | Migration | copie d'une installation `0.3.0` (celle d'`it-support-test`) → `install.ps1` : question du nom, déplacement, `installation.avant-0.4.0/` ; tickets, base, contexte, tags relus à l'identique ; `migration annuler` → état `0.3.0` exact |
| P8 | Audit | `/support audit` sans entreprise → liste servie, une question ; `/support audit troispoint-plus` ne voit rien de B ; CLI `audit` sans argument en multi → refus avec la liste ; en mono → l'entreprise unique |

Puis une campagne courte façon `campagne-test-0.3.0-beta-sans-jeu-de-donnees.md` : deux entreprises, deux tickets chacune, un remplissage, un audit — testeur sans aide, journal QA.

## 4. Questions à trancher avec toi

1. ~~La base de connaissances strictement par entreprise (M4) — ou un étage
   « générique » dès cette release ?~~ Tranché le 2026-09-21 : strictement
   par entreprise ; et une session = une entreprise, tenue par le serveur
   (M10) et par l'hôte (M11).
2. ~~L'audit par entreprise (M8), et un rapport consolidé pour le CLI ?~~
   Tranché le 2026-09-21 : par entreprise, pas de global, même mécanique
   que `/support` (argument, sinon la liste et une question).
3. ~~La syntaxe côté technicien~~ Tranché le 2026-09-21 : **une seule
   forme, l'id** (`/support troispoint-plus EX-1234 : …`). Une faute
   d'orthographe est **refusée** par le serveur, qui renvoie la liste des
   entreprises avec leur id et leur libellé (« entreprise inconnue
   « tripoint » — disponibles : troispoint-plus (troispoint&plus),
   durand-sa (Durand SA) ») ; le modèle pose une question, jamais de
   correction automatique ni de rapprochement.
4. ~~Faut-il mémoriser « la dernière entreprise »~~ Tranché le 2026-09-21 :
   **non, jamais de supposition** — en multi, sans entreprise dans
   l'argument, une question, toujours.

Toutes les questions du §4 sont tranchées : le plan est prêt à coder.

## 5. Hors de cette release

- Porte 3 : partage réseau entre collègues, empreinte optimiste sur le
  contexte et les brouillons, compatibilité produit / installation.
- Un étage de base de connaissances partagé entre entreprises (« cas
  génériques »), alimenté à la main par le référent.
- Un technicien qui travaille sur deux entreprises **dans la même
  session** : non — une session, un brouillon, une entreprise.

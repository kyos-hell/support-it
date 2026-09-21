# Fin de projet — bêta 0.1.0

> Compte rendu de la livraison du 2026-09-09 : ce qui est livré, comment ça
> s'assemble, ce qui a été décidé sans discussion, ce qui n'est pas fait, et
> comment tester. Rédigé par l'IA pour l'auteur du projet.

---

## 1. Ce qui est livré

| Où | Quoi | État |
| --- | --- | --- |
| `plan.md` | L'étude, mise à jour : statut, décisions D à H, notes 0.3 / 0.4 / 2.1 | À jour |
| `conception/` | Un document par périmètre, A à H, plus `validation.md` et `retours-beta.md` | Complet |
| `architecture/D-serveur-mcp.md` | Le seul plan d'architecture : le seul composant qui a du code | Écrit |
| `produit/` | Tout ce qui s'installe : manifeste, triage, clôture, deux domaines (six depuis la bêta v2, §9), gabarits, point d'entrée, serveur, scripts | Construit, validé, testé |
| `fin-de-projet.md` | Ce document | |
| `etat-d-avancement.md` | Pour une IA ou un humain qui reprend le projet : où on en est, les invariants et où ils sont tenus, la liste à suivre par type de modification, les pièges déjà rencontrés | Ajouté le 2026-09-10 |
| `CLAUDE.md` | Chargé automatiquement par Claude Code : ordre de lecture et règles non négociables | Ajouté le 2026-09-10 |

Rien n'est commité : tout est dans l'arbre de travail, prêt à l'être.

## 2. L'architecture MCP

```
technicien ──/support──▶ Claude Code ──stdio──▶ serveur support-it (Node.js)
                          │                        │
                          │  8 outils MCP          ├── lit  produit/   (livré, remplacé en bloc)
                          │                        └── lit/écrit installation/ (au client, jamais écrasé)
                          ▼
                   skills en contexte
```

Le schéma complet du flux, avec la reprise, les points d'étape, la pause,
l'écriture du contexte et la branche de remplissage, est dans
`architecture/schema/routage_support_v3.svg` (la v2 est gardée pour
l'historique).

**Le point d'entrée** `~/.claude/skills/support/SKILL.md` fait dix lignes :
« appelle `load_skill(["triage"])` et suis ce qu'il renvoie ». Toute
l'intelligence est derrière le serveur, dans des fichiers markdown.

**Les neuf appels**, dans l'ordre d'un ticket (état du 2026-09-11 ; les changements du 2026-09-18 sont en §10) :

| Appel | Renvoie ou écrit |
| --- | --- |
| `load_skill(["triage"])` | `produit/contenu/general/triage.md` (flux, règles, format) + le manifeste rendu (domaines, statuts, signaux, questions de rattrapage) |
| `load_skill([domaine(s)], nature)` | Le skill (`skill.md` ou `demandes.md`), **ses sections `requis` déjà résolues**, sa table `selon-cas` ; erreurs explicites pour domaine inconnu, hors bêta, nature absente, plus de deux domaines |
| `get_context([domaine/section…])` | Par section : `ok` (contenu), `vide` (dont « identique au gabarit » et « fichier absent »), `inconnue` — jamais une erreur globale |
| `search_kb(tags)` | Cas de `installation/kb/` triés par tags communs ; base vide = message nominal |
| `read_kb(ticket_id)` | Le cas publié : conclusion, plan d'action, signaux — ajouté le 2026-09-18 (§10) |
| `load_skill(["cloture"])` puis `save_ticket(…)` | `installation/tickets/<id>.md` + un journal par ticket dans `installation/journal/` (s'il y a eu des questions) ; id fabriqué par le serveur |
| `publish_kb(ticket_id)` | Copie dans `installation/kb/`, refus si absent ou déjà publié |
| `save_progress(id?, etape, …)` | Point d'étape : crée le brouillon du ticket dès le triage validé (`installation/en-cours/<id>.md`), puis le met à jour par fusion à chaque acquis ; enregistre la passation si le technicien change |
| `resume_ticket(ticket?)` | Liste des tickets en cours, ou brouillon + marche à suivre pour reprendre là où il en était, sans retrianger ; le triage reçoit la même liste |
| `update_context(section, contenu)` | Écrit une section du contexte après un oui explicite : consignes et titre conservés, date posée, version précédente dans `contexte/historique/`, fichier créé depuis le gabarit s'il manque. Servi par le skill `remplissage` (`load_skill(["remplissage"])`, avec l'état de remplissage) et par la clôture |

**Le serveur** : `produit/serveur/`, TypeScript, SDK MCP officiel, stdio.
Neuf modules, sens unique des dépendances, aucune écriture hors de
`installation/`, création exclusive des fichiers. Détail dans
`architecture/D-serveur-mcp.md`. **Le CLI** `dist/cli.js` porte tout ce que
les scripts délèguent : `valider`, `init`, `etat`, `enregistrer`, `entree`,
`chemins`.

**L'installation** : `produit/install.ps1` ou `install.sh`, six étapes
identiques : prérequis, build, validation du produit, `init` (initialiser ou
rejoindre, idempotent), enregistrement dans `~/.claude.json` + copie du
point d'entrée, état de remplissage. Jamais bloquant sur un contexte vide.

## 3. Ce que j'ai fait sans toi

Par périmètre, après ta consigne « termine tout selon tes décisions » :

- **B/C** — le domaine **système** : `skill.md` (cinq crans), `demandes.md`
  (`creation-partage`, `restauration-fichier`), gabarit à neuf sections.
- **D** — `contrat-mcp.md`, `manifeste.md`, `outillage.md` ; le serveur, le
  CLI, le test de fumée, le manifeste, `triage.md`, `cloture.md`, le point
  d'entrée ; `architecture/D-serveur-mcp.md`.
- **E** — `conception/triage.md` et le texte livré `produit/contenu/general/triage.md`.
- **F** — `base-connaissances.md` : format des tickets, du journal, de la base.
- **G** — `gouvernance.md`, dont le format du plan d'action.
- **H** — `deploiement.md` (H4, H5 tranchés), les deux scripts.
- **Validation** — tests D et H ajoutés, porte 1 détaillée, journal tenu ;
  `retours-beta.md` pour tes notes.
- **Plan** — mis en cohérence partout où une décision le changeait.

## 4. Décisions prises seul

Chacune est écrite dans le document de conception concerné avec sa raison ;
voici la liste pour que tu puisses les contester d'un coup d'œil.

| # | Décision | Où | Pourquoi, en une ligne |
| --- | --- | --- | --- |
| 1 | `load_skill` renvoie les sections `requis` déjà résolues | contrat-mcp §1, plan 0.3 | Le serveur lit l'en-tête de toute façon ; le modèle peut oublier un identifiant, le code non. |
| 2 | Valeur réservée `cloture` en plus de `triage` | contrat-mcp §1 | Les consignes de clôture ne sont chargées qu'à la fin : même logique de coût que `demandes.md`. |
| 3 | `triage.md` porte le flux entier | triage §1 | Le point d'entrée fait dix lignes ; le modèle doit connaître le flux dès le premier tour. |
| 4 | `save_ticket` structuré, et c'est lui qui écrit le journal des questions | contrat-mcp §4, base-connaissances §3 | Le plan décrivait le journal sans qu'aucun appel ne l'écrive. |
| 5 | Vocabulaire des tags unique, par extension (domaines, tags du manifeste, tags libres) | manifeste §3 | Question ouverte D/F du plan ; un seul vocabulaire rend lisible pourquoi un cas matche. |
| 6 | Manifeste écrit à la main, validé par script ; il porte une copie livrée des signaux | manifeste §3 | `conception/` n'est pas livré, le triage a besoin des signaux à l'usage. |
| 7 | « Vide » = identique au gabarit livré, pas seulement « rien sous le titre » | format-contexte §3 | Trouvé au test de fumée : une table de placeholders passait pour du contenu. |
| 8 | Pas de cadrage systématique au lancement | triage §2 | Question ouverte du plan §4 ; un formulaire se remplit machinalement en deux semaines. |
| 9 | Ambiguïté = trois cas observables ; deux domaines maximum, refusé par le serveur | triage §2 | Une définition par cas, et une limite structurelle plutôt qu'une consigne. |
| 10 | Format du plan d'action fixé en G | gouvernance §4 | Laissé ouvert par format-skill §9 ; six copies sinon. |
| 11 | Statuts de ticket : `resolu`, `non-resolu`, `hors-domaines-couverts`, `escalade-externe` | contrat-mcp §4 | `hors-domaines-couverts` mesure ce que la bêta ne couvre pas. |
| 12 | Identifiant `AAAAMMJJ-HHMMSS-utilisateur-poste` | base-connaissances §2 | Unique sans coordination, lisible, trie par nom. |
| 13 | Publication = copie dans `kb/`, ticket source jamais modifié | base-connaissances §3 | « Un fichier écrit une fois » reste vrai sur un partage. |
| 14 | Enregistrement MCP par écriture de `~/.claude.json` (sauvegarde avant), pas `claude mcp add` | outillage | Le CLI `claude` n'est pas sur le PATH avec l'application de bureau. |
| 15 | H4 : remplacement en bloc, pas de migration automatique des gabarits | deploiement §3 | Une section ajoutée par script serait vide et prise pour du contenu. |
| 16 | H5 : archive de `produit/` pour un client, Git pour l'équipe | deploiement §4 | Un client n'installe pas Git pour recevoir des fichiers. |
| 17 | Un seul plan d'architecture (D) pour la bêta | plan 2.1 | Les autres périmètres n'ont pas de code. |
| 18 | Domaine système : `restauration-fichier` plutôt que « création de compte » | demandes.md système, échange du 2026-09-03 | La taxonomie place les comptes dans identité, hors bêta. |
| 19 | Réponses MCP en markdown, erreurs d'usage en texte `isError` | architecture D §1 | C'est ce que le modèle lit et corrige ; une exception ne l'aide pas. |
| 20 | `install.ps1` en UTF-8 avec BOM, vérifié par `valider` | deploiement §2 | PowerShell 5.1 cassait sur les guillemets français. |
| 22 | Référence du ticket externe : demandée avant le triage, champ `reference` de `save_ticket`, en-tête + titre + tag, pas dans le nom de fichier | triage §2, contrat-mcp §4, base-connaissances §2 | Trou signalé par toi le 2026-09-09 : le technicien part d'un ticket de son outil, l'IA n'y accède pas mais doit le reporter. |
| 23 | Sixième appel `update_context` + skill `remplissage` + consigne du gabarit renvoyée par `get_context` sur section vide — demandé par toi, forme choisie par moi | contrat-mcp §5 bis, gouvernance §2, plan §4 | La bêta se joue à vide : remplir par conversation est le chemin le plus court, et le plan le prévoyait. Une section à la fois, oui explicite, sauvegarde avant écriture. |
| 26 | Taxonomie du brouillon : un champ, une nature, une limite imposée par le serveur ; corps du fichier réduit à l'état — demandé par toi après le premier brouillon réel (29 Ko) | contrat-mcp §5 ter, base-connaissances §2 bis, architecture D | Le modèle écrivait un récit et le fichier doublait tout ; un acquis est une ligne qu'un repreneur utilise sans relire la conversation, et une contrainte mécanique vaut mieux qu'une consigne. |
| 25 | Pause, reprise, passation : brouillon par ticket dans `en-cours/`, `save_progress` (fusion) et `resume_ticket`, clôture sous le même id avec brouillon retiré, liste des tickets en cours jointe au triage — demandé par toi le 2026-09-10, forme choisie par moi | contrat-mcp §5 ter, plan 0.3 et D, base-connaissances §2 bis, triage §3 ter, architecture D | L'état d'un ticket ne vivait que dans la conversation. Deux appels séparés plutôt qu'un `save_ticket` à statut « en cours » ; suppression du brouillon plutôt qu'archivage ; un point d'étape par acquis. |
| 24 | Taxonomie du contexte à trois niveaux (structure, pivots, instances), section `general/plateformes`, signal « volumineuse » dans `etat` — demandé par toi après le premier ticket | format-contexte §4.1, plan C | Le contexte reçoit ce que l'entreprise possède, pas ce que chaque ticket crée ; sinon il devient une CMDB qui coûte des tokens à chaque ticket. |
| 27 | Le cloud n'est pas un domaine mais une plateforme (`general/plateformes`) — demandé par toi le 2026-09-11 après discussion | plan A, taxonomie §7, retours-beta | Le triage reconnaît ce que le problème suit ; l'hébergement n'est pas un signal et transperce tous les domaines. L'incident Entra avait sa cause on-prem. |
| 28 | Bêta v2 : les quatre domaines décrits passent en bêta le 2026-09-11 (skill, demandes, gabarit chacun ; 44 sections) — demandé par toi, contenu écrit par moi | manifeste, `contenu/domaines/`, taxonomie, validation §2, format-contexte §6, fin-de-projet §9 | Le deuxième ticket réel avait besoin d'identité. Sections tirées du listing du 2026-09-11 (niveau 1–2 seulement) ; les trois sections transverses envisagées (bastions, conventions, outillage) ne sont pas ajoutées : elles toucheraient toutes les installations. |
| 29 | Le test de fumée rejoue le cas « domaine décrit, hors bêta » sur une copie temporaire du produit avec un domaine synthétique | `test/smoke.ts`, architecture D §7 | Le produit livré n'a plus de domaine `decrit` ; la branche du serveur doit rester testée pour les domaines futurs. |
| 30 | Scripts d'installation : test de fumée à l'étape 3 (`tester`, `-SansTest`), `installation/VERSION` écrit par `init` avec le mode « MISE À JOUR x → y », `.gitattributes` pour les fins de ligne, bit exécutable de `install.sh`, `valider` refuse un `.sh` avec CR — demandé par toi le 2026-09-11 (« je n'installe qu'à travers ces scripts ») | deploiement §2 et H4, outillage, validation T-H1/T-H2 | `valider` prouvait que le produit était bien formé, pas que le serveur répondait sur le poste ; un `clone` Windows avec `autocrlf` aurait cassé `install.sh` dans une archive H5 ; une mise à jour silencieuse ne disait pas d'où l'on venait. |
| 31 | Journal : un fichier par ticket (`journal/<id>.md`, sections candidates en en-tête) au lieu d'un fichier par question — demandé par toi le 2026-09-11 | base-connaissances §1 et §3, contrat-mcp §4, architecture D §3 | Onze fichiers pour deux tickets, redondants avec la section `questions` du ticket ; illisible à 50 tickets. La règle d'origine visait un journal *commun* mutable, pas un fichier par ticket écrit une fois. Les `-qNN` existants ne sont pas migrés. |
| 32 | **Tags fermés, deux étages** : bibliothèque produit (manifeste, par domaine) ∪ client (`installation/tags.yaml`, `general` pour les transverses), enum ≤ 5 cochés, filtrés sur les domaines validés, servis par `cloture` ; la liste ne grandit que par la main du référent — décidé avec toi le 2026-09-14, amendé le 2026-09-17, implémenté le 2026-09-18 | plan-after-beta déc. 1 et §2.7, contrat-mcp §4-§6, manifeste.md, gouvernance §3 | 74 tags libres sur trois entrées réelles, des coquilles, des tags qui matchent tout : un tag libre est un choix du modèle sur la mécanique. |
| 33 | **Signaux identifiés** : `{ id, libelle }` au manifeste, `max_signaux`, enum au démarrage, le modèle coche `{ id, preuve }`, le serveur classe les domaines et refuse un domaine proposé sans signal (incident) — décidé avec toi le 2026-09-17, implémenté le 2026-09-18 | déc. 2 et §2.6, manifeste.yaml, contrat-mcp §6, triage.md | Un signal rédigé de mémoire ne sert à personne ; le triage « constate lesquels sont présents ». Le manifeste a 20 signaux, pas 24. |
| 34 | **État de session** : un processus par session, le serveur garde brouillon courant, skills chargés, sections servies, cas lus ; recopié dans le brouillon, reconstruit par `resume_ticket` ; refus hors séquence ; étape et escalades dérivées ; aucun refus sans brouillon courant — décidé avec toi le 2026-09-17, implémenté le 2026-09-18 | déc. 3 et §2.4, session.ts, contrat-mcp §6, D-serveur §4-§5 | L'ordre du flux était tenu par le prompt seul ; le stdio donne un processus par session, gratuitement. Voie A (id sur les lectures) écartée : le modèle l'oublierait. |
| 35 | **`read_kb`, neuvième appel**, et D2 (score par rareté, rendu compact, plafond fixe, `limite` retirée) — décidé avec toi le 2026-09-17, implémenté le 2026-09-18 | déc. 4 et §2.5, contrat-mcp §3 et §3 bis | La base servait à savoir qu'un cas existe, pas à s'en servir ; un paramètre qui change ce que fait `search_kb` était un choix du modèle sur la mécanique. |
| 36 | **L'hôte tient l'invariant** : `.claude/settings.json` déposé par `install` (`hote`), `Bash` et `PowerShell` retirés, `installation/` interdite à l'écriture, `kb/` et `en-cours/` à la lecture ; pas de hooks — décidé avec toi le 2026-09-17, implémenté le 2026-09-18 | déc. 5 et §2.3, deploiement §2, gouvernance §2, validation T-H5 | Le mode de permission se désactive d'un clic ; `Write(chemin)` n'est pas consulté par Claude Code, `Edit(chemin)` couvre les deux. `PowerShell` ajouté : l'outil shell sous Windows. |
| 37 | **Tout en une passe, puis dix tickets** — amende la décision 6 (trois lots avec tickets intercalés) ; la passe sur le manifeste vient après les tests, pas avant — décidé par toi le 2026-09-18 | plan-after-beta §2.0, §2.11, §3 | Tester le produit complet plutôt qu'à moitié transformé ; ne pas jouer des tickets avec des skills qu'on sait devoir réécrire. Coût assumé : l'enum des signaux est figé avant les tickets réels sur quatre domaines. |
| 38 | **Ce qu'on ne fait pas dans ce cycle** : empreinte optimiste, périmètre I, paliers, installation par poste, rétention d'`historique/`, hooks, `creation-vm`, migration des tickets existants, `mesures`, compatibilité produit/installation — décidé avec toi le 2026-09-18 | déc. 7 | Nommé pour que ça ne revienne pas par la fenêtre pendant l'implémentation. |
| 39 | **L'audit** : `audit.ts` calcule (jeu de test du triage, brouillons anciens/zombies/orphelins, résolus non publiés, tags hors bibliothèque, cas lus, actions multiples, santé C3, T-P7 ; périmées, candidats, volumineuses, placeholders, historique), rapport daté dans `audits/`, commande CLI et skill `audit` qui propose un par un sur oui et n'écrit jamais de lui-même — décidé avec toi le 2026-09-18, implémenté le même jour | déc. 8 et §2.9, audit.md, outillage.md | Le projet produisait des données sans outil pour se regarder ; T-P7 était vide depuis le premier jour. `verifier` (C3) et `mesures` absorbées. |
| 40 | **Validité du contexte** : péremption 90 jours annotée « à confirmer » à l'usage, confirmation = `update_context` à contenu identique (re-date sans historique), `contradictions` de `save_progress` reprises à la clôture, file des candidats servie par `remplissage` et l'audit — décidé avec toi le 2026-09-18, implémenté le même jour | déc. 9 et §2.8, format-contexte §5, contrat-mcp §5 bis | La boucle de fraîcheur de `validation.md` §6, différée depuis le 2026-09-11 ; pas d'appel `confirm_context`, pas de seuil par section. |
| 41 | **Une question, une commande, attendre** : deux règles mot pour mot dans les douze skills (`valider` les exige), plan en séquence numérotée, T-B8 ; les règles « à confirmer » et « contradiction » voyagent avec la donnée plutôt que d'être répétées — décidé avec toi le 2026-09-18, implémenté le même jour | déc. 10 et §2.2, format-skill §6, gouvernance §4 | Le ticket RBAC Azure : le modèle livrait les étapes 0 à 2 d'un coup ; « une commande à la fois » n'était écrit nulle part. Tenu par le prompt seul, c'est dit comme tel. |
| 42 | **Domaines validés : union, jamais de retrait** après le premier skill de domaine ; `save_ticket` les prend du brouillon — décidé avec toi le 2026-09-20 (E5) | §11, contrat-mcp §5 ter | T3 : le ticket final disait `domaines_valides = escalades = [identite]`, poste-de-travail perdu, jeu de test du triage faussé. |
| 43 | **Un signal par domaine proposé, demandes comprises**, signal `objet-…` par domaine et domaine `hors-perimetre` décrit au manifeste — décidé avec toi le 2026-09-20 (E10) | §11, manifeste, triage | T6 : devis de câblage routé en réseau ; « hors des domaines couverts » n'était tenu par rien pour une demande, et aucun domaine non couvert n'existait. |
| 44 | **Enregistrement MCP en portée projet** (`.mcp.json` dans le dossier de lancement) — décidé avec toi le 2026-09-20 (E18) | §11, deploiement §3 | D5 : `install.sh` sur un dossier temporaire a réécrit `~/.claude.json` et détourné l'installation de test. Une machine = plusieurs installations possibles ; approbation du `.mcp.json` au premier lancement à documenter. |
| 45 | **Les colonnes d'un tableau de contexte ne se choisissent pas** : `update_context` refuse un en-tête différent de celui attendu (le squelette du gabarit si la section est vide ou absente, les colonnes en place sinon) ; la clôture dit « section jamais servie → `get_context` d'abord » — décidé avec toi le 2026-09-21 (EA2) | §12, contexte.ts, cloture.md | Campagne sans jeu de données, V1 : `systeme/serveurs`, jamais servie dans la session, écrite avec `Serveur \| Rôle \| Adresse \| Site` au lieu des six colonnes du gabarit, et rien ne le détectait. Sur un contexte vide c'est le cas courant. Principe du 2026-09-14 : la forme est dérivable, donc au serveur. Contrepartie : changer les colonnes d'une section se fait à la main par le référent, pas par l'outil. |
| 46 | **Un candidat au contexte est « déjà appliqué » seulement s'il est contenu en entier** dans la section (normalisé), plus un préfixe de 60 caractères — décidé seul le 2026-09-21 (EA3) | §12, audit.ts | V3 : la mise à jour d'EX-3002 pour `reseau/acces-distant` reprenait la section et y ajoutait une IP et un piège ; même début → écartée, l'ajout perdu pour `remplissage` et `audit`. C'est le fonctionnement normal d'une installation qui grandit ticket après ticket. |
| 21 | `produit/` regroupé par nature : `contenu/` (manifeste, `general/`, `domaines/`), `serveur/`, `entrees/`, scripts à la racine — demandé par toi, forme choisie par moi | plan H, deploiement §1 | La racine mélangeait contenu, code, scripts et adaptateurs ; `general` garde le nom de l'identifiant que les skills référencent. |

## 5. Ce que les tests ont trouvé

Trois défauts, tous corrigés et consignés dans `validation.md` §7 :

1. La définition de « vide » (décision 7).
2. Un exemple réaliste (`srv-paris-01`) dans le template de gabarit, attrapé
   par le contrôle « aucune donnée d'entreprise » qui venait d'être écrit.
3. L'encodage de `install.ps1` (décision 20).

État final : `npm run build` sans erreur, `valider` zéro erreur et un
avertissement accepté (skill système à 105 lignes), `npm test` vert, les
deux scripts verts sur une installation temporaire.

## 6. Ce qui n'est pas fait, et les limites connues

- **Aucun ticket réel n'a été joué.** Le test de fumée exerce le serveur,
  pas le comportement du modèle. Les tests T-P1 à T-P7 de `validation.md`
  sont à toi.
- **T-H3 (installation réelle) non joué** : il écrit dans ta configuration
  Claude Code. Le script est testé avec `-SansClaude` seulement.
- **Multi-utilisateur non testé** : le code respecte les règles (racines
  configurables, création exclusive, index reconstruit), mais un partage
  réel n'a pas été exercé. Porte 2.
- **Les points d'étape sont une discipline de prompt** : si le modèle oublie
  un `save_progress`, ce qui a été dit depuis le dernier est perdu à la
  fermeture de la session. T-P9 compte les oublis ; c'est le premier chiffre
  à regarder sur cette fonction.
- **Le contexte et les brouillons sont les deux matières mutables** : deux
  `update_context` simultanés sur le même fichier depuis deux postes ne sont
  pas protégés par un verrou ; `historique/` garde la version écrasée. Test
  à la porte 2. L'architecture cible est écrite : concurrence optimiste par
  empreinte, sans verrou (`architecture/D-serveur-mcp.md` §8), à
  implémenter au passage sur le partage.
- **Pas d'outil pour le référent** : il lit `journal/` et les tickets à la
  main ; `etat` lui dit ce qui est vide.
- **Le mode de permission n'est pas imposable** par le script ; il est
  rappelé. C'est la seule barrière contre une commande lancée par Claude
  Code lui-même.
- **Le skill système fait 105 lignes**, tolérance de `validation.md` T-B2.
- **Spécialisation après ~50 tickets, portabilité multi-outils, test
  multi-modèles** : différés comme prévu (`validation.md` §6).
- **`claude mcp add` non utilisé** : si tu préfères, `enregistrer` peut être
  remplacé par cette commande quand le CLI est sur le PATH.

## 7. Comment tester

1. Depuis la racine du dépôt, sous PowerShell :
   ```powershell
   .\produit\install.ps1
   ```
   L'installation se crée dans `installation/` à côté de `produit/`
   (ignoré par Git). Pour un autre emplacement : `-Installation <chemin>`.
2. Redémarrer Claude Code. Vérifier avec `/mcp` que `support-it` est là
   avec neuf outils.
3. Remplir au moins `installation/contexte/general.md` (sites, référents) et
   deux ou trois sections de `reseau.md` — ou ne rien remplir, pour voir
   l'outil poser ses questions.
4. Taper `/support` suivi d'une description de ticket. Suivre T-P2 à T-P6.
5. Après chaque ticket, ouvrir `installation/tickets/` et `journal/`.
6. Noter chaque observation dans `conception/retours-beta.md`.

Avant de livrer une modification du produit :
```bash
cd produit/serveur && npm run build && node dist/cli.js valider && npm test
```

## 8. Suite proposée

Une semaine de tickets réels, puis une session pour dépouiller
`retours-beta.md` : corriger les skills sur ce qui a été observé, faire
monter les tags libres au manifeste, décider si le référent a besoin d'un
outil, et écrire les tests de la porte 2.

---

## 9. Bêta v2 — 0.2.0-beta, 2026-09-11

**Ce qui change.** Quatre domaines passent de « décrit » à « bêta » :
`poste-de-travail`, `materiel`, `identite`, `applicatif`. Pour chacun :
`skill.md` (cinq à six crans, escalade vers les cinq autres), `demandes.md`
(deux ou trois demandes), `contexte.exemple.md` (cinq ou six sections de
niveau 1–2). Le manifeste porte leurs tags ; `valider` passe à zéro erreur
(six avertissements de longueur, tous sous 110 lignes) ; le test de fumée
charge les six domaines en incident et en demande.

| Domaine | Demandes | Sections de contexte |
| --- | --- | --- |
| identité | `creation-compte`, `depart-collaborateur`, `attribution-droits` | `annuaires`, `synchronisation`, `authentification`, `groupes-droits`, `cycle-de-vie`, `comptes-service` |
| poste de travail | `installation-logiciel`, `preparation-poste` | `parc`, `deploiement`, `applications-standard`, `profils`, `securite-poste`, `impression` |
| matériel | `remplacement-materiel`, `commande-materiel` | `parc-materiel`, `fournisseurs-sav`, `stock`, `peripheriques`, `salles-techniques` |
| applicatif | `habilitation-applicative`, `mise-a-jour-applicative` | `catalogue`, `responsables`, `editeurs-support`, `integrations`, `environnements`, `acces-applicatifs` |

**Ce qui a été décidé** : décisions 27 à 29 du tableau §4 (le cloud est une
plateforme ; les quatre domaines ; le domaine décrit synthétique du test).

**Ce qui n'est pas fait.**

- Aucun des quatre domaines n'a été joué sur un ticket réel : T-A1, T-A2,
  T-B1, T-B5, T-B6, T-B7 sont à jouer (`validation.md` §7, ligne du
  2026-09-11). Les crans de diagnostic et les sections sont des hypothèses
  de support IT générique ; le premier ticket de chaque domaine dira ce qui
  manque.
- `creation-vm` côté système, avec la plateforme en prérequis : attend
  « une demande par fichier », `demandes.md` système étant à sa limite.
- Les trois sections transverses envisagées (bastions, conventions,
  outillage) : non ajoutées, voir `format-contexte.md` §6.
- Le triage reçoit désormais six domaines à quatre signaux : c'est la
  limite basse du goulot décrit en `plan.md` §5 ; T-A1 sur les dix lignes
  dira si le triage tient encore.

**Pour une installation existante** : remplacer `produit/` (H4), relancer
`install.*` — `init` en mode « rejoindre » copie les quatre nouveaux
gabarits sans toucher aux fichiers existants ; `etat` les montrait
« ABSENT » avant. Rien n'est migré.

## 10. Bêta v3 — 0.3.0-beta, 2026-09-18 : le lot déterminisme

**Ce qui change.** Dix décisions (`plan-after-beta.md` §1), un plan
(§2), un plan de test (§3), neuf chantiers implémentés en une passe sur la
branche `v0.3.0-beta`, un commit par chantier. Le principe : **le modèle
n'a pas de choix sur la mécanique** (`retours-beta.md`, 2026-09-14). Ce
qui était tenu par le prompt seul et que les tickets réels ont vu lâcher
passe côté serveur ou côté hôte.

| Avant | Après |
| --- | --- |
| Huit appels ; `search_kb` renvoie la première ligne, le modèle devine le chemin | Neuf appels : `read_kb` lit un cas publié ; score par rareté, rendu compact |
| Le serveur ne sait pas à quel ticket un appel appartient | État de session : brouillon courant, skills, sections, cas lus ; refus hors séquence ; étape et escalades dérivées |
| Signaux rédigés, tags libres, domaines en chaînes | Enums construits au démarrage : signaux `{ id, preuve }`, tags ≤ 5 d'une bibliothèque à deux étages, domaines, sections |
| Symptôme, référence, plan, questions retapés à la clôture | Le brouillon est la source ; référence stable et jamais inventée ; durée calculée ; `resolu_par` null |
| Le modèle peut écrire `installation/` avec `Edit`, lire `kb/`, lancer `Bash` | `.claude/settings.json` déposé par `install` |
| Rien n'entretient le contexte | Péremption annotée, confirmation à l'identique, contradictions en ticket, file des candidats |
| Rien ne relit l'installation ; T-P7 vide | `audit` : rapport daté, commande CLI et skill, propositions un par un sur oui |
| « Une question à la fois » partout, « une commande à la fois » nulle part | Deux règles mot pour mot, contrôlées par `valider` ; plan en séquence |

**Ce qui a été décidé** : décisions 32 à 41 du tableau §4.

**Ce qui n'est pas fait.**

- Le jeu de données de test (`outils/jeu-de-test.mjs`, §3.1 du plan) et
  les dix tickets (§3.3) : c'est la phase de test, à jouer sur une
  installation neuve.
- La passe sur le manifeste (signaux) : **après** les dix tickets.
- Le schéma SVG v4 (le v3 ne montre ni `read_kb`, ni l'étape dérivée, ni
  l'audit).
- Tout ce que la décision 7 remet à plus tard.

**Pour une installation existante** : remplacer `produit/`, relancer
`install.*` — `init` (mode mise à jour) crée `tags.yaml` et `audits/`,
`hote` dépose `.claude/settings.json`. Les brouillons, tickets et entrées
de base existants se lisent tels quels (signaux et tags libres acceptés en
lecture) ; rien n'est migré. Les tickets antérieurs sortent dans le jeu de
test du triage sans signaux cochés : à lire à la main.

## 11. Campagne de test 0.3.0-beta — 2026-09-19/20, et ses corrections

**Ce qui a été joué** (`campagne-test-0.3.0-beta.md`) : la mise en place
§3.2, onze tickets (T1–T10 + EX-2111), vingt refus (dix-neuf tirés par le
QA contre le serveur, B14–B18 dans l'onglet de test), C1–C11, D. Verdict au
critère de sortie §3.4 : atteint — aucun refus injustifié, l'hôte tient, C9
propre, D vert — mais dix-huit écarts et onze observations, dont trois
hauts, corrigés le 2026-09-20 avant de retoucher le manifeste.

| Écart | Correction (2026-09-20) | Tenu par |
| --- | --- | --- |
| E5 — à l'escalade, `domaines_valides` écrasé par le modèle ; `save_ticket` le prenait de l'argument | Après le premier skill de domaine, `save_progress` fait l'**union** (retrait signalé « ATTENTION », jamais appliqué) ; `save_ticket` prend les validés du brouillon (union), sauf `hors-domaines-couverts` | code (`encours.ts`, `tickets.ts`), smoke |
| E10 — hors-domaines non tenable : demande sans signal acceptée, aucun domaine non couvert au manifeste, skills demande contradictoires | Un signal par domaine proposé, **incident comme demande**, même sans aucun signal coché ; le manifeste porte un signal de demande `objet-…` par domaine et un domaine `hors-perimetre` **décrit** (travaux, achat, prestation, bâtiment) ; triage et skills de demande alignés | code, manifeste, contenu, smoke |
| E18 — enregistrement MCP en portée utilisateur : un `install` ailleurs détourne l'installation | `enregistrer` écrit `<dossier de lancement>/.mcp.json` (portée projet) et retire l'entrée utilisateur si elle pointait ici, la signale sinon | CLI, scripts, deploiement §3 |
| E15 — baseline court-circuitée, résolu accepté sans skill de domaine | `save_ticket` refuse `resolu` sans skill de domaine chargé ; triage §6 « le même flux » | code, contenu |
| E3, E4 — deux étapes par tour (7 fois), règle `\|` mal calibrée | Règle « une commande » réécrite mot pour mot dans les treize fichiers : une étape du plan par tour, jamais « fais les étapes 1 à 3 », le pipe est une invocation ; triage point 8 | prompt seul (consigné §3) |
| E8 — `resolu_par` décidé par le modèle (×3) | `cloture.md` : une question au technicien, jamais supposé | prompt seul |
| E11, E16 — symptôme préfixé par la référence, puis enrichi | Le serveur retire le préfixe `<référence> :` et le dit ; triage point 2 : « le premier message, moins la référence, jamais complété » | code + prompt |
| E12, E13 — adresse fabriquée dans une commande ; section « À confirmer » ignorée | Skill réseau cran 5 : charger `dns-dhcp` avant toute commande DNS ; triage point 4 ; annotation de péremption en **tête** de section, impérative | prompt ; rendu serveur |
| E14 — proposition d'éditer `kb/` | Règle « rien ne s'écrit dans `installation/` hors des appels » dans triage et clôture ; l'hôte reste le filet | prompt + hôte |
| E2, E7 — « tag inconnu : reseau » ; doublon d'id en base | Natures, domaines et références connus par construction dans `search_kb` ; dédoublonnage par id ; constat C3 « nom de fichier ≠ id » | code |
| E6, E17 — anomalie 7 jamais générée ; séparateur à 4 colonnes | Regex corrigée et vérifiée par le générateur ; YAML corrigé ; demandes du jeu avec leur signal ; étape 9 rejouée : 19 anomalies, `casse.md` compris | outils |
| O4, O9, O10, O11 | Clôture : la section **entière** dans `mises_a_jour_contexte` ; `save_ticket` annonce la durée retenue ; l'audit donne la prochaine étape des brouillons anciens et la conclusion des résolus non publiés ; candidats non tronqués | prompt ; code |

**Non corrigé, à trancher** (`campagne-test-0.3.0-beta.md` §1) : O1
(`get_context` non borné aux sections du skill), O2 (section en double à
l'écriture), O3 (la proposition ambiguë du triage n'est jamais
enregistrée), O5 (signaux et demandes — traité en partie par `objet-…`),
O6 (`/mcp` dans l'app), O7 (état écrit au point suivant), O8 (durée
calendaire), E9 (questions composées, à observer).

## 12. Campagne sans jeu de données — 2026-09-21, et ses corrections

**Ce qui a été joué** (`campagne-test-0.3.0-beta-sans-jeu-de-donnees.md`,
`859ffec`, env `C:\Projet-IT\support-it-test`) : le parcours d'un client —
`install.ps1` sans option sur un dossier sans `installation/`, mode
INITIALISER, 45 sections vides, base à 0 cas ; puis le remplissage depuis
rien (V0), trois tickets sur contexte vide (V1 réseau résolu et publié, V2
réseau en `escalade-externe`, V5 demande poste de travail non résolue), le
remplissage avec candidats (V3), l'audit skill et CLI (V4), trois refus
serveur (V6). Verdict : **la première installation fonctionne de bout en
bout** ; sur un contexte vide, chaque nom, adresse, équipement, contact et
source d'installeur a été demandé, jamais inventé dans une commande. E18
confirmé en vrai (deux installations sur le poste, la portée projet gagne).
Trois écarts, tous côté serveur/skills, corrigés le 2026-09-21 :

| Écart | Correction (2026-09-21) | Tenu par |
| --- | --- | --- |
| EA1 — E2 revient sur une base vide : les tags structurels étaient déduits des cas publiés, donc « tag inconnu : reseau » au premier ticket d'un client | `rendreRecherche` connaît toujours les natures et les identifiants de domaines de la bibliothèque (manifeste), en plus des références des cas en base | code (`kb.ts`), smoke |
| EA2 — mise à jour de contexte au format inventé pour une section jamais servie ; le serveur écrivait tel quel | Décision 45 : `update_context` compare l'en-tête du tableau à celui attendu (gabarit si vide, colonnes en place sinon) et refuse avec les deux en-têtes et le rappel `get_context` ; `cloture.md` : « section jamais servie → `get_context` d'abord » | code (`contexte.ts`) + prompt, smoke |
| EA3 — file des candidats : comparaison par préfixe de 60 caractères, une mise à jour qui étend une section était perdue | Décision 46 : inclusion du candidat entier normalisé | code (`audit.ts`), smoke |

**Rejeu le 2026-09-21** sur un vrai clone (`cf7f708`, journal §5) :
R-M1 (INITIALISER vu), R-EA1, R-EA2 (skill et serveur), R-EA3 verts, en
trois tickets (EX-3101 résolu publié, EX-3102 escalade externe, EX-3103
demande sur deux domaines).

**Non corrigé, à trancher** (§1 du journal) : OA1 (l'audit ne dit pas que
le contexte est vide), OA2 (copie `historique/` d'un gabarit vierge,
message « remplacée »), OA3 (`section:` sur une réponse oui/non — prompt),
OA4 (conseil « relance le ticket clôturé » — une demande reportée se met
en pause, prompt ; au rejeu le modèle a proposé la pause de lui-même), OA5
(déductions du modèle rangées comme réponses du technicien ou candidats :
convention de nommage, « Active Directory », « interface web » — l'invariant
« rien d'inventé » tenu par le prompt seul). Toujours à observer : E3 (2
occurrences atténuées en 3 tickets), E9 (5 questions composées), dates
calculées par le modèle, une phrase en anglais.

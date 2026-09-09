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
| `produit/` | Tout ce qui s'installe : manifeste, triage, clôture, deux domaines, gabarits, point d'entrée, serveur, scripts | Construit, validé, testé |
| `fin-de-projet.md` | Ce document | |

Rien n'est commité : tout est dans l'arbre de travail, prêt à l'être.

## 2. L'architecture MCP

```
technicien ──/support──▶ Claude Code ──stdio──▶ serveur support-it (Node.js)
                          │                        │
                          │  6 outils MCP          ├── lit  produit/   (livré, remplacé en bloc)
                          │                        └── lit/écrit installation/ (au client, jamais écrasé)
                          ▼
                   skills en contexte
```

**Le point d'entrée** `~/.claude/skills/support/SKILL.md` fait dix lignes :
« appelle `load_skill(["triage"])` et suis ce qu'il renvoie ». Toute
l'intelligence est derrière le serveur, dans des fichiers markdown.

**Les six appels**, dans l'ordre d'un ticket :

| Appel | Renvoie ou écrit |
| --- | --- |
| `load_skill(["triage"])` | `produit/contenu/general/triage.md` (flux, règles, format) + le manifeste rendu (domaines, statuts, signaux, questions de rattrapage) |
| `load_skill([domaine(s)], nature)` | Le skill (`skill.md` ou `demandes.md`), **ses sections `requis` déjà résolues**, sa table `selon-cas` ; erreurs explicites pour domaine inconnu, hors bêta, nature absente, plus de deux domaines |
| `get_context([domaine/section…])` | Par section : `ok` (contenu), `vide` (dont « identique au gabarit » et « fichier absent »), `inconnue` — jamais une erreur globale |
| `search_kb(tags)` | Cas de `installation/kb/` triés par tags communs ; base vide = message nominal |
| `load_skill(["cloture"])` puis `save_ticket(…)` | `installation/tickets/<id>.md` + un fichier par question dans `installation/journal/` ; id fabriqué par le serveur |
| `publish_kb(ticket_id)` | Copie dans `installation/kb/`, refus si absent ou déjà publié |
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
| 24 | Taxonomie du contexte à trois niveaux (structure, pivots, instances), section `general/plateformes`, signal « volumineuse » dans `etat` — demandé par toi après le premier ticket | format-contexte §4.1, plan C | Le contexte reçoit ce que l'entreprise possède, pas ce que chaque ticket crée ; sinon il devient une CMDB qui coûte des tokens à chaque ticket. |
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
- **Le fichier de contexte est la seule matière mutable** : deux
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
   avec six outils.
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

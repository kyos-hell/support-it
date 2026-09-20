# Déploiement et distribution

> Livrable du périmètre H. Décisions héritées : deux arborescences, H1
> (partage de fichiers, serveur local), H2 (PowerShell + bash), H3 (contenu
> du script), H6 (démarrage sur contexte vide), bêta sur Claude Code seul.
> Tranché ici : H4 (mise à jour) et H5 (distribution).

## 1. Ce qui est livré

```
produit/                         ← remplacé en bloc à chaque version
  VERSION
  install.ps1 · install.sh       ← ce qu'on lance
  contenu/                       ← tout ce que le modèle lit, et rien d'autre
    manifeste.yaml
    general/{triage,cloture,remplissage,contexte.exemple}.md
    domaines/<id>/{skill,demandes,contexte.exemple}.md
  serveur/                       ← le code (package.json, src/, dist/ après build)
  entrees/claude-code/support/SKILL.md   ← un dossier par outil hôte
  entrees/claude-code/settings.json      ← permissions refusées au modèle, déposées par « hote »
```

Quatre natures, quatre dossiers : un rédacteur de skills n'ouvre que
`contenu/`, un développeur que `serveur/`. Le contexte de `X` se résout
toujours en `contenu/<X>/contexte.exemple.md` (`general` ou `domaines/<id>`).

`installation/` n'est jamais livré. `plan.md`, `conception/`,
`architecture/` non plus.

## 2. Installation (H3, appliqué)

Une commande, à la racine de `produit/` :

```powershell
.\install.ps1 [-Installation <chemin>] [-SansClaude] [-SansBuild] [-SansTest] [-JeuDeTest]
```
```bash
./install.sh [--installation <chemin>] [--sans-claude] [--sans-build] [--sans-test] [--jeu-de-test]
```

`-JeuDeTest` / `--jeu-de-test` (2026-09-18, phase de test du plan
`plan-after-beta.md` §3) : après l'étape 4, **vide** l'installation et la
remplace par le jeu fictif « Exemple SAS » (`outils/jeu-de-test.mjs`).
Réservé au dépôt de développement : `outils/` n'est pas livré, le script
refuse si le fichier manque. Jamais sur une installation réelle — l'option
le dit en jaune.

Six étapes identiques dans les deux scripts, tout le travail délégué à
`node dist/cli.js` (une implémentation, `outillage.md`) : prérequis, build,
validation du produit **puis test de fumée** (refus d'installer une
livraison invalide ou un serveur qui ne répond pas sur ce poste — `tester`,
ajouté le 2026-09-11, `-SansTest` pour le sauter), `init` (initialiser,
rejoindre ou mettre à jour — même commande, idempotente, qui note la
version dans `installation/VERSION` et annonce le mode), `enregistrer` +
`entree` + `hote` (Claude Code), `etat`. Le script se termine par trois
rappels : remplir le contexte (à la main ou par `/support remplis le
contexte`), redémarrer Claude Code et accepter le serveur du projet quand
il le demande, lancer Claude Code depuis le dossier parent de `produit/` où
`.claude/settings.json` tient la règle « l'IA n'exécute rien » et `.mcp.json`
déclare le serveur.

**Portée de l'enregistrement MCP — projet, depuis le 2026-09-20 (E18 de la
campagne 0.3.0-beta).** `enregistrer` écrit `<dossier de lancement>/.mcp.json`
(fusionné, sauvegardé), plus `~/.claude.json`. Raison : en portée
utilisateur, un `install` lancé depuis un autre dossier (un test, un second
clone) réécrivait l'entrée et détournait l'installation en place sans
prévenir — constaté pendant la campagne (T-H1). En portée projet, deux
installations coexistent sur un poste, et le serveur suit le dossier de
lancement comme `.claude/settings.json`. Contreparties : Claude Code demande
une approbation du `.mcp.json` au premier lancement dans ce dossier (à dire
au technicien) ; une ancienne entrée utilisateur est retirée par
`enregistrer` si elle pointe sur ce produit, signalée sinon. La vérification
robuste après installation n'est pas `/mcp` (peu lisible dans l'app desktop,
qui mêle ses propres serveurs et ouvre parfois le catalogue des connecteurs)
mais le premier appel : `/support` → `load_skill(["triage"])`.

**Encodage et fins de ligne.** `install.ps1` est enregistré en **UTF-8 avec
BOM** : Windows PowerShell 5.1 lit un `.ps1` sans BOM dans la page de codes
ANSI et les guillemets français cassent une chaîne (trouvé au test T-H1).
`install.sh` est en UTF-8 sans BOM, fins de ligne **LF** : bash refuse un
script CRLF (« `\r` : command not found »), et un poste Windows avec
`core.autocrlf=true` convertit au `clone` — d'où `.gitattributes` à la
racine (`*.sh eol=lf`, `*.ps1 eol=crlf`) et le bit exécutable posé dans
l'index (`git update-index --chmod=+x`). `valider` vérifie le BOM du `.ps1`
et l'absence de CR dans le `.sh` (2026-09-11). Le script PowerShell force
la console en UTF-8 pour que les messages de node s'affichent sans
mojibake.

**Politique d'exécution PowerShell.** Si le poste refuse le `.ps1` :
`powershell -ExecutionPolicy Bypass -File .\install.ps1`. Rappelé dans
l'en-tête du script ; le script ne modifie jamais la politique lui-même.

**Poste suivant sur un partage** : même commande avec
`-Installation \\serveur\support-it\installation`. `init` trouve
`contexte/` présent, ne copie rien, n'écrase rien.

**Ce que Claude Code ne peut plus faire — `.claude/settings.json`
(décision 5 du 2026-09-17, implémentée le 2026-09-18).** L'étape 5 appelle
aussi `hote`, qui dépose dans le **dossier de lancement** — le parent de
`produit/`, d'où le technicien lance Claude Code — un
`.claude/settings.json` de permissions refusées, à partir du modèle livré
`produit/entrees/claude-code/settings.json` :

```json
"permissions": { "deny": [
  "Edit(/installation/**)",
  "Read(/installation/kb/**)",
  "Read(/installation/en-cours/**)",
  "Bash",
  "PowerShell"
] }
```

Pourquoi : le modèle pouvait écrire `installation/contexte/reseau.md` avec
`Edit` (sans `update_context`, sans `historique/`, sans oui), lire une
entrée de base en devinant son chemin, ou exécuter une commande. Le mode de
permission était la seule barrière, et il se désactive d'un clic. Avec ce
fichier, la seule façon d'écrire dans `installation/` est un appel MCP :
l'invariant « rien n'est écrit hors des appels » est tenu par l'hôte, plus
par le prompt. `contexte/` et `tickets/` restent lisibles (`get_context`
fait le tri, lire une archive n'a pas de dommage). `Bash` **et**
`PowerShell` (l'outil shell de Claude Code sous Windows) sont retirés
entièrement : « l'IA guide, le technicien exécute ». Le CLI (`etat`,
`valider`, `audit`) est au référent, dans son terminal.

Vérifié dans la documentation Claude Code et en vrai le 2026-09-18 :

- Un motif `/chemin` est relatif au dossier qui contient `.claude/`, pas au
  répertoire courant : le fichier tient même si Claude Code est lancé d'un
  sous-dossier. Si l'installation n'est pas sous le dossier de lancement
  (partage réseau), `hote` écrit la forme absolue `//C:/…/installation/**`
  et le dit — à vérifier au premier ticket.
- Une règle `Write(chemin)` n'est **pas** consultée par Claude Code ; c'est
  `Edit(chemin)` qui couvre Edit et Write, et `Read(chemin)` bloque aussi
  Edit et Write sur le même chemin (≥ 2.1.228). D'où `Edit` et non `Write`.
- Un outil nommé sans motif (`Bash`) est retiré du contexte du modèle, qui
  ne le voit plus. Un refus tombe **immédiatement**, sans redémarrage, et
  le modèle reçoit un message lisible (`Permission to use Bash has been
  denied.`) : il peut se rabattre sur l'appel MCP.
- Les règles `deny` s'appliquent sans que le dossier soit « trusted »,
  et priment sur toute règle `allow` de tout niveau.

`hote` **fusionne**, n'écrase jamais : les entrées manquantes de `deny`
sont ajoutées, le reste du fichier (`allow`, `env`, hooks…) est intact,
l'ancien est copié en `settings.json.support-it.bak` ; relancé, il dit
« déjà en place, rien ajouté ». Pour lever une interdiction, le référent
édite le fichier à la main. Piège rencontré : lancer `hote` dans un dépôt
de développement dépose le fichier à la racine du dépôt et coupe `Bash` à
l'assistant qui y travaille — d'où `.claude/` dans le `.gitignore` du dépôt
et un essai toujours fait sur une copie temporaire du produit.

Pas de hooks dans ce cycle (`PreToolUse`, `Stop`) : ce qu'ils auraient
bloqué est côté serveur (état de session, décision 3). Le smoke ne peut
pas tester l'hôte : test manuel T-H5 (`validation.md` §2.5).

## 3. H4 — Mise à jour, tranchée

| Question | Décision | Raison |
| --- | --- | --- |
| Comment livrer une nouvelle version ? | Remplacer le dossier `produit/` en bloc (l'ancien renommé `produit.<VERSION>/` à côté), relancer `install.*`. | Le script n'écrit jamais dans `installation/` : impossible de détruire le travail du client (H). `enregistrer` réécrit l'entrée MCP vers le nouveau `dist/`. |
| Retour arrière ? | Renommer les dossiers dans l'autre sens, relancer `install.*`. | Même mécanisme, rien de nouveau à tester. |
| Gabarit qui gagne une section ? | `etat` la liste comme **MANQUANTE** ; le référent ajoute le titre `## id — titre` dans le fichier rempli et le remplit quand il peut. Tant qu'elle manque, le serveur répond `inconnue`, le skill pose sa question. | Comparaison index gabarit / index rempli (bénéfice noté en H). Aucune migration automatique : une section ajoutée par script serait vide et prise pour du contenu. |
| Nouveau domaine livré (bêta v2, 2026-09-11) ? | `etat` montre le fichier de contexte **ABSENT** ; `init` (mode rejoindre, relancé par `install.*`) copie le gabarit du nouveau domaine et ne touche à aucun fichier existant. | Même mécanisme que l'initialisation : `init` ne copie que ce qui manque. Le domaine fonctionne sur un contexte vide (0.4). |
| Section renommée ou supprimée dans le gabarit ? | Interdit sans note de version : l'ancienne apparaît « en plus » dans `etat`, la nouvelle « manquante ». Le rédacteur préfère ajouter et laisser l'ancienne. | Renommer un `id` casse les skills qui le déclarent (C §2). |
| Versionnement ? | `produit/VERSION` (semver, `-beta`), repris par le serveur dans sa déclaration MCP et par le script. Depuis le 2026-09-11, `init` écrit aussi `installation/VERSION` : la version du produit qui a initialisé ou mis à jour l'installation, et affiche « MISE À JOUR x → y » quand elles diffèrent. | Une version lisible dans l'entrée MCP de Claude Code suffit à savoir quel produit tourne ; celle de l'installation dit d'où l'on vient et prépare la règle de compatibilité (`plan.md` §5). Seule écriture de `init` hors des gabarits, dans `installation/` comme tout le reste. |

## 4. H5 — Distribution, tranchée

| Question | Décision | Raison |
| --- | --- | --- |
| Dépôt Git, archive ou paquet ? | **Archive du dossier `produit/`** (zip) par version, pour les clients. Le dépôt Git reste l'outil de l'équipe et des collègues de la bêta, qui font `git pull` puis `install.*`. | Un client n'a pas à installer Git pour recevoir des fichiers. L'archive est exactement ce que H4 remplace en bloc. |
| `dist/` et `node_modules/` livrés ? | Non : le script les construit (`npm install`, `npm run build`), donc accès npm requis à l'installation. Pour un poste sans accès, livrer une archive « construite » (avec `dist/` et `node_modules/`) et passer `-SansBuild`. | Le prérequis Node.js est proposé à l'installation par l'étape 1 du script (oui explicite) ; npm vient avec. L'archive construite est le plan B, prévu par l'option, pas par un second script. |

## 5. Prérequis du poste

- Node.js ≥ 18 et npm. **Claude Code ne les apporte pas** : l'app desktop
  embarque son propre runtime sans rien mettre sur le PATH (constaté le
  2026-09-19 sur un poste neuf). Si l'un des deux manque, l'étape 1 du script
  affiche la commande du gestionnaire de paquets du poste (`winget` sous
  Windows et Git Bash, `brew` sous macOS, `apt-get` ou `dnf` sous Linux),
  demande un `o` explicite, installe, recharge le PATH de la console et
  revérifie. Sans gestionnaire reconnu, ou en entrée non interactive, le
  script s'arrête avec la commande et l'URL nodejs.org : jamais d'installation
  silencieuse, jamais de `curl | bash`.
- Claude Code installé (app desktop ou CLI ; son absence du PATH n'empêche
  rien, l'enregistrement écrit `.mcp.json` dans le dossier de lancement).
- Accès en lecture au dossier `produit/`, en écriture à `installation/`
  (local ou partage ; l'authentification est celle du partage).
- Mode de permission de Claude Code : par défaut, confirmation avant chaque
  commande. Ce n'est pas vérifiable par le script.

## 6. Ce que le POC respecte déjà pour le multi-utilisateur

Aucun chemin absolu dans le code ; deux racines par variables
d'environnement ; rien d'écrit hors de `installation/` ; un fichier par
ticket, création exclusive ; index reconstruit ; identifiants sans
compteur. Le passage au partage est un changement de valeur de
`SUPPORT_IT_INSTALLATION`, testé à la porte 2 de `validation.md`.

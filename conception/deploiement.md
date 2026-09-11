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
```

Quatre natures, quatre dossiers : un rédacteur de skills n'ouvre que
`contenu/`, un développeur que `serveur/`. Le contexte de `X` se résout
toujours en `contenu/<X>/contexte.exemple.md` (`general` ou `domaines/<id>`).

`installation/` n'est jamais livré. `plan.md`, `conception/`,
`architecture/` non plus.

## 2. Installation (H3, appliqué)

Une commande, à la racine de `produit/` :

```powershell
.\install.ps1 [-Installation <chemin>] [-SansClaude] [-SansBuild] [-SansTest]
```
```bash
./install.sh [--installation <chemin>] [--sans-claude] [--sans-build] [--sans-test]
```

Six étapes identiques dans les deux scripts, tout le travail délégué à
`node dist/cli.js` (une implémentation, `outillage.md`) : prérequis, build,
validation du produit **puis test de fumée** (refus d'installer une
livraison invalide ou un serveur qui ne répond pas sur ce poste — `tester`,
ajouté le 2026-09-11, `-SansTest` pour le sauter), `init` (initialiser,
rejoindre ou mettre à jour — même commande, idempotente, qui note la
version dans `installation/VERSION` et annonce le mode), `enregistrer` +
`entree` (Claude Code), `etat`. Le script se termine par trois rappels :
remplir le contexte (à la main ou par `/support remplis le contexte`),
redémarrer Claude Code et vérifier `/mcp`, garder le mode de permission par
défaut.

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
| `dist/` et `node_modules/` livrés ? | Non : le script les construit (`npm install`, `npm run build`), donc accès npm requis à l'installation. Pour un poste sans accès, livrer une archive « construite » (avec `dist/` et `node_modules/`) et passer `-SansBuild`. | Le prérequis Node.js est déjà là (Claude Code) ; npm aussi. L'archive construite est le plan B, prévu par l'option, pas par un second script. |

## 5. Prérequis du poste

- Claude Code installé (c'est lui qui apporte Node.js ≥ 18 et npm).
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

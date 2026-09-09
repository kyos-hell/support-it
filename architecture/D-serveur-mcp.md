# Architecture — D, serveur MCP

> Plan d'architecture technique du seul composant logiciel du produit. Écrit
> à partir de `conception/contrat-mcp.md`, `manifeste.md`, `outillage.md`,
> une fois ces conceptions stabilisées (règle de `plan.md` §2.1). Les autres
> périmètres n'ont pas de code : pour la bêta, leur document de conception
> est leur référence d'architecture (décision notée dans `plan.md` §2.1).

## 1. Décisions retenues et leur raison

| Décision | Raison |
| --- | --- |
| Node.js ≥ 18, TypeScript, `@modelcontextprotocol/sdk` 1.x, transport stdio | Claude Code apporte Node.js ; le SDK officiel gère le protocole ; stdio = un processus par session Claude Code, lancé et arrêté par lui, aucun démon. |
| Modules ES, `tsc` seul, aucun bundler | Le moins d'outillage possible pour un composant qu'un technicien doit pouvoir construire avec `npm install && npm run build`. |
| Dépendances : `yaml`, `zod` (exigée par le SDK) | `yaml` pour les en-têtes et le manifeste ; rien d'autre. |
| Réponses en texte markdown | C'est ce que le modèle lit ; c'est ce qu'un humain relit dans un ticket. Pas de `structuredContent`. |
| Aucune exception non capturée vers le client MCP sur une erreur d'usage | Une erreur d'usage est un texte `isError` que le modèle sait lire et corriger ; une exception est réservée aux défauts du serveur. |
| Écritures en création exclusive (`flag: "wx"`) | Le serveur ne peut ni écraser ni modifier : c'est structurel, pas une discipline (H1). |

## 2. Structure

```
produit/serveur/
  package.json · tsconfig.json
  src/
    config.ts       racines, chemins, création des dossiers de l'installation
    markdown.ts     en-tête YAML, sections « ## id — titre », commentaires, date de mise à jour
    manifeste.ts    lecture + rendu markdown + vocabulaire des tags
    contexte.ts     get_context, update_context, définition de « vide », état de remplissage
    skills.ts       load_skill (domaines, triage, cloture), en-tête des skills
    tickets.ts      save_ticket : identifiant, rendu, journal
    kb.ts           search_kb, publish_kb
    validation.ts   contrôles de livraison
    index.ts        le serveur : six outils enregistrés, stdio
    cli.ts          valider · init · etat · enregistrer · entree · chemins
    test/smoke.ts   test de fumée bout en bout
```

Dépendances entre modules, dans un seul sens :
`index`/`cli` → `skills`/`tickets`/`kb`/`validation` → `contexte`/`manifeste` → `markdown`/`config`.

## 3. Formats

**En-tête d'un skill** (lu par `skills.lireEnteteSkill`) : `domaine`,
`version`, `contexte.requis: string[]`, `contexte.selon-cas: {clé: string[]}`.
Toute autre clé est ignorée.

**Section de contexte** (`markdown.sections`) : titre `^## ([a-z0-9-]+)\s+[—–-]\s+(.+)$`.
Le tiret cadratin est la convention ; le demi-cadratin et le tiret simple
sont acceptés à la lecture pour ne pas punir un éditeur qui les remplace.
Un `## ` qui ne suit pas la forme est ignoré à l'usage et signalé par
`valider`. Contenu = lignes jusqu'au titre suivant, commentaires HTML
retirés, ligne « Dernière mise à jour : X » extraite.

**« Vide »** (`contexte.sectionsRemplies`) : contenu normalisé (espaces
réduits) vide, ou égal au contenu normalisé de la même section du gabarit
livré. Un fichier de contexte absent rend toutes ses sections `vide` avec
une note.

**Ticket** (`tickets.rendreTicket`) : en-tête YAML (`yaml.stringify`) puis
sections `symptome-initial`, `signaux`, `conclusion`, `conclusion-humaine`,
`plan-action`, `questions`, `mises-a-jour-contexte`, chacune au format
`## id — titre`. Relu par `lireTicket` avec `markdown.sections`.

**Journal** : `<id>-qNN.md`, en-tête `ticket`, `date`, `nature`, `domaines`,
`section_candidate`, sections `question` et `reponse`.

**Identifiant** : `AAAAMMJJ-HHMMSS-<utilisateur>-<poste>`, utilisateur et
poste réduits à `[a-z0-9]{1,24}`, heure locale du poste (lisible par le
technicien ; l'ISO UTC est dans l'en-tête).

**Enregistrement Claude Code** (`cli enregistrer`) : `~/.claude.json`,
clé `mcpServers["support-it"] = {type: "stdio", command: "node", args: [<dist>/index.js], env: {SUPPORT_IT_PRODUIT, SUPPORT_IT_INSTALLATION}}`,
sauvegarde préalable en `.support-it.bak`.

## 4. Comportement nominal

Un ticket type : `load_skill(triage)` → `load_skill([reseau], incident)` →
0 à n `get_context` → `search_kb` → `load_skill(cloture)` → `save_ticket` →
éventuellement `publish_kb`. Chaque appel est sans état : le serveur ne
garde rien entre deux appels, tout est sur disque ou dans la conversation.

## 5. Cas limites et dégradés

| Situation | Comportement |
| --- | --- |
| `installation/` absent | Lectures : sections `vide` avec note ; écritures : dossiers créés à la volée (`assurerInstallation`). |
| Partage injoignable | Lectures : mêmes sections `vide` (le skill pose ses questions, mode dégradé prévu par H1) ; écritures : erreur d'E/S renvoyée en texte, le ticket reste dans la conversation, à réenregistrer. |
| Deux techniciens, même seconde, même poste | Suffixe `-2`, `-3` ; deux postes ont deux noms : jamais de collision. |
| Titre de section modifié par le client | Section `inconnue` pour les skills qui la déclarent ; `etat` la montre « en plus » et l'attendue « manquante ». |
| Gabarit modifié dans une version ultérieure | La comparaison « identique au gabarit » se fait contre le gabarit **livré** courant : une section laissée aux placeholders d'une ancienne version qui différerait du nouveau gabarit passerait pour remplie. Accepté pour la bêta ; la note « contient encore des placeholders » couvre le cas. |
| Skill dont l'en-tête déclare une section absente du gabarit | `valider` le refuse à la livraison ; à l'usage, `get_context` répondrait `inconnue`. |
| Manifeste illisible | `load_skill` échoue avec le message d'analyse YAML : défaut de livraison, `valider` l'aurait vu. |
| Tags vides ou en majuscules | Normalisés (minuscules, sans blancs, dédoublonnés) à l'écriture et à la recherche. |
| `update_context` sur un fichier absent | Créé depuis le gabarit, puis la section est écrite ; pas de sauvegarde (rien à sauver). |
| `update_context` sur une section absente du fichier mais présente dans le gabarit | Ajoutée en fin de fichier avec le titre et les consignes du gabarit (migration H4). |
| `update_context` sur une section inconnue des deux | Refus : on n'invente pas de section, on l'ajoute au gabarit d'abord. |
| Deux `update_context` sur le même fichier au même instant (partage) | Non protégé dans la bêta mono-poste : le dernier écrit gagne, le premier est dans `historique/`. Architecture cible en §8 (concurrence optimiste par empreinte), à implémenter à la porte 2. |
| Contenu fourni avec commentaires, date ou titre `##` | Commentaires et date retirés (le serveur remet les siens) ; titre refusé. |

## 6. Ce que le composant ne fait pas

Voir `contrat-mcp.md` §7. Pas de verrou sur les fichiers de contexte, seule
matière mutable (voir cas limites). En plus : pas de journalisation des appels (le
transcript de Claude Code en tient lieu pour la bêta), pas de vérification
d'identité (celle du partage), pas de limite de taille.

## 7. Points de contrôle

- `npm run build` sans erreur ; `node dist/cli.js valider` code 0 ;
  `npm test` « smoke : OK » — les trois avant chaque livraison.
- `node dist/cli.js chemins` sur le poste installé : les deux racines
  attendues.
- Dans Claude Code, `/mcp` liste `support-it` avec sa version, six outils.
- Après un premier ticket : un fichier dans `tickets/`, autant de fichiers
  dans `journal/` que de questions, rien ailleurs.

## 8. Évolution multi-utilisateur — architecture prévue, non implémentée

La bêta tourne sur un seul poste : aucune écriture concurrente n'est
possible. Le seul fichier mutable de l'installation est le contexte
(`update_context`), et c'est le seul point à traiter au passage sur un
partage. Décision de conception prise le 2026-09-09, à implémenter à la
porte 2 :

**Concurrence optimiste par empreinte, pas de verrou.**

1. `get_context` renvoie, pour chaque fichier de contexte lu, une
   **empreinte** (hachage du contenu du fichier, ou `mtime` + taille).
2. `update_context` accepte un paramètre optionnel `empreinte`. S'il est
   fourni et qu'il ne correspond plus au fichier sur disque, le serveur
   **refuse** : « le fichier a changé depuis ta lecture » — avec la section
   telle qu'elle est maintenant, pour que le skill la remontre au technicien
   et redemande un oui. Sans le paramètre (bêta mono-poste), comportement
   actuel.
3. Le skill `remplissage` et `cloture.md` passent toujours l'empreinte reçue
   du dernier `get_context` sur ce fichier.

**Pourquoi pas un verrou.** Un fichier `.lock` sur un partage SMB finit
orphelin (poste éteint, session Claude Code fermée) et bloque tout le monde
jusqu'à ce qu'un humain le supprime ; il faudrait un délai d'expiration,
donc une horloge partagée, donc une source d'erreurs. L'optimisme ne bloque
jamais : au pire, un technicien revalide une section après l'avoir relue,
ce qui est exactement la validation humaine voulue. Les écritures de
contexte sont rares (un référent, quelques fois par semaine) : le cas de
conflit sera exceptionnel, et `historique/` garde de toute façon la
version écrasée.

**Ce qui ne change pas.** La signature des six appels (un paramètre
optionnel en plus), le format des fichiers, les scripts. Le contrat reste
identique en local et sur le partage (H1). Test à écrire : deux
`update_context` sur le même fichier avec la même empreinte, le second
refusé (porte 2, `validation.md` §4).

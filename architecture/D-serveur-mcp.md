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
    ids.ts          identifiants, horodatages (UTC), clé de normalisation, utilisateur et poste
    session.ts      l'état de session en mémoire (décision 3) : brouillon courant, skills chargés, sections servies, cas lus — sans dépendance
    encours.ts      save_progress, resume_ticket : brouillon d'un ticket en cours, fusion, liste, reprise, étape calculée
    tickets.ts      save_ticket : identifiant, rendu, journal, lien avec le brouillon
    kb.ts           search_kb, publish_kb
    validation.ts   contrôles de livraison
    index.ts        le serveur : huit outils enregistrés, stdio
    cli.ts          valider · tester · init · etat · enregistrer · entree · chemins
    test/smoke.ts   test de fumée bout en bout
```

Dépendances entre modules, dans un seul sens :
`index`/`cli` → `skills`/`tickets`/`kb`/`validation` → `encours` → `contexte`/`manifeste` → `markdown`/`config`/`ids`/`session`.
`session.ts` est une feuille : il ne connaît ni les fichiers ni les autres modules ; `index.ts` en tient l'instance et la passe à `sauverProgression` et `enregistrerTicket`.

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

**Brouillon** (`encours.rendre`) : en-tête YAML = l'objet `Brouillon` entier
(source de vérité, relu par `lireFichier` pour fusionner), corps réduit à
`etat` et `passations` (le corps complet doublait le fichier : 29 Ko sur le
premier brouillon réel). `encours.rendreComplet` rend tout en clair pour
`resume_ticket`. Fusion : scalaires remplacés s'ils sont fournis, listes
ajoutées sans doublon (clé : le texte, ou la question), référence changée
seulement si elle diffère hors casse. **Limites par entrée** (`LIMITES`,
vérifiées avant toute écriture et dans le schéma zod) : signal 160,
vérification, action, note 240, question et réponse 300, prochaine étape
200 caractères ; refus explicite citant la règle du champ. Écriture atomique
(`.tmp-<pid>` puis renommage).

**Journal** : `journal/<id>.md`, **un par ticket**, écrit une fois à la
clôture, absent s'il n'y a pas eu de question. En-tête `ticket`, `date`,
`reference`, `nature`, `domaines`, `questions` (nombre),
`sections_candidates` (liste dédoublonnée) ; corps : une section
`## qNN — Question N` par question, avec **Q**, **R (contenu candidat)** et
la section candidate. Jusqu'au 2026-09-11 : un fichier `<id>-qNN.md` par
question ; les fichiers existants ne sont pas migrés.

**Identifiant** : `AAAAMMJJ-HHMMSS-<utilisateur>-<poste>`, utilisateur et
poste réduits à `[a-z0-9]{1,24}`, heure locale du poste (lisible par le
technicien ; l'ISO UTC est dans l'en-tête).

**Enregistrement Claude Code** (`cli enregistrer`) : `~/.claude.json`,
clé `mcpServers["support-it"] = {type: "stdio", command: "node", args: [<dist>/index.js], env: {SUPPORT_IT_PRODUIT, SUPPORT_IT_INSTALLATION}}`,
sauvegarde préalable en `.support-it.bak`.

## 4. Comportement nominal

Un ticket type : `load_skill(triage)` → `save_progress` (création) →
`load_skill([reseau], incident)` → 0 à n `get_context` → `save_progress` →
`search_kb` → `save_progress` (plan, puis actions une par une) →
`load_skill(cloture)` → `save_ticket` → éventuellement `publish_kb`.

**Depuis le 2026-09-18 le serveur a un état de session** (décision 3,
`session.ts`) : un processus par session Claude Code (stdio), donc il se
souvient du brouillon courant, des skills chargés, des sections servies,
des cas lus, d'une recherche faite. Cet état est recopié dans le brouillon
à chaque `save_progress` (champs `skills_charges`, `sections_servies`,
`cas_lus`, `recherche_faite`, que le modèle ne fournit jamais), reconstruit
depuis le brouillon par `resume_ticket`, vidé par `save_ticket`. Le disque
reste la vérité ; la mémoire n'est qu'un garde-fou qui rend un appel hors
séquence impossible (voir `contrat-mcp.md` §6). Sans brouillon courant, le
serveur sert comme avant, sans refus.

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
| `save_progress` sans id ni brouillon de même référence, sans symptôme | Refus : le symptôme initial tel qu'exprimé est la seule chose qu'on ne peut pas reconstituer plus tard. |
| `save_progress` avec un id inconnu | Refus, avec le rappel que `resume_ticket()` liste les brouillons. |
| Deux `save_progress` sur le même brouillon depuis deux postes | Le second écrase le premier (fusion sur l'état lu au moment de l'appel) et enregistre une passation. Un ticket ouvert appartient à un technicien à la fois ; l'avertissement « dernier point il y a n min » de `resume_ticket` est la garde. Même plan que le contexte pour la porte 2 (§8). |
| Brouillon abandonné | Reste dans `en-cours/` ; `etat` et `resume_ticket()` le signalent au-delà de 30 jours. Clôture manuelle par `save_ticket(id, statut non-resolu)`. |
| `save_ticket(id)` sur un brouillon déjà clôturé | Refus : le ticket final existe. |
| Session Claude Code fermée entre deux points d'étape | Ce qui a été dit depuis le dernier `save_progress` est perdu ; c'est la raison de la règle « un point d'étape par acquis ». |
| Processus serveur relancé en cours de ticket (`/clear`, `--resume`, reconnexion après `CONNECT_TIMEOUT`) | L'état mémoire est vide : aucun refus ne s'applique tant que `resume_ticket` ou `save_progress(id)` n'a pas reconstruit le courant depuis le brouillon. Ce qui a été chargé entre le dernier `save_progress` et la coupure n'est pas dans le brouillon : une escalade faite juste avant la coupure peut manquer. Le smoke rejoue la reprise sur un second processus (client C). **À observer pendant les dix tickets de test** : si Claude Code relance le processus plus souvent que « une session = un processus », la reconstruction devient la voie principale et `triage.md` devra dire « `resume_ticket` à chaque reprise de conversation ». |
| `save_ticket` alors qu'un autre brouillon que le courant est visé | Refus : deux tickets en parallèle dans une session n'est pas un usage ; `resume_ticket` bascule le courant. |
| `save_progress` sans id alors qu'un brouillon est courant, symptôme et référence nouveaux | Un nouveau brouillon est créé et devient le courant ; l'état de session repart de zéro pour lui. L'ancien reste sur disque avec son état. |
| `get_context` sur une section réécrite par `update_context` dans la session | Elle redevient servable : la mise à jour l'a retirée des « déjà servies ». |

## 6. Ce que le composant ne fait pas

Voir `contrat-mcp.md` §7. Pas de verrou sur les fichiers de contexte, seule
matière mutable (voir cas limites). En plus : pas de journalisation des appels (le
transcript de Claude Code en tient lieu pour la bêta), pas de vérification
d'identité (celle du partage), pas de limite de taille.

## 7. Points de contrôle

- `npm run build` sans erreur ; `node dist/cli.js valider` code 0 ;
  `npm test` « smoke : OK » — les trois avant chaque livraison. Depuis la
  bêta v2 (2026-09-11), le smoke charge les six domaines en incident et en
  demande, et rejoue le cas « domaine décrit, hors bêta » sur une copie
  temporaire de `contenu/` + `VERSION` avec un domaine synthétique
  `exemple-decrit` — le produit livré n'en a plus.
- `node dist/cli.js chemins` sur le poste installé : les deux racines
  attendues.
- Dans Claude Code, `/mcp` liste `support-it` avec sa version, huit outils.
- Après un premier ticket : un fichier dans `tickets/`, autant de fichiers
  dans `journal/` que de questions, rien ailleurs.

## 8. Évolution multi-utilisateur — architecture prévue, non implémentée

La bêta tourne sur un seul poste : aucune écriture concurrente n'est
possible. Deux matières sont mutables dans l'installation : le contexte
(`update_context`) et les brouillons en cours (`save_progress`, ajoutés le
2026-09-10). Le même mécanisme couvre les deux au passage sur un partage :
`resume_ticket` renverra une empreinte du brouillon, `save_progress` la
recevra et refusera si le brouillon a changé depuis — ce qui, pour un
ticket, signifie qu'un collègue y travaille en même temps. Décision de conception prise le 2026-09-09, à implémenter à la
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

**Ce qui ne change pas.** La signature des huit appels (un paramètre
optionnel en plus), le format des fichiers, les scripts. Le contrat reste
identique en local et sur le partage (H1). Test à écrire : deux
`update_context` sur le même fichier avec la même empreinte, le second
refusé (porte 2, `validation.md` §4).

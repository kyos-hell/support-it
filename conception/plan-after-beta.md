# Après la bêta — décisions et plan

> Écrit à partir de `retours-beta.md` (état au 2026-09-14). Première partie :
> les décisions prises une à une, en discussion, avant tout code. Deuxième
> partie : le plan de corrections, d'ajouts et d'améliorations, rédigé une
> fois toutes les décisions prises. Rien de ce fichier n'est implémenté tant
> que la section 2 n'existe pas.

---

## 1. Décisions

Ordre de discussion. Une décision n'est écrite ici qu'une fois prise.

| # | Sujet | État |
| --- | --- | --- |
| 1 | Les tags | prise, amendée le 2026-09-17 |
| 2 | Les signaux | prise |
| 3 | Le serveur sait à quel ticket un appel appartient | prise |
| 4 | Lire un cas de la base : neuvième appel `read_kb` | prise |
| 5 | L'hôte : `settings.json` livré par `install`, `Bash` interdit, pas de hooks | prise |
| 6 | L'ordre des chantiers : corrections sans contrat, puis domaines joués + décisions 3-4-5, puis signaux et tags | prise, amendée le 2026-09-18 (section 2.0 : tout en une passe, puis dix tickets) |
| 7 | Ce qu'on ne fait pas dans ce cycle | prise |
| 8 | **Ajout** — skill `audit` des tickets : jeu de test du triage, brouillons anciens, tickets résolus non publiés, mesures T-P7 | prise |
| 9 | **Ajout** — validité du contexte : péremption, file des candidats, contradictions en ticket (boucle de fraîcheur, `validation.md` §6) | prise |
| 10 | **Ajout** — durcir les skills : une question à la fois, une commande à la fois, attendre le retour | prise |

### Décision 1 — Les tags (2026-09-14)

**Problème.** Les tags sont libres (`save_ticket.tags`, `publish_kb.tags`).
Sur trois entrées de base réelles : 74 tags distincts, 28 à 32 par ticket,
des coquilles (`identite-manageee`), des tags qui matchent tout (`azure`,
`powershell`). Un tag faux rend le cas introuvable pour toujours ; la règle
« trois occurrences → manifeste » n'est mesurée nulle part et
`vocabulaire()` de `manifeste.ts` n'est appelé par personne. C'est un choix
du modèle sur la mécanique (principe du 2026-09-14, `retours-beta.md`).

**Ce qui est décidé.**

1. **Une bibliothèque de tags, à deux étages.** Un étage **produit**, fourni
   par défaut dans `manifeste.yaml` (les `tags:` par domaine existent déjà :
   `vpn`, `dns`, `entra-connect`, `gpo`…). Un étage **client**, dans un
   fichier de l'installation (`installation/tags.yaml`, à créer par `init`),
   pour les tags propres à l'entreprise — application maison, site, outil
   interne. Aucune donnée d'entreprise ne remonte dans `produit/`.

2. **Les appels qui écrivent unifient les deux listes et refusent le reste.**
   `save_ticket` et `publish_kb` construisent la liste produit ∪ client au
   moment de l'appel et refusent tout tag qui n'y figure pas, avec une
   erreur `isError` qui renvoie la liste. Aucun tag libre n'entre en base.
   Les tags **dérivés** restent automatiques et hors de la main du modèle :
   nature, domaines validés, escalades, référence.

3. **Un plafond, toujours, par pertinence.** Le serveur borne le nombre de
   tags cochés par ticket (valeur à fixer dans le plan ; ordre de grandeur :
   cinq). Refus au-delà, avec le message « garder ceux qui distinguent ce
   cas ». Les tags dérivés ne comptent pas dans le plafond.

4. **La liste ne grandit que par l'humain, jamais par l'IA.** Pas de champ
   de proposition, pas de journalisation de tags candidats. Si l'équipe
   constate qu'un tag manque, le référent l'ajoute dans `tags.yaml` ; s'il
   est générique, il monte dans `manifeste.yaml` à la version suivante. La
   règle « trois occurrences » devient un jugement du référent, pas un
   compteur.

**Conséquences à reporter dans le plan.**

- `search_kb` cherche avec la même liste : un tag inconnu à la recherche est
  signalé (avec les tags proches), pas ignoré en silence.
- Avec un vocabulaire borné, le score par rareté (D2) devient fiable :
  recherche et base parlent la même langue.
- Le modèle doit voir la liste **avant** d'appeler `save_ticket`, pas
  seulement dans le refus. Point à préciser dans le plan : servie par
  `load_skill(["cloture"])` (liste complète, ou filtrée sur les domaines du
  brouillon si le serveur les connaît — voir décision 3), ou par un rendu
  dans la réponse de `save_progress`.
- `init` crée `installation/tags.yaml` vide avec sa consigne ; `verifier`
  (C3) contrôle qu'il est lisible et sans doublon avec le produit.
- Les entrées de base existantes (3) portent des tags libres : à nettoyer à
  la main ou à migrer par une commande CLI — à trancher dans le plan.
- Mécanisme unifié avec la décision 2 (signaux) : dans les deux cas le
  modèle **coche dans une liste fermée**, il ne rédige pas.

**Ce qui est écarté.** Trois tags libres en kebab-case (proposition
initiale) : un tag libre reste un choix du modèle sur la mécanique, même
borné. Un champ `tags_proposes` journalisé pour le référent : la liste ne
grandit pas par l'IA. Un appel MCP dédié `list_tags` : un aller-retour de
plus par ticket et rien ne garantit qu'il soit appelé avant `save_ticket` —
la liste est servie par les appels existants.

**Amendement (2026-09-17, issu de la décision 2).** Chaque tag est
**rattaché à un domaine**. Le produit le fait déjà (`manifeste.yaml` liste
les tags sous chaque domaine) ; `installation/tags.yaml` suit la même forme,
avec une rubrique `general` pour les tags transverses (plateformes, outils :
`azure`, `powershell`). À la clôture, le serveur ne propose que les tags des
**domaines validés du brouillon** plus les transverses, et refuse un tag
d'un autre domaine. Le modèle choisit parmi une quinzaine de tags
pertinents, pas parmi toute la bibliothèque. La chaîne complète :

```
signaux cochés (modèle) → domaines calculés (serveur) → validés (technicien)
→ tags candidats filtrés (serveur) → tags cochés ≤ N (modèle)
```

Deux cochages restent au modèle, le reste est au serveur ou à l'humain.
Conséquence technique : le schéma de `save_ticket` est fixé au démarrage du
serveur, il contient donc toute la bibliothèque ; le filtrage par domaine
est un **contrôle du serveur** à l'appel, qui renvoie la liste filtrée dans
le message de refus. Le mécanisme d'enum est le même que pour les signaux.

Écarté : dériver *les* tags des signaux cochés. Un signal décrit le
symptôme au triage, un tag décrit la cause après diagnostic (MDP hybride :
signal `tous-utilisateurs-du-service`, tags `entra-connect`,
`password-writeback`). Avec quatre signaux par domaine, tous les tickets
d'un domaine auraient les mêmes tags — le score plat de D2, en pire. Les
signaux décident *parmi quoi* on tague, pas *quoi*.

### Décision 2 — Les signaux (2026-09-17)

**Problème.** Le manifeste déclare 24 signaux discriminants (4 par domaine)
en phrases, sans identifiant. Le modèle les lit au triage, puis **rédige**
de mémoire le champ `signaux` de `save_progress` et `save_ticket` en texte
libre ; le serveur ne vérifie que la longueur. Résultat sur les tickets
réels : un vrai signal de triage pour cinq constats de diagnostic
(« erreurs 31034 listeners Service Bus offline »), des reformulations, et
deux listes — celle du manifeste, celle du ticket — qui ne se parlent
jamais. Or le champ n'a qu'un usage : tracer sur quoi le triage s'est
appuyé, pour former le jeu de test du triage (`plan.md` A : « un ticket mal
classé désigne un signal à corriger dans la taxonomie »). Un signal qui
n'est pas celui du manifeste ne sert à rien, à personne, à aucun moment du
flux. C'est un choix du modèle sur la mécanique.

**Ce qui est décidé.**

1. **Chaque signal du manifeste reçoit un identifiant** kebab-case, unique
   dans tout le manifeste ; le libellé reste la phrase d'aujourd'hui :
   ```yaml
   signaux:
     - id: depend-du-lieu
       libelle: dépend du lieu ou du lien (marche au bureau, pas en VPN ; site A oui, site B non)
   ```
   Le serveur rend l'identifiant avec le libellé dans la table du triage.

2. **Bibliothèque produit seulement.** Pas d'étage client : les signaux
   *définissent* les domaines, ils sont la taxonomie. Un client n'en ajoute
   pas.

3. **Limite max par domaine** dans le manifeste (six ; quatre aujourd'hui),
   contrôlée par `valider`. Un signal sert à choisir entre deux domaines ;
   trente signaux qui pointent tous vers le même ne sont plus des signaux
   mais un catalogue de symptômes, et le prompt de triage grossit d'autant.

4. **Le modèle coche, il ne rédige plus.** `save_progress.signaux` et
   `save_ticket.signaux` prennent une liste de `{ id, preuve }` : `id` est
   un `z.enum` des identifiants construit depuis le manifeste au démarrage
   du serveur — une chaîne libre est rejetée par le schéma avant notre
   code ; `preuve` est l'extrait du ticket qui montre le signal, ≤ 160
   caractères, libre. La preuve est du diagnostic : elle dit *pourquoi* la
   case a été cochée, ce qui permet, quand le triage se trompe, de savoir si
   c'est le manifeste ou la lecture qui a fauté.

5. **Le serveur écrit le ticket** : identifiant → libellé du manifeste, puis
   la preuve. Le modèle ne formule plus la section « Signaux retenus ».

6. **Les constats de diagnostic vont dans `verifications`**, dont la
   description est élargie : « un constat vérifié — commande → résultat, ou
   lecture d'un portail ou d'un journal ». Avec un `signaux` fermé, le
   fourre-tout disparaît par construction.

7. **`domaines_proposes` est calculé par le serveur**, en douceur : depuis
   les signaux cochés, le serveur classe les domaines (nombre de signaux)
   et renvoie ce classement dans la réponse de `save_progress` ; il refuse
   un domaine proposé qui n'a aucun signal coché. Le modèle continue de
   juger **net ou ambigu** — l'irréductible — et le technicien valide. Ça
   n'impose pas encore l'ordre `save_progress` avant `load_skill`, mais ça
   le rend naturel : c'est là que le classement arrive.

8. **Les signaux ne deviennent pas des tags** (voir l'amendement de la
   décision 1).

**Conséquences à reporter dans le plan.**

- `manifeste.yaml` : identifiants sur les 24 signaux, `max_signaux` ;
  `valider` contrôle l'unicité, la forme kebab-case et la limite.
- `manifeste.ts` : lecture des `{ id, libelle }`, rendu avec identifiant,
  fonction qui classe les domaines depuis une liste d'identifiants.
- `index.ts` : schéma de `signaux` construit depuis le manifeste au
  démarrage (même mécanisme pour `domaines_valides`, `escalades` — A3 — et
  pour les tags — décision 1). Un manifeste modifié est vu au redémarrage
  du serveur, acceptable : une session = un ticket.
- `encours.ts`, `tickets.ts` : `signaux` typé `{ id, preuve }[]` ;
  dédoublonnage sur `id` ; rendu par libellé.
- `triage.md` : « coche les signaux avec l'extrait qui les montre ; les
  constats vont dans verifications » ; `cloture.md` ; `contrat-mcp.md` ;
  le smoke.
- Les deux tickets et deux brouillons existants gardent leur format : le
  serveur lit une liste de chaînes comme l'ancien format, sans migration.
- Une **passe sur le manifeste après les tests T-A1** sur les quatre
  nouveaux domaines — on ne retouche pas une taxonomie sans tickets réels.
- Le jeu de test du triage devient constructible : pour chaque ticket,
  « signaux cochés → domaines calculés → domaines validés ». À prévoir dans
  le plan comme commande CLI ou comme mesure T-P7.

**Ce qui est écarté.** Des identifiants seuls, sans preuve : le ticket
dirait « signal `depend-du-lieu` » sans dire quelle phrase l'a justifié, et
un repreneur n'y lirait rien. Un étage client pour les signaux : ce serait
laisser un client redéfinir les domaines. Des tags portés par les signaux :
voir l'amendement de la décision 1.

### Décision 3 — Le serveur sait à quel ticket un appel appartient (2026-09-17)

**Problème.** Seuls `save_progress` et `save_ticket` portent l'`id` du
brouillon ; `load_skill`, `get_context`, `search_kb` arrivent sans rien. Le
serveur ne sait ni pour quel ticket il sert, ni à quelle étape. Tout l'ordre
du flux est tenu par le prompt : une escalade n'existe que si le modèle la
met dans `escalades` ; `save_ticket` sans `load_skill(["cloture"])` passe ;
`search_kb` avant tout diagnostic, ou jamais, passe ; `get_context` recharge
ce que `load_skill` a déjà servi ; l'étape du brouillon reste à `triage`
pendant les actions (T-P9). Et les décisions 1 et 2 supposent que le serveur
connaît les domaines validés au moment de la clôture.

**Ce qui est décidé.**

1. **Un état de session en mémoire dans le serveur** (voie B). Le transport
   stdio donne un processus serveur par session Claude Code, vivant du
   début à la fin. Le serveur garde : le **brouillon courant** (posé par
   `save_progress` ou `resume_ticket`, effacé par `save_ticket`), les
   **skills chargés** (triage, domaines dans l'ordre, cloture), les
   **sections de contexte servies**. Chaque appel se rapporte au brouillon
   courant sans que le modèle le dise. Aucune signature ne change ; aucun
   choix du modèle n'est ajouté.

2. **L'état est recopié dans le brouillon** à chaque `save_progress`, par le
   serveur, dans des champs que le modèle ne renseigne pas (`skills_charges`,
   `sections_servies`). Au redémarrage, `resume_ticket` ou
   `save_progress(id)` reconstruit l'état depuis le brouillon. Le disque
   reste la vérité, la mémoire n'est qu'un garde-fou. Perdu : les appels
   entre le dernier `save_progress` et une coupure — marginal.

3. **Strict, dès la bêta.** Quand un brouillon est courant, le serveur
   **refuse** : `save_ticket` sans `cloture` chargé dans la session
   (« charge `cloture` d'abord ») ; `search_kb` avant tout `load_skill`
   d'un domaine (« le cas n'est pas instruit ») ; un tag hors des domaines
   validés (décision 1) ; un domaine proposé sans signal coché
   (décision 2). Les refus se testent pendant la bêta comme le reste : une
   ligne dans `retours-beta.md` par refus injustifié.

4. **Sans brouillon courant, le serveur sert comme aujourd'hui.** Le
   premier `load_skill(["triage"])`, `load_skill(["remplissage"])` hors
   ticket, un `search_kb` sur « tu as déjà vu ça ? », un `get_context` de
   vérification — aucun refus ne s'applique hors ticket. L'état ne devient
   une contrainte qu'une fois un ticket ouvert.

5. **Ce qui devient dérivé, et sort de la main du modèle :**
   - `escalades` : le deuxième `load_skill(domaine)` sur le même brouillon
     *est* une escalade. Le champ disparaît de `save_progress` et
     `save_ticket`.
   - `skill_charge` : c'est `domaines_valides` + `nature`, le serveur les a.
     Le champ disparaît.
   - `save_ticket.id` : le brouillon courant est rattaché automatiquement ;
     l'`id` reste accepté pour lever une ambiguïté, et refusé s'il désigne
     un autre brouillon que le courant (A4).
   - `get_context` sur une section déjà servie répond « déjà chargée »,
     sans le contenu.
   - **L'étape**, posée par le serveur : création du brouillon → `triage` ;
     `load_skill(domaine)` → `instruction` ; `search_kb` → `recherche` ;
     `save_progress` avec `plan_action` non vide → `plan` ; `save_progress`
     avec des `actions` → `actions` ; `save_ticket` → `cloture`. Le champ
     `etape` de `save_progress` se réduit à la seule valeur que le serveur
     ne peut pas voir : **`pause`**, qui est un mot du technicien. L'étape
     ne peut plus contredire le contenu du brouillon ; T-P9 disparaît par
     construction.

**Conséquences à reporter dans le plan.**

- `index.ts` : un objet de session (`brouillonCourant`, `skillsCharges`,
  `sectionsServies`) mis à jour par les handlers ; `load_skill` et
  `get_context` le renseignent, `save_progress` le recopie, `save_ticket`
  le vide, `resume_ticket` le reconstruit.
- `encours.ts` : champs `skills_charges`, `sections_servies` dans le
  brouillon, écrits par le serveur ; `etape` calculée ; `etape` de l'entrée
  réduite à `pause?: true` ; `escalades` et `skill_charge` retirés de
  l'entrée (gardés en lecture pour les brouillons existants).
- `tickets.ts` : `escalades` dérivées de `skills_charges` ; rattachement
  au brouillon courant ; refus sans `cloture`.
- `kb.ts` / `index.ts` : `search_kb` refusé avant instruction quand un
  brouillon est courant.
- `contexte.ts` : réponse « déjà chargée ».
- `triage.md`, `cloture.md`, `contrat-mcp.md`, `D-serveur-mcp.md` §8, le
  smoke (qui devra jouer une séquence complète, pas des appels isolés).
- À vérifier à l'implémentation : le cycle de vie du processus serveur
  dans Claude Code (`/clear`, `--resume`, reconnexion après timeout — le
  serveur a eu un `CONNECT_TIMEOUT` le 2026-09-17). Si le processus est
  relancé plus souvent que prévu, le point 2 devient la voie principale et
  non la roue de secours.
- Le point ouvert « ordre `save_progress` / `load_skill` » se ferme : le
  classement des domaines arrive dans la réponse de `save_progress`, le
  brouillon se crée donc au triage, avant le premier `load_skill(domaine)`.
  `triage.md` le dit explicitement.

**Ce qui est écarté.** Un `id` optionnel sur les appels de lecture
(voie A) : c'est un choix du modèle sur la mécanique, il l'oubliera (T-P9,
A5) et le serveur ne peut pas le refuser puisque `load_skill(["triage"])`
arrive légitimement avant tout brouillon ; un mauvais `id` mélange deux
tickets (A4). Laisser l'ordre au prompt (voie C) : c'est le statu quo que
les tickets réels ont invalidé. Deux tickets menés en parallèle dans la
même session : pas un usage réel ; `resume_ticket` bascule le courant, ça
suffit. Le mode « noter sans refuser » : on refuse dès la bêta et on mesure
les refus injustifiés, plutôt que de mesurer des incohérences qu'on connaît
déjà.

### Décision 4 — Lire un cas de la base : `read_kb` (2026-09-17)

**Problème.** `search_kb` renvoie par cas la première ligne du symptôme et
de la conclusion. Une fois le bon cas repéré, le modèle n'a aucun appel
pour lire sa conclusion et son plan d'action ; il ne peut que deviner le
chemin `installation/kb/<id>.md` — interdit par « le modèle ne fabrique
jamais un chemin », et rendu impossible par la décision 5. La base sert à
savoir qu'un cas existe, pas à s'en servir. Et tant que le contenu ne peut
passer que par `search_kb`, son rendu ne peut pas être compacté (D2).

**Ce qui est décidé.**

1. **Un neuvième appel, `read_kb(ticket_id)`.** Renvoie, pour un cas
   **publié** (`installation/kb/` seulement, jamais `tickets/`) : la
   conclusion, le plan d'action, les signaux (identifiants et preuves,
   décision 2). Pas les questions posées — elles sont le journal du
   référent, pas la solution. Ordre de grandeur : 1–2 Ko, jamais le ticket
   entier.

2. **Borné par l'état de session** (décision 3) : quand un brouillon est
   courant, `read_kb` n'est servi qu'à l'étape recherche ou après ; le
   serveur note dans le brouillon quel cas a été lu — le lien « ce ticket
   s'est appuyé sur ce cas », qui n'existe nulle part aujourd'hui, et que
   l'audit (décision 8) mesurera.

3. **D2 vient avec.** `search_kb` devient une liste courte pour *choisir* :
   score pondéré par la rareté (chaque tag commun vaut 1 / nombre
   d'entrées qui le portent ; nature et domaines non comptés), rendu
   compact (tags communs à la recherche seulement + « et N autres »,
   symptôme et conclusion tronqués à ~160 caractères, ~300 caractères par
   cas), message « N cas partagent ces tags, 5 affichés — affiner » au lieu
   d'inviter à monter `limite`. `read_kb` donne le contenu pour *s'en
   servir*. Le paramètre `limite` disparaît : plafond fixé par le serveur.

**Conséquences à reporter dans le plan.**

- `kb.ts` : `lireCas(id)` ; score par rareté ; rendu compact.
- `index.ts` : neuvième outil ; `search_kb` sans `limite`.
- « Huit appels » est écrit dans une dizaine de fichiers (`plan.md`,
  `contrat-mcp.md`, `D-serveur-mcp.md`, `fin-de-projet.md`,
  `etat-d-avancement.md`, `triage.md`, le point d'entrée…) : à passer à
  neuf, en une fois.
- `triage.md` ou le skill de domaine : « après `search_kb`, lire le cas
  retenu avec `read_kb` avant de reprendre sa conclusion ».
- Le smoke : recherche → lecture → refus hors `kb/` → refus avant
  l'étape recherche.

**Ce qui est écarté.** Un paramètre `ticket_id` sur `search_kb` qui
changerait « chercher » en « lire » : un paramètre qui change ce que fait
la fonction est un choix du modèle sur la mécanique, et la description de
l'outil devient « cherche, sauf si… ». « Huit appels » comme invariant :
c'est un compte ; l'invariant est « aucune intelligence dans le serveur,
aucun chemin fabriqué par le modèle ».

### Décision 5 — L'hôte : ce que Claude Code ne peut plus faire (2026-09-17)

**Problème.** Claude Code a ses propres outils. Le modèle peut lire
`installation/kb/<id>.md` en devinant le chemin, écrire
`installation/contexte/reseau.md` avec `Edit` — sans `update_context`, sans
`historique/`, sans oui —, ou exécuter une commande. Le mode de permission
est la seule barrière, et le technicien peut le désactiver d'un clic.
L'invariant « rien n'est écrit dans `installation/` hors des appels » est
tenu par le prompt seul. Aucun appel MCP ne peut fermer ce trou : il est
du côté de l'hôte.

**Ce qui est décidé.**

1. **Un `.claude/settings.json` livré par `install`** dans le dossier
   d'où le technicien lance Claude Code, qui interdit les outils natifs là
   où un appel MCP existe :
   ```json
   "permissions": { "deny": [
     "Edit(installation/**)",
     "Write(installation/**)",
     "Read(installation/kb/**)",
     "Read(installation/en-cours/**)",
     "Bash"
   ] }
   ```
   Le serveur écrit, Claude Code ne peut plus contourner. `contexte/` et
   `tickets/` restent lisibles : `get_context` fait déjà le tri, et lire
   une archive n'a pas de dommage, juste un coût.

2. **`Bash` interdit entièrement.** « L'IA guide, le technicien exécute »
   est le principe du projet ; le modèle n'a aucune raison légitime
   d'exécuter une commande dans un ticket de support. Les commandes CLI
   (`etat`, `valider`, `audit`) sont pour le référent, dans son terminal ;
   si le modèle doit un jour lancer un audit, ce sera par
   `load_skill(["audit"])`, pas par `Bash`.

3. **Pas de hooks dans ce cycle.** Avec la décision 3, ce que les hooks
   auraient bloqué (`save_ticket` sans `cloture`, `search_kb` avant
   instruction) est côté serveur, plus finement. Ce qui leur resterait —
   forcer un `save_progress` avant de rendre la main, injecter le triage
   sans dépendre d'un appel — attend la porte 2, si les oublis persistent
   une fois l'étape dérivée.

**Conséquences à reporter dans le plan.**

- `install.ps1` / `install.sh` : déposer le fichier ; **fusionner**, jamais
  écraser, si le technicien en a déjà un ; annoncer ce qui est interdit.
- Le point d'entrée : le dossier de lancement est fixe (déjà supposé).
- `deploiement.md` : le fichier, son contenu, pourquoi.
- À vérifier à l'implémentation : la syntaxe exacte des motifs de chemin
  dans `permissions.deny` (relatifs au dossier de travail, ou absolus),
  et le comportement quand le refus tombe (le modèle reçoit-il un message
  qu'il peut lire, pour se rabattre sur l'appel MCP ?).
- Le smoke ne peut pas tester l'hôte : un test manuel de la porte 1
  (« demande au modèle d'éditer le contexte directement ; il doit être
  refusé et passer par `update_context` »).

**Ce qui est écarté.** `Bash` avec une exception pour le CLI : le CLI est
au référent. Laisser `Bash` au mode de permission : c'est le statu quo, et
un mode se désactive. Les hooks `PreToolUse` / `Stop` /
`UserPromptSubmit` : redondants avec l'état de session pour ce cycle.

### Décision 6 — L'ordre des chantiers (2026-09-17)

**Problème.** Trois chantiers de taille différente : **a**, les
corrections sans changement de contrat (une journée) ; **b**, le lot
déterminisme des décisions 1 à 5 (plusieurs jours, le contrat change) ;
**c**, jouer les quatre nouveaux domaines sur des tickets réels (le seul
« bloque » restant, non planifiable). Tout faire avant de jouer arrête la
bêta deux semaines et fige les signaux de domaines jamais éprouvés ; jouer
avant de corriger produit des tickets corrompus en silence.

**Ce qui est décidé.**

1. **D'abord a**, en entier : A1 (symptôme du brouillon prioritaire), A4
   (référence non écrasée), A6 (référence fabriquée refusée), A7 (UTC), A8
   (brouillons zombies), C1 (seuil en caractères), C2 (« vide » sans
   dépendre de la version du gabarit), E1 (dédoublonnage avant
   `max_domaines`), `resolu_par` null si omis, `publish_kb` refuse un
   ticket non `resolu`, `plan_action` du brouillon prioritaire. Aucune
   signature ne bouge, les fichiers existants restent valides. Après a,
   tout ce qui corrompt silencieusement est fermé : les tickets joués
   ensuite sont fiables sur ce qui compte pour la mesure.

2. **Puis c et une partie de b en parallèle.** Les tickets réels ne se
   commandent pas ; pendant qu'on joue T-A1, T-B5, T-B6 sur les quatre
   domaines, on implémente ce qui ne dépend pas des domaines joués :
   l'état de session (décision 3), `read_kb` et D2 (décision 4), le
   `settings.json` (décision 5).

3. **En dernier, les identifiants de signaux (décision 2) et le filtrage
   des tags (décision 1)**, après la passe sur le manifeste que les tickets
   de c auront nourrie. On ne fige pas en enum une taxonomie que deux
   domaines sur six ont éprouvée.

4. Les tickets joués pendant c portent des signaux et des tags libres.
   **On ne les migre pas** : trois ou quatre tickets, à lire à la main pour
   construire la liste. Ils restent lisibles par le serveur (ancien format
   accepté en lecture, décision 2).

**Conséquences à reporter dans le plan.**

- Le plan (section 2) se structure en trois lots dans cet ordre, avec un
  commit par point et `build && valider && npm test` entre chaque.
- `etat-d-avancement.md` §1 « ce qui reste à faire » est à réécrire
  depuis ce fichier.
- Un ticket joué en c qui révèle un manque dans a ou b s'ajoute à
  `retours-beta.md` d'abord, comme avant.

**Ce qui est écarté.** a → b → c : la bêta s'arrête, et la passe sur le
manifeste se fait sans nouveaux tickets. c → a : chaque ticket produit un
symptôme paraphrasé et un `resolu_par: outil` que personne n'a dit.

### Décision 7 — Ce qu'on ne fait pas dans ce cycle (2026-09-18)

Nommé pour que ça ne revienne pas par la fenêtre pendant l'implémentation.

| Sujet | Pourquoi ça attend | Quand |
| --- | --- | --- |
| **Empreinte optimiste** sur contexte et brouillons (deux serveurs, dernier-écrit-gagne) | Porte 2 par définition : collègues, partage réseau. A4 et A5 sont les garde-fous mono-poste | Porte 2 |
| **Périmètre I — documentation d'entreprise** (documents existants dans le flux) | Contrat neutre déjà écrit ; rien à coder avant que le contexte lui-même soit tenu à jour (décision 9) | Après la porte 1 |
| **Paliers de montée en charge** (vingt domaines, manifeste à deux niveaux) | Six domaines dont quatre pas joués. La règle « ne rien construire qui empêche le palier suivant » suffit | Quand un septième domaine arrive |
| **Une installation par poste** (`~/.claude.json` en dur) | Palier 4 ; un technicien qui sert deux entités n'existe pas en bêta | Porte 2 ou 3 |
| **Rétention d'`historique/`** | Des fichiers de quelques Ko ; pas de dommage avant des mois | L'audit (décision 9) le signale ; rien d'automatique |
| **Hooks Claude Code** | Écarté en décision 5 | Porte 2 si les oublis persistent |
| **`creation-vm`** et **« une demande par fichier »** | `creation-vm` n'est pas une demande à part entière : une création de VM se traite avec les règles générales de système et `general/plateformes` en contexte, comme les deux builds réels l'ont montré. Le point « reste à faire » de la ligne cloud du 2026-09-09 est fermé sans écriture. « Une demande par fichier » n'a donc plus de déclencheur | Quand un domaine dépasse trois demandes |
| **Nuance dans `ouverture-flux`** (« la destination existe » vs créée par le même plan) | Même ligne cloud ; pas de ticket réel qui l'ait demandée depuis | Si un ticket la réclame |
| **Migration des tickets existants** (tags libres, signaux libres) | Décision 6, point 4 | Jamais : on lit à la main |
| **Commande `mesures`** du CLI (`validation.md` §6) | Absorbée par l'audit (décision 8) | Avec la décision 8 |
| **Règle de compatibilité produit / installation** | Avant la première installation chez un tiers | Porte 2 |

**Ce qui n'est pas dans cette liste, exprès.** C3 (commande `verifier`) et
la purge des brouillons anciens : ils deviennent la moitié déterministe de
l'audit (décision 8) et se font avec lui.

### Décision 8 — Le skill `audit`, volet tickets (2026-09-18)

**Problème.** Tickets, journaux, brouillons et entrées de base
s'accumulent dans `installation/` et rien ne les relit. Le jeu de test du
triage promis par `plan.md` n'est construit par rien ; le tableau T-P7 de
`retours-beta.md` est vide depuis le premier jour ; un brouillon ancien ne
produit qu'un avertissement ; un ticket résolu ne monte en base que si le
modèle y pense à la clôture ; rien ne valide les fichiers d'`installation/`
(C3). Le projet produit des données mais n'a pas d'outil pour se regarder.

**Ce qui est décidé.**

1. **Un skill réservé `audit`**, `load_skill(["audit"])`, hors ticket, au
   même titre que `triage`, `cloture`, `remplissage`. Sur le modèle de
   `triage` qui arrive avec le manifeste et la liste des brouillons : le
   **serveur calcule un rapport**, le skill dit au modèle comment le
   présenter et quoi proposer. Le modèle ne compte rien.

2. **Tout le monde peut lancer un audit** — technicien ou référent. Les
   écritures que l'audit propose restent soumises au oui, comme partout ;
   ce n'est pas le lanceur qui change l'invariant.

3. **Chaque rapport est daté et conservé** : `installation/audits/<date>.md`,
   écrit par le serveur. On trace tout. C'est la seule preuve que la bêta a
   été regardée, et c'est la matière de T-P7 et de la porte 1.

4. **Ce que le serveur calcule, volet tickets :**

   | Constat | Source | Ce que le skill propose |
   | --- | --- | --- |
   | Tickets où `domaines_proposes ≠ domaines_valides`, escalades | `tickets/` | Le **jeu de test du triage** : « signaux cochés → domaine calculé → domaine validé » ; un écart désigne un signal du manifeste à revoir. Calculable avec la décision 2 ; lu à la main avant |
   | Brouillons de plus de `JOURS_BROUILLON_ANCIEN` | `en-cours/` | Clôture en `non-resolu`, un par un, sur oui → `save_ticket`. Ferme le point « purge » sans automatisme |
   | Brouillons orphelins (illisibles) ou zombies (ticket déjà clôturé) | `en-cours/` + `tickets/` | Signaler ; A8 retire le zombie |
   | Tickets `resolu` jamais publiés | `tickets/` − `kb/` | Candidats à `publish_kb`, un par un, sur oui |
   | Tags hors vocabulaire dans la base (D1) | `kb/` + manifeste + `tags.yaml` | Signaler ; correction manuelle (décision 6, point 4) |
   | Cas lus par `read_kb` (décision 4) et suite donnée | brouillons, tickets | Une base qui sert, ou pas |
   | Santé des fichiers (C3) : titres sans `id —`, sections en double, YAML cassé, domaines inconnus dans un ticket | tout `installation/` | Signaler ; correction manuelle |
   | Mesures T-P7 : nature, domaines, questions posées, durée, résolu par | `tickets/` | Le tableau, rempli, dans le rapport |

5. **L'audit n'écrit jamais de lui-même.** Ses seules sorties sont les
   appels existants sur un oui : `save_ticket` (clôturer un vieux
   brouillon), `publish_kb`. Il ne modifie jamais un ticket clôturé, un
   journal ou une entrée de base — ce sont des archives.

6. **Le même rapport est une commande CLI** `audit` : lisible sans modèle,
   comme `etat` et `valider`. Une seule fonction, deux rendus.

**Conséquences à reporter dans le plan.**

- `audit.ts` (nouveau) : les calculs ; `cli.ts` : la commande ;
  `skills.ts` : `audit` comme skill réservé, rapport injecté ;
  `produit/contenu/general/audit.md` : le skill.
- `installation/audits/` créé par `init` ; `config.ts` le connaît.
- Le point d'entrée : « `/support audit` » ; `gouvernance.md` : qui lance,
  qui valide.
- Le volet contexte du rapport est la décision 9.
- La commande `mesures` de `validation.md` §6 est absorbée.

**Ce qui est écarté.** Réserver l'audit au référent : les écritures sont
déjà protégées par le oui, restreindre le lanceur n'ajoute rien. Un
rapport à la volée jamais écrit : on ne verrait pas l'évolution, et T-P7
resterait vide. Une purge automatique des brouillons : un humain dit oui.

### Décision 9 — Le skill `audit`, volet contexte : la validité (2026-09-18)

**Problème.** Le contexte se remplit par l'usage mais rien ne l'entretient
(`retours-beta.md`, 2026-09-11). Les questions journalisées avec
`section_candidate` et les `mises_a_jour_contexte` refusées à la clôture ne
sont jamais relues ; l'âge d'une section (`Dernière mise à jour`) est lu
mais jamais signalé ; une vérification qui contredit le contexte en cours
de ticket n'est tenue que par le prompt de clôture. La boucle de fraîcheur
en trois temps de `validation.md` §6 était différée après la porte 1 ; elle
entre ici comme second volet du rapport d'audit.

**Ce qui est décidé.**

1. **Seuil de péremption : 90 jours, global.** Une section datée de plus
   de 90 jours est périmée. Pas de seuil par section dans ce cycle : un
   seul chiffre, connu de tous, dans `config.ts`.

2. **La confirmation « toujours vrai » passe par `update_context` à contenu
   identique.** Le serveur compare au contenu en place : identique → il
   repose la date seulement, sans copie dans `historique/` ; différent →
   écriture normale. Pas d'appel `confirm_context`. Le oui du technicien
   reste requis, comme pour toute écriture.

3. **Un champ `contradictions` dans `save_progress`** :
   `[{ section, constat }]`, `section` en enum des identifiants de sections
   des gabarits (construit au démarrage, même mécanisme que les signaux),
   `constat` ≤ 240 caractères. Le modèle le renseigne quand une
   vérification contredit une valeur chargée du contexte ; le serveur
   l'accumule dans le brouillon, la clôture le reprend dans
   `mises_a_jour_contexte` sans compter sur la mémoire du modèle. Le champ
   est du diagnostic (le modèle a *constaté*) ; la section est de la
   mécanique (vérifiée).

4. **Ce que le serveur calcule, volet contexte :**

   | Constat | Source | Ce que le skill propose |
   | --- | --- | --- |
   | Section périmée (> 90 jours) | `Dernière mise à jour` | « Toujours vrai ? » — oui → `update_context` identique (re-date) ; non → `update_context` avec le nouveau contenu |
   | Section vide rencontrée en ticket | `journal/` (`section_candidate` dont la section est encore vide) | Le contenu candidat de la réponse du technicien, sur oui |
   | Mise à jour proposée à la clôture, jamais appliquée | `mises_a_jour_contexte` des tickets, comparé au contexte | Idem ; en tête si plusieurs tickets proposent la même section |
   | Contradiction notée en ticket | `contradictions` des brouillons et tickets | « Le contexte dit X, le ticket a constaté Y » — corriger, sur oui |
   | Volumineuse (C1), placeholders restants (C2), titres mal formés (C3) | `etat` | Élaguer, compléter, corriger |
   | `historique/` : nombre de copies par fichier | `contexte/historique/` | Signaler seulement (décision 7 : pas de rétention automatique) |

5. **Péremption à l'usage** (mécanisme 1 de la boucle) : `load_skill` et
   `get_context` annotent une section périmée (« à confirmer, datée du … »)
   — le skill fait confirmer la valeur au moment où il s'apprête à s'en
   servir, pas seulement à l'audit. Même règle : oui → re-date, non →
   `update_context`.

6. Comme au volet tickets : l'audit **n'écrit jamais de lui-même**, sa
   seule sortie est `update_context` sur oui ; le rapport est daté et
   conservé dans `installation/audits/` ; la commande CLI `audit` rend le
   même rapport.

**Conséquences à reporter dans le plan.**

- `config.ts` : `JOURS_PEREMPTION = 90`.
- `contexte.ts` : détection de l'identique dans `ecrireSection` (re-date
  sans historique) ; âge des sections dans `obtenirSections` et dans le
  rendu ; croisement journal / tickets / contexte pour la file des
  candidats.
- `encours.ts`, `tickets.ts`, `index.ts` : champ `contradictions`, enum
  des sections, reprise à la clôture.
- `audit.ts` : le volet contexte du rapport.
- `remplissage.md` : propose les candidats un par un depuis le rapport ;
  `cloture.md` : reprend `contradictions` ; les skills de domaine : « à
  confirmer » sur une section périmée.
- `format-contexte.md` §5 : la boucle devient le quatrième canal, comme
  prévu ; `validation.md` §6 : la ligne « fraîcheur » passe en décidé.
- Le point ouvert de `plan.md` (seuil, forme de la confirmation) se ferme.

**Ce qui est écarté.** Un seuil par section dans le gabarit : plus juste,
mais un second chiffre à expliquer avant d'avoir mesuré si 90 jours pose
problème. Un appel `confirm_context` : une signature de plus pour ce que
`update_context` peut dériver. Laisser la contradiction au prompt de
clôture : c'est ce qui existe, et la mémoire du modèle à la clôture est
justement ce qu'on ne veut plus.

### Décision 10 — Durcir les skills : une question, une commande, attendre (2026-09-18)

**Problème.** Les skills disent déjà « une question à la fois » et les
tests T-B vérifient « aucun cran sauté ». Mais rien n'est aussi net sur
l'**application du plan** : une fois le plan validé, le modèle peut dérouler
plusieurs commandes d'un coup, ou enchaîner la suivante sans avoir vu la
sortie de la précédente. Et « une question à la fois » n'est pas partout
formulé comme « puis j'attends la réponse avant toute autre chose ».

**Ce qui est décidé.**

1. **Deux règles de conduite, dans tous les skills et toutes les
   demandes**, formulées à l'identique :
   - *Collecte* : **une question, puis j'attends la réponse.** Pas de
     liste de questions, pas de question suivante avant la réponse, pas de
     supposition à la place d'une réponse.
   - *Application du plan* : **une commande, puis j'attends la sortie.**
     Le technicien exécute, colle le résultat ; le modèle le lit, puis
     seulement propose la suivante. Un résultat inattendu arrête le plan,
     il ne le contourne pas.

2. **Le gabarit de plan d'action** de chaque demande devient une séquence
   numérotée d'étapes exécutables une à une, avec pour chacune ce qu'on
   attend en sortie — pas un paragraphe.

3. **Ce que le serveur peut tenir**, parce que c'est une règle de prompt
   par nature : `save_progress.actions` est une liste d'entrées
   « commande → résultat », une par tour ; l'audit (décision 8) compte les
   actions par ticket et signale un `save_progress` qui en ajoute plusieurs
   d'un coup — un indice, pas une preuve. Les tests T-B restent la
   vérification de référence.

**Conséquences à reporter dans le plan.**

- `format-skill.md` : les deux règles dans le squelette des règles de
  conduite, mot pour mot ; `valider` contrôle leur présence.
- Les six `skill.md`, les six `demandes.md`, `cloture.md` : réécriture de
  la règle et des gabarits de plan.
- `validation.md` : un test T-B « application du plan, une commande à la
  fois » à côté de « une question à la fois ».
- Le protocole existe déjà tel quel dans le skill `debug-support` de
  l'hôte (« l'utilisateur tape chaque commande, une seule à la fois ») :
  reprendre sa formulation plutôt qu'en inventer une.

**Ce qui est écarté.** Tenir cette règle côté serveur : il ne voit pas la
conversation. Un hook `Stop` qui bloquerait un message contenant deux
commandes : décision 5, pas de hooks dans ce cycle.

---

## 2. Plan

> Rédigé le 2026-09-18, toutes les décisions prises. Chaque point est un
> commit ; entre deux points, depuis `produit/serveur/` :
> `npm run build && node dist/cli.js valider && npm test`. Un point qui ne
> passe pas ces trois commandes n'est pas fini.

### 2.0 Ordre d'exécution — amendement de la décision 6 (2026-09-18)

**Ce qui change.** La décision 6 étalait le travail sur trois lots, avec
les signaux et les tags en dernier, après des tickets réels joués entre
temps. Décision du 2026-09-18 : **tout est implémenté en une passe**, sans
ticket réel intercalé, puis une **phase de test** sur une installation
neuve avec dix tickets (section 2.10). La raison : tester le produit
complet plutôt qu'un produit à moitié transformé, et éviter de jouer des
tickets avec des skills qu'on sait devoir réécrire (décision 10).

**Ce que ça coûte, et comment on le paie.** L'enum des 24 signaux est
figé avant tout ticket réel sur quatre domaines sur six. Un signal mal
formulé produira des refus injustifiés (« domaine sans signal coché ») ou
des tickets où `domaines_proposes ≠ domaines_valides` sans que la taxonomie
soit en cause. Donc : la **passe sur le manifeste** (décision 2) est le
dernier point de la phase de test, pas une étape de l'implémentation ; et
pendant les dix tickets, un refus injustifié = une ligne dans
`retours-beta.md`, on ne corrige pas le manifeste au fil de l'eau.

**L'ordre d'implémentation** n'est plus celui des lots mais celui des
dépendances :

| # | Chantier | Décision | Dépend de |
| --- | --- | --- | --- |
| 2.1 | Corrections sans contrat | 6 (lot a) | — |
| 2.2 | Une question, une commande | 10 | — |
| 2.3 | L'hôte : `settings.json` | 5 | — |
| 2.4 | État de session | 3 | 2.1 (A4, A8) |
| 2.5 | `read_kb` et D2 | 4 | 2.4 |
| 2.6 | Signaux identifiés | 2 | 2.4 (classement rendu par `save_progress`) |
| 2.7 | Tags fermés | 1 | 2.4, 2.6 (domaines validés, même mécanisme d'enum) |
| 2.8 | Validité du contexte | 9 | 2.4 (accumulation de `contradictions`), 2.6 (enum) |
| 2.9 | Audit | 8 | tout ce qui précède (le rapport les consomme) |
| 2.10 | Documentation transverse et version | — | tout |
| 2.11 | Phase de test | — | 2.10 |

**Ce qui est ajouté au lot a depuis `retours-beta.md`.** La décision 6
listait A1, A4, A6, A7, A8, C1, C2, E1 et trois points du complément.
Restaient « à corriger » sans être placés : A2 (clé de dédoublonnage
normalisée), A3 (domaines contrôlés contre le manifeste — cité par la
décision 2), A5 (rattachement par symptôme — cité par les décisions 3 et
7), B1 (liste des brouillons plafonnée, `resume_ticket` d'abord). Ils sont
petits, sans changement de signature, et cohérents avec les décisions :
ils entrent dans 2.1. Rien d'autre du complément n'est repris sans une
ligne ici.

### 2.1 Corrections sans contrat (décision 6, lot a)

Aucune signature ne bouge, les fichiers existants restent valides.
Groupés par fichier ; un commit par ligne.

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| a1 | A7 | `ids.ts`, `contexte.ts` | `getUTC*` dans `horodatage`, `dateDuJour`, `horodatageCompact`. Format inchangé |
| a2 | A2 | `encours.ts`, `tickets.ts` | Clé de dédoublonnage normalisée (minuscules, sans accents ni ponctuation, espaces réduits) pour `ajouter` et `fusion` |
| a3 | E1 | `skills.ts` | Dédoublonner `domaines` avant le test `max_domaines` ; smoke ajusté |
| a4 | A8 | `encours.ts`, `cli.ts`, `tickets.ts` | `listerBrouillons` ignore un brouillon dont le ticket existe ; `etat` le signale « zombie » ; « déjà clôturé » retire le brouillon |
| a5 | A3 | `encours.ts`, `tickets.ts` | `domaines_proposes`, `domaines_valides`, `escalades` contrôlés contre le manifeste (`trim`, minuscules) ; erreur `isError` qui liste les domaines. Remplacé par l'enum en 2.6, mais le contrôle reste utile pour les brouillons lus |
| a6 | A5 | `encours.ts` | À la création sans `id` ni `reference` : si un brouillon porte le même `symptome_initial` normalisé, rattacher (réponse « brouillon rattaché par le symptôme ») au lieu de créer |
| a7 | A4 | `encours.ts`, `tickets.ts` | Refus si le brouillon a une référence et qu'on en donne une autre (casse exceptée) : « mauvais id ? » |
| a8 | A6 | `encours.ts`, `tickets.ts`, `triage.md` | Refus d'une référence commençant par `SANS-REF`, `AUCUNE`, `N/A`, `NA`, `NONE`, ou vide après `trim` ; une ligne dans `triage.md` : « ne jamais en inventer » |
| a9 | A1 + complément | `tickets.ts` | Quand un brouillon existe, le serveur prend **son** `symptome_initial`, `domaines_proposes`, `plan_action`, `questions` ; ceux de la clôture ne servent que si le brouillon n'en a pas. `plan_action` obligatoire si `statut: resolu` |
| a10 | complément | `tickets.ts` | `resolu_par` : `null` si omis, jamais `outil` par défaut. `duree_minutes` : si un brouillon existe, calculée `cree → clôture` par le serveur ; le champ ne reste que pour la baseline sans brouillon |
| a11 | complément | `kb.ts` | `publish_kb` refuse un ticket dont le statut n'est pas `resolu` ; la réponse cite le symptôme publié (première ligne) |
| a12 | C1 | `contexte.ts`, `cli.ts` | `CARACTERES_MAX_SECTION = 2500` en plus de `LIGNES_MAX_SECTION` ; « volumineuse » si l'un des deux dépasse. Signal seulement, pas de refus à l'écriture |
| a13 | C2 | `contexte.ts` | « Vide » aussi si, après retrait des commentaires, des lignes ne contenant que des `<…>` et des séparateurs de table, il ne reste rien — indépendant de la version du gabarit |
| a14 | B1 | `encours.ts`, `triage.md` | Liste des brouillons plafonnée à 10 (+ « N autres, `resume_ticket()` pour tout voir ») ; règle de triage : une référence donnée → `resume_ticket(référence)` d'abord, avant tout triage |

Après 2.1, tout ce qui corrompt silencieusement est fermé.

### 2.2 Une question, une commande, attendre (décision 10)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| b1 | Les deux règles | `format-skill.md` §6 | Deux règles ajoutées au squelette des règles de conduite, mot pour mot, formulation reprise du protocole `debug-support` : « *Collecte* : une question, puis j'attends la réponse. » ; « *Application du plan* : une commande, puis j'attends la sortie. Une commande = une invocation, sans `;`, `&&` ni `\|` pour enchaîner. Un résultat inattendu arrête le plan. » |
| b2 | Contrôle | `validation.ts` | `valider` erreur si un `skill.md` ou `demandes.md` ne contient pas les deux formulations |
| b3 | Les skills | les six `skill.md`, les six `demandes.md` | Règles réécrites ; gabarit de plan d'action en **séquence numérotée**, une commande par étape, avec la sortie attendue. Rester sous 110 lignes ; si un fichier déborde, scinder (`format-skill.md` §7) |
| b4 | Le flux | `triage.md` étape 8, `cloture.md`, `gouvernance.md` §4 | Étape 8 : la règle d'application ; §4 : une commande par opération numérotée, exécutée et rapportée avant la suivante |
| b5 | Le test | `validation.md` §3 | Un test T-B8 « application du plan, une commande à la fois » à côté de T-B5 |
| b6 | L'invariant | `etat-d-avancement.md` §3 | Ligne « une commande à la fois — tenu par le prompt seul ; l'audit signale un `save_progress` à plusieurs actions » |

### 2.3 L'hôte : ce que Claude Code ne peut plus faire (décision 5)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| c1 | Le fichier | `produit/entrees/claude-code/settings.json` (nouveau) | Le `permissions.deny` de la décision 5 : `Edit(installation/**)`, `Write(installation/**)`, `Read(installation/kb/**)`, `Read(installation/en-cours/**)`, `Bash`. Motifs relatifs au dossier de lancement |
| c2 | La commande | `cli.ts` : `hote` (nouvelle) | Dépose `<dossier de lancement>/.claude/settings.json` ; **fusionne** dans un fichier existant (ajoute les entrées manquantes de `deny`, ne retire rien, sauvegarde `.support-it.bak`) ; annonce ce qui est interdit. Le dossier de lancement est le parent de `produit/` et `installation/` (déjà supposé par le point d'entrée) |
| c3 | Les scripts | `install.ps1`, `install.sh` | Appel de `hote` à l'étape 5, mêmes messages ; encodages tenus (BOM / LF) |
| c4 | Le doc | `deploiement.md` §2 | Le fichier, son contenu, pourquoi, comment le retirer |
| c5 | À vérifier à l'implémentation | — | La syntaxe exacte des motifs (relatifs ou absolus) dans la doc Claude Code ; le message reçu par le modèle quand le refus tombe. Consigner dans `deploiement.md`. Test manuel en 2.11 (T-H5) |

### 2.4 L'état de session (décision 3)

Le socle : tout ce qui suit s'appuie dessus.

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| d1 | L'objet | `session.ts` (nouveau) | `{ brouillonCourant: string \| null, skillsCharges: string[], sectionsServies: string[], casLus: string[] }` en mémoire du processus. Fonctions : `poserBrouillon`, `viderBrouillon`, `noterSkill`, `noterSection`, `noterCas`, `reconstruire(brouillon)`. Aucune dépendance vers les autres modules (`D-serveur-mcp.md` §2) |
| d2 | Le brouillon | `encours.ts` | Champs `skills_charges: string[]`, `sections_servies: string[]`, `cas_lus: string[]`, écrits par le serveur (pas dans `EntreeProgression`). `etape` calculée (voir d6). Entrée : `etape` remplacée par `pause?: boolean` ; `escalades` et `skill_charge` retirés de l'entrée, gardés en lecture pour les brouillons existants |
| d3 | Les handlers | `index.ts` | `load_skill` note le skill et pose l'étape ; `get_context` note la section ; `save_progress` pose le brouillon courant et recopie l'état ; `save_ticket` vide ; `resume_ticket(id)` reconstruit depuis le brouillon |
| d4 | Les refus | `index.ts`, `tickets.ts`, `kb.ts` | Quand un brouillon est courant : `save_ticket` sans `cloture` chargé → « charge `cloture` d'abord » ; `search_kb` sans aucun `load_skill(domaine)` → « le cas n'est pas instruit » ; `save_ticket.id` ≠ courant → refus (« un autre brouillon est en cours : `resume_ticket` pour basculer »). Sans brouillon courant : aucun refus |
| d5 | Les dérivés | `tickets.ts` | `escalades` = les `skills_charges` de domaine au-delà du premier, dans l'ordre ; `save_ticket.id` optionnel, rattaché au courant ; `get_context` sur une section déjà servie → « déjà chargée dans cette session » sans le contenu |
| d6 | L'étape | `encours.ts` | Calculée par le serveur : création → `triage` ; skill de domaine chargé → `instruction` ; `search_kb` → `recherche` ; `plan_action` non vide → `plan` ; `actions` non vide → `actions` ; `pause: true` → `pause` (levée au `save_progress` suivant). L'étape ne peut plus contredire le contenu |
| d7 | Le classement | `encours.ts`, `index.ts` | La réponse de `save_progress` rend le classement des domaines depuis les signaux cochés (branché en 2.6 ; en 2.4, la réponse rend les domaines validés et l'étape calculée) |
| d8 | Le rendu | `encours.ts` | `rendreReprise` : « recharger `load_skill(domaines_valides, nature)` » (plus de `skill_charge`) ; le corps du brouillon montre skills chargés et sections servies |
| d9 | Les textes | `triage.md`, `cloture.md`, `index.ts` (descriptions) | Triage : « le brouillon se crée au triage, **avant** le premier `load_skill(domaine)` » (le point ouvert de l'ordre se ferme) ; plus de `escalades` ni `skill_charge` à fournir ; clôture : « `id` facultatif, le brouillon courant est rattaché » |
| d10 | Le smoke | `smoke.ts` | Joue une **séquence complète** (triage → brouillon → domaine → contexte → recherche → plan → actions → cloture → ticket → publication) et les refus : `save_ticket` sans `cloture`, `search_kb` avant instruction, `id` d'un autre brouillon, `get_context` déjà servie. Puis une reprise après redémarrage du serveur (second client) : l'état est reconstruit |
| d11 | À vérifier à l'implémentation | — | Cycle de vie du processus dans Claude Code : `/clear`, `--resume`, reconnexion après `CONNECT_TIMEOUT`. Résultat consigné dans `D-serveur-mcp.md` §5. Si le processus est relancé plus souvent que prévu, la reconstruction (d3) est la voie principale |
| d12 | Les docs | `contrat-mcp.md` §6, `D-serveur-mcp.md` §2 et §5, `plan.md` 0.3 | L'état de session, ce qu'il refuse, ce qu'il dérive |

### 2.5 `read_kb` et D2 (décision 4)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| e1 | La lecture | `kb.ts` : `lireCas(id)` | Conclusion, plan d'action, signaux (identifiants et preuves) d'un cas de `kb/` seulement ; refus hors `kb/` (« ce ticket n'est pas publié ») ; refus d'un id invalide. Jamais les questions ni le texte entier |
| e2 | L'appel | `index.ts` | Neuvième outil `read_kb(ticket_id)`. Borné par l'état : brouillon courant et étape avant `recherche` → refus (« chercher d'abord ») ; le cas lu est noté dans le brouillon (`cas_lus`) |
| e3 | D2 : le score | `kb.ts` | Chaque tag commun vaut `1 / nombre d'entrées qui le portent` ; nature, domaines et référence non comptés |
| e4 | D2 : le rendu | `kb.ts` | Par cas : id, référence, score, tags communs à la recherche + « et N autres », symptôme et conclusion tronqués à 160 caractères. Plafond fixé à 5 par le serveur ; `limite` disparaît ; message « N cas partagent ces tags, 5 affichés — affiner » |
| e5 | Les textes | `triage.md` étape 6, `contrat-mcp.md` §3 et §3 bis (nouveau) | « Après `search_kb`, lire le cas retenu avec `read_kb` avant de reprendre sa conclusion » |
| e6 | Le smoke | `smoke.ts` | Recherche → lecture → refus hors `kb/` → refus avant l'étape recherche ; neuf outils dans la liste |

### 2.6 Les signaux (décision 2)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| f1 | Le manifeste | `manifeste.yaml` | Chaque signal devient `{ id, libelle }`, id kebab-case unique dans tout le manifeste ; `max_signaux: 6` en tête. Les 24 identifiants sont posés à la main, courts, sans reprendre le nom du domaine |
| f2 | Le contrôle | `validation.ts` | Unicité, forme kebab-case, ≤ `max_signaux` par domaine, libellé non vide |
| f3 | Le module | `manifeste.ts` | Lecture des `{ id, libelle }` (ancien format en chaînes accepté en lecture, id dérivé — pour le manifeste temporaire du smoke) ; `rendreManifeste` rend `id` + libellé ; `classerDomaines(ids)` → `[{ domaine, n }]` trié |
| f4 | Le schéma | `index.ts` | `signaux: [{ id: z.enum(ids du manifeste), preuve: z.string().max(160) }]` construit au démarrage. Même mécanisme pour `domaines_proposes`, `domaines_valides` (enum des domaines, remplace le contrôle a5 pour les entrées) |
| f5 | Le brouillon et le ticket | `encours.ts`, `tickets.ts` | `signaux` typé `{ id, preuve }[]`, dédoublonnage sur `id` ; l'ancien format (liste de chaînes) lu tel quel ; rendu « libellé — preuve » ; le serveur écrit la section « Signaux retenus », le modèle ne la formule plus |
| f6 | Le classement | `encours.ts`, `index.ts` | `save_progress` : classement des domaines depuis les signaux cochés dans la réponse ; refus d'un `domaines_proposes` qui contient un domaine sans signal coché |
| f7 | Les constats | `index.ts` | Description de `verifications` élargie : « un constat vérifié — commande → résultat, ou lecture d'un portail ou d'un journal » |
| f8 | Les textes | `triage.md` §2 et §3, `cloture.md`, `contrat-mcp.md` | « Coche les signaux avec l'extrait qui les montre ; les constats vont dans `verifications` » ; la proposition de triage cite les identifiants |
| f9 | Le smoke | `smoke.ts` | Signal inconnu refusé par le schéma ; preuve trop longue refusée ; classement rendu ; domaine proposé sans signal refusé ; ancien brouillon lu |

### 2.7 Les tags (décision 1)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| g1 | L'étage client | `config.ts`, `cli.ts` (`init`) | `installation/tags.yaml`, créé vide par `init` avec sa consigne en commentaire : même forme que le manifeste (`<domaine>: [tags]`, plus `general: [tags]` pour les transverses). Jamais écrasé |
| g2 | La bibliothèque | `manifeste.ts` : `bibliotheque(r)` | Produit ∪ client, par domaine ; `general` du client ajouté aux transverses. Refus au démarrage si `tags.yaml` est illisible ou en doublon avec le produit (message clair, le serveur démarre sans l'étage client) |
| g3 | Le schéma | `index.ts` | `tags: z.array(z.enum(bibliothèque)).max(5)` sur `save_ticket` et `publish_kb`. Un tag inconnu est refusé par le schéma ; au-delà de cinq : « garder ceux qui distinguent ce cas » |
| g4 | Le filtrage | `tickets.ts` | Contrôle à l'appel : un tag d'un domaine hors des domaines validés du brouillon (transverses exceptés) est refusé, avec la liste filtrée dans le message. Les dérivés (nature, domaines validés, escalades, référence) restent automatiques et hors plafond |
| g5 | La liste avant l'appel | `skills.ts` | `load_skill(["cloture"])` rend, quand un brouillon est courant, les tags candidats filtrés sur ses domaines validés + transverses ; sans brouillon, la bibliothèque entière |
| g6 | La recherche | `kb.ts` | `search_kb` : un tag inconnu de la bibliothèque est signalé avec les tags proches (distance d'édition ≤ 2), pas ignoré en silence |
| g7 | Le contrôle | `validation.ts`, `cli.ts` (`etat`) | `valider` : tags du manifeste uniques, kebab-case ; `etat` : `tags.yaml` lisible, sans doublon avec le produit |
| g8 | Les textes | `cloture.md`, `contrat-mcp.md` §4 et §5, `manifeste.md`, `gouvernance.md` §3 | « Cocher dans la liste servie, cinq au plus » ; qui ajoute un tag client (le référent), quand il monte au produit (jugement, pas compteur) |
| g9 | Le smoke | `smoke.ts` | Tag inconnu refusé ; sixième tag refusé ; tag hors domaine refusé avec liste ; `tags.yaml` client pris en compte ; tag inconnu signalé à la recherche |
| g10 | Les entrées existantes | — | Pas de migration (décision 6, point 4) : l'installation de test est neuve |

### 2.8 Validité du contexte (décision 9)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| h1 | Le seuil | `config.ts` | `JOURS_PEREMPTION = 90` |
| h2 | Re-dater | `contexte.ts` : `ecrireSection` | Contenu normalisé identique à celui en place → seule la ligne de date change, pas de copie dans `historique/` ; réponse « confirmée, re-datée ». Différent → écriture normale |
| h3 | L'âge | `contexte.ts` : `obtenirSections`, `rendreSections` | `age` en jours, `perimee: boolean` ; rendu « _à confirmer : datée du …, plus de 90 jours_ » sur une section périmée, dans `get_context` comme dans les requis de `load_skill` |
| h4 | Les contradictions | `encours.ts`, `tickets.ts`, `index.ts` | `save_progress.contradictions: [{ section: z.enum(ids de sections des gabarits), constat: ≤ 240 }]`, accumulées ; la clôture les reprend dans `mises_a_jour_contexte` (section « Contradictions constatées » du ticket) sans compter sur le modèle. Même enum pour `questions[].section` et `mises_a_jour_contexte[].section` |
| h5 | La file des candidats | `contexte.ts` : `candidats(r)` | Croise `journal/` (`sections_candidates` dont la section est encore vide), `mises_a_jour_contexte` des tickets jamais appliquées (contenu absent du contexte), `contradictions` des brouillons et tickets ; regroupe par section, en tête si plusieurs tickets |
| h6 | Les textes | `remplissage.md`, `cloture.md`, les six `skill.md` | Remplissage : « propose les candidats un par un depuis le rapport » ; clôture : les contradictions sont déjà là ; skills : « une section marquée à confirmer se confirme avant de s'en servir — oui → `update_context` identique, non → nouveau contenu » (une ligne, dans les règles de conduite) |
| h7 | Les docs | `format-contexte.md` §5, `validation.md` §6, `plan.md` §4 | Le quatrième canal ; la ligne « fraîcheur » passe en décidé ; le point ouvert se ferme |
| h8 | Le smoke | `smoke.ts` | `update_context` identique → date seule, pas d'historique ; section antidatée → annotée ; `contradictions` accumulées et reprises au ticket ; section inconnue refusée |

### 2.9 L'audit (décision 8)

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| i1 | Le dossier | `config.ts`, `cli.ts` (`init`) | `installation/audits/` ; `assurerInstallation` le crée |
| i2 | Les calculs | `audit.ts` (nouveau) | `calculerAudit(r)` → un objet ; `rendreAudit(a)` → markdown. Volet tickets : jeu de test du triage (signaux cochés → domaines calculés → validés, écarts), brouillons > `JOURS_BROUILLON_ANCIEN`, orphelins et zombies, résolus jamais publiés, tags hors bibliothèque dans `kb/`, cas lus (`cas_lus`) et suite donnée, santé des fichiers (C3 : titres sans `id —`, sections en double, YAML cassé, domaines inconnus), `save_progress` à plusieurs actions (décision 10), mesures T-P7 (nature, domaines, questions, durée, résolu par). Volet contexte : sections périmées, file des candidats (h5), volumineuses, placeholders, titres mal formés, copies dans `historique/` |
| i3 | L'écriture | `audit.ts` : `ecrireAudit(r)` | `installation/audits/<AAAAMMJJ-HHMMSS>.md`, `flag: "wx"`, jamais modifié |
| i4 | La commande | `cli.ts` : `audit` | Même rapport sur la sortie standard, écrit aussi dans `audits/`. Code retour 1 si un constat de santé (C3) est trouvé. Lancée à l'étape 6 des scripts après `etat` |
| i5 | Le skill | `skills.ts`, `produit/contenu/general/audit.md` (nouveau) | `load_skill(["audit"])`, réservé, hors ticket ; le rapport est calculé, écrit, et injecté à la suite du skill (comme le manifeste pour `triage`). Le skill dit comment présenter chaque constat et quoi proposer — clôture d'un vieux brouillon (`save_ticket`, `non-resolu`), publication (`publish_kb`), confirmation ou correction d'une section (`update_context`) — **un par un, sur oui**. Il ne compte rien, n'écrit rien de lui-même, ne touche jamais une archive |
| i6 | Le point d'entrée | `produit/entrees/claude-code/support/SKILL.md` | « `/support audit` » → `load_skill(["audit"])` |
| i7 | Les docs | `gouvernance.md` §3, `outillage.md`, `validation.md` §6 | Qui lance (tout le monde), qui valide (le oui, comme partout) ; la commande ; `mesures` absorbée |
| i8 | Le smoke | `smoke.ts` | Sur l'installation temporaire après la séquence complète : rapport écrit, T-P7 rempli avec le ticket joué, vieux brouillon antidaté signalé, ticket résolu non publié listé, fichier de contexte au titre cassé signalé |

### 2.10 Documentation transverse et version

| # | Point | Fichier | Ce qui est fait |
| --- | --- | --- | --- |
| j1 | Neuf appels | `grep -rn "huit appels\|huit outils"` | Tous passés à neuf, en un commit : `plan.md`, `contrat-mcp.md` (titre), `D-serveur-mcp.md`, `fin-de-projet.md`, `etat-d-avancement.md`, `gouvernance.md`, `outillage.md`, `validation.md`, `index.ts`, `smoke.ts`, `install.ps1`, `install.sh` |
| j2 | Le contrat | `contrat-mcp.md` | Chaque section relue contre `index.ts` ; §6 invariants : l'état de session, les enums, les dérivés ; §7 |
| j3 | Le flux | `plan.md` 0.3, `architecture/schema/routage_support_v4.svg` | `read_kb` après `search_kb`, `audit` hors ticket, l'étape dérivée |
| j4 | L'état | `etat-d-avancement.md` | §1 « ce qui reste à faire » réécrit depuis ce fichier ; §3 : les invariants passés de « prompt seul » à « code » (symptôme, référence, domaines, signaux, ordre du flux, écriture hors appels par l'hôte) et les nouveaux tenus par le prompt seul (une commande à la fois, le oui) ; §4.4 : neuf appels, `session.ts`, `audit.ts` |
| j5 | Les décisions | `fin-de-projet.md` §4 et §10 (nouveau) | Décisions 30 à 39 : une ligne par décision de la section 1, avec le pourquoi ; §10 « Bêta v3 » sur le modèle de §9 |
| j6 | Les mesures | `retours-beta.md` | Le tableau T-P7 devient « rempli par l'audit » ; les lignes « à corriger » de 2.1 passent en « corrigé le … » |
| j7 | La version | `produit/VERSION` | `0.3.0-beta` ; `init` annonce la mise à jour |

### 2.11 Phase de test — dix tickets sur une installation neuve

**Préparation.** `produit/` remplacé, `installation/` vide, `install.*`
complet (les six étapes, `hote` compris), `init` → `tags.yaml` vide,
`audits/` créé, `etat` : 44 sections vides. `/mcp` : neuf outils. Le
contexte se remplit **par les tickets**, pas avant (c'est le test du
remplissage par conversation) ; au plus `general/sites` et
`general/plateformes` remplis à la main par `remplissage` pour ne pas
répondre à la même question dix fois.

**Ce que chaque ticket éprouve.** Dix tickets, six domaines, les deux
natures, et chaque mécanisme au moins une fois :

| # | Domaine · nature | Ce qu'on regarde |
| --- | --- | --- |
| T1 | réseau · incident, cas net | Brouillon créé avant `load_skill` ; signaux cochés avec preuve ; classement ; étape dérivée ; `search_kb` vide ; clôture sans `id` ; tags filtrés ≤ 5 ; publication |
| T2 | système · incident, ambigu avec réseau | Porte asymétrique : une question ; deux domaines chargés ; discrimination ; `domaines_proposes ≠ domaines_valides` (matière du jeu de test) |
| T3 | identité · incident, avec escalade depuis poste de travail | Escalade dérivée du second `load_skill` ; aucun champ `escalades` fourni |
| T4 | poste de travail · demande | `demandes.md` ; plan en séquence ; **une commande, une sortie** (T-B8) ; `actions` une par tour |
| T5 | matériel · incident, mis en pause puis repris | `pause: true` ; `resume_ticket` ; reconstruction de l'état après redémarrage du serveur ; refus si `save_ticket` sans `cloture` |
| T6 | applicatif · demande, hors domaines couverts au triage | Clôture `hors-domaines-couverts` ; `publish_kb` refusé (non résolu) |
| T7 | réseau · incident proche de EX-1001 (jeu de test, section 3) | `search_kb` renvoie EX-1001 en tête, score par rareté, rendu compact ; `read_kb` ; `cas_lus` noté ; refus de `read_kb` avant l'étape recherche (à provoquer une fois) |
| T8 | système · incident avec contradiction du contexte | `contradictions` en cours de ticket ; reprise à la clôture ; `update_context` sur oui ; `update_context` identique → re-datée |
| T9 | identité · baseline (technicien a déjà diagnostiqué) | `conclusion_humaine`, `resolu_par` donné, durée calculée par le serveur ; `resolu_par` absent → `null` sur un autre ticket |
| T10 | poste de travail · incident, référence fabriquée puis mauvais id | Refus A6 ; refus A4 ; `save_progress` sans id sur le même symptôme → rattaché (A5) ; tag inconnu et sixième tag refusés ; tag client ajouté dans `tags.yaml` puis accepté |

Puis, hors ticket : `/support audit` (T11) — rapport écrit, T-P7 rempli
avec les dix tickets, brouillon antidaté proposé à la clôture, résolu non
publié proposé, section périmée (antidatée à la main) proposée à
confirmer ; `node dist/cli.js audit` rend le même rapport. Et le test
manuel de l'hôte (T-H5) : demander au modèle d'éditer
`installation/contexte/reseau.md` directement et de lancer une commande —
les deux doivent être refusés, le premier doit se rabattre sur
`update_context`.

**Ce qu'on note.** Une ligne dans `retours-beta.md` par : refus injustifié
(avec l'appel et le message), signal du manifeste qui ne colle pas au
ticket (sans corriger le manifeste), oubli de `save_progress` (T-P9),
commande enchaînée malgré la règle, question en liste. Le tableau T-P7 est
lu dans le rapport d'audit, plus tenu à la main.

**Ce qui vient après les dix tickets, et pas avant.** La passe sur le
manifeste (décision 2) : les identifiants et libellés des signaux revus
domaine par domaine, à partir des écarts du jeu de test et des lignes de
`retours-beta.md`. Puis, si le manifeste change, `valider`, `npm test`, et
un onzième ticket sur le domaine retouché.

Le détail — jeu de données, mise en place, scénarios pas à pas — est la
section 3.

---

## 3. Plan de test

> Rédigé le 2026-09-18. Se joue **après** la section 2 (2.1 à 2.10), sur
> une installation neuve. Tout ce qui est écrit ici se note dans
> `validation.md` §7 (une ligne par scénario) et `retours-beta.md` (une
> ligne par écart). La section 2.11 donne le cadre ; celle-ci donne les
> gestes.

### 3.1 Le jeu de données

**Principe.** Rien n'est écrit à la main : un script pilote le serveur
construit par le client MCP, comme le smoke, et les fichiers sont ceux que
le serveur fabrique — au nouveau format, avec de vrais identifiants et de
vraies dates. Les anomalies pour l'audit sont posées **après**, par
édition directe, et listées comme telles.

**Où.** `outils/jeu-de-test.mjs` et `outils/jeu-de-test.yaml`, à la
racine du dépôt, versionnés, **hors `produit/`** (non livrés, non scannés
par `valider` — à vérifier au premier passage, sinon exclure `outils/`).
Le script prend `SUPPORT_IT_INSTALLATION` et refuse de tourner si le
dossier n'est pas vide (sauf `--reinitialiser`, qui le vide d'abord). Les
données sont dans le YAML : c'est lui qu'on relit et qu'on modifie, jamais
le script.

**Entreprise fictive : « Exemple SAS ».** Domaine AD `exemple.local`,
tenant M365 `exemplesas.onmicrosoft.com`, un abonnement Azure « Prod »,
deux sites — Siège (Paris, `10.10.0.0/16`) et Agence Nord (Lille,
`10.20.0.0/16`) reliés par VPN site à site, télétravail par VPN client.
Serveurs : `srv-ad-01`, `srv-ad-02`, `srv-fs-01`, `srv-app-01`,
`srv-bkp-01`. Une application maison « app-compta » (éditeur fictif
« Logiciels du Nord »), un ERP hébergé. Adresses publiques en
`192.0.2.0/24` (plage réservée à la documentation). Tout est dans
`installation/`, hors de la règle « aucune donnée d'entreprise dans
`produit/contenu/` ».

**Le contexte : 44 sections remplies sur 45** (les gabarits en ont 45, pas 44). Chaque section au format de
son gabarit (tableau de 3 à 5 lignes, ou 3 lignes de prose), écrite par
`update_context`. Les `requis` des six skills sont soignés (c'est ce que
chaque ticket paie en tokens), les `selon-cas` minimaux.
`materiel/salles-techniques` reste **vide exprès** (anomalie 9).
`general/plateformes` est écrite à ~3 000 caractères (anomalie 12).

**`installation/tags.yaml` client :**

```yaml
general: [m365, azure, agence-nord]
reseau: [vpn-site-a-site]
poste-de-travail: [app-compta]
applicatif: [app-compta, erp-heberge]
```

(`app-compta` sur deux domaines : c'est permis, un tag client peut être
rattaché à plusieurs domaines ; le doublon interdit est produit ∩ client.)

**Les identifiants de signaux** que le jeu utilise — à poser en f1, ils
sont fixés ici pour que le YAML et le manifeste parlent la même langue.
Note : le manifeste compte **20** signaux (4, 4, 3, 3, 3, 3), pas 24 comme
l'écrit la décision 2.

| Domaine | Identifiants |
| --- | --- |
| réseau | `depend-du-lieu`, `tous-services-touches`, `population-lieu-lien`, `symptomes-transport` |
| système | `un-service-touche`, `independant-du-chemin`, `tous-utilisateurs-du-service`, `symptomes-serveur` |
| poste de travail | `suit-la-machine`, `un-seul-poste`, `os-repond` |
| matériel | `symptomes-physiques`, `persiste-hors-logiciel`, `echange-objet-resout` |
| identité | `suit-la-personne`, `service-repond-mais-refuse`, `correle-evenement-compte` |
| applicatif | `acces-ok-dedans-ko`, `lie-action-ou-donnee`, `reproductible-partout` |

**Les 13 tickets du jeu.** Douze publiés (six domaines × incident et
demande), un treizième résolu mais **non publié** (anomalie 4). Chacun
suit la séquence complète : `save_progress` (création, référence, symptôme)
→ `load_skill(domaine)` → `save_progress` (signaux cochés avec preuve,
domaines) → `get_context` d'une section selon-cas → `search_kb` →
`save_progress` (plan en séquence, deux actions, une par appel) →
`load_skill(["cloture"])` → `save_ticket` → `publish_kb`. Deux questions
posées par ticket, avec section candidate.

| Réf. | Domaine · nature | Symptôme (tel qu'exprimé) | Cause / conclusion | Signaux | Tags cochés | Particularité |
| --- | --- | --- | --- | --- | --- | --- |
| EX-1001 | réseau · incident | « Depuis ce matin les télétravailleurs en VPN n'accèdent plus au partage sur srv-fs-01, au bureau ça marche » | Le profil VPN client ne pousse plus le suffixe DNS `exemple.local` après la mise à jour du concentrateur | `depend-du-lieu`, `population-lieu-lien` | `vpn`, `dns` | Cible de T7 |
| EX-1002 | réseau · demande | « Il faut ouvrir l'accès à app-compta depuis l'Agence Nord » | Flux TCP 8443 Agence Nord → srv-app-01 à ouvrir sur le pare-feu du VPN site à site | — (demande) | `ouverture-flux`, `agence-nord` | Tag client transverse ; `app-compta` (poste de travail, applicatif) serait refusé sur un ticket réseau — vérifié à la génération |
| EX-1003 | système · incident | « La sauvegarde de srv-fs-01 est en échec depuis trois nuits » | Volume de destination sur srv-bkp-01 plein, rétention non appliquée | `un-service-touche`, `symptomes-serveur` | `sauvegarde`, `stockage` | **Proposé `[reseau]`, validé `[systeme]`** (anomalie 19a) |
| EX-1004 | système · demande | « Créer un partage Projets sur srv-fs-01 pour l'équipe études » | Partage + groupe AD + droits NTFS, séquence en 5 étapes | — | `creation-partage` | `mises_a_jour_contexte` sur `systeme/stockage` **jamais appliquée** (anomalie 10) |
| EX-1005 | poste de travail · incident | « Outlook plante à l'ouverture sur le poste de M. Durand, sur un autre poste ça va » | Profil Outlook corrompu, recréé | `suit-la-machine`, `un-seul-poste` | `application`, `profil`, `m365` | `contradictions` sur `poste-de-travail/applications-standard` (anomalie 11) |
| EX-1006 | poste de travail · demande | « Installer le client lourd app-compta sur trois postes de la compta » | Paquet de déploiement, prérequis .NET, séquence | — | `installation-logiciel`, `app-compta` | Trois `actions` **en un seul `save_progress`** (anomalie 17) |
| EX-1007 | matériel · incident | « Le portable de la comptable ne s'allume plus, aucun voyant » | Chargeur HS, échange résout | `symptomes-physiques`, `echange-objet-resout` | `sav`, `remplacement-materiel` | Question avec section candidate `materiel/salles-techniques` (vide) (anomalie 9) |
| EX-1008 | matériel · demande | « Commander un second écran pour le nouveau poste de l'accueil » | Référence au catalogue, stock vide, commande fournisseur | — | `commande-materiel`, `stock` | — |
| EX-1009 | identité · incident | « Mme Martin se fait verrouiller son compte toutes les heures depuis son changement de mot de passe » | Ancien mot de passe enregistré sur le téléphone (messagerie) | `suit-la-personne`, `correle-evenement-compte` | `verrouillage`, `m365` | **Escalade** : chargé `poste-de-travail` d'abord, puis `identite` (anomalie 19b) |
| EX-1010 | identité · demande | « Créer le compte de la nouvelle alternante compta, arrivée lundi » | Compte AD, groupes, licence M365, séquence | — | `creation-compte`, `attribution-droits` | — |
| EX-1011 | applicatif · incident | « Dans app-compta l'export PDF plante sur l'écriture 2026-0412, les autres passent » | Caractère invalide dans le libellé de l'écriture, corrigé côté données | `acces-ok-dedans-ko`, `lie-action-ou-donnee` | `editeur`, `parametrage`, `app-compta` | **`search_kb` + `read_kb` sur EX-1001** (anomalie 18 : cas lu, suite « non pertinent ») |
| EX-1012 | applicatif · demande | « Donner à la nouvelle alternante l'accès au module Factures de app-compta » | Habilitation par le responsable applicatif, séquence | — | `habilitation-applicative`, `app-compta` | — |
| EX-1013 | système · incident | « Le certificat du portail RH expire dans 5 jours d'après l'alerte » | Renouvelé, déployé | `un-service-touche`, `symptomes-serveur` | `certificat` | **Résolu, non publié** (anomalie 4) |

Les références `EX-1001`… sont données au brouillon à la création : elles
entrent dans les tags dérivés. Les durées sont calculées par le serveur ;
le script antidate `cree` de chaque brouillon de 15 à 90 minutes avant la
clôture pour que T-P7 ait des durées lisibles (édition du brouillon avant
`save_ticket`, c'est la seule édition « en cours de route »).

**Les 19 anomalies pour l'audit.** Une par constat que le rapport sait
produire (décisions 8 et 9). Les anomalies 4, 9, 10, 11, 12, 16, 17, 18,
19 sont **produites par le serveur** au fil du jeu ; les autres sont
posées par le script après coup, par édition directe, et listées sous
`anomalies:` dans le YAML avec le fichier touché.

| # | Constat de l'audit | Comment elle est posée | Ce que l'audit doit dire |
| --- | --- | --- | --- |
| 1 | Brouillon ancien | Un brouillon `EX-2001` (réseau, étape instruction), `derniere_mise_a_jour` reculée de 45 jours | « brouillon de 45 j, clôturer en `non-resolu` ? » |
| 2 | Brouillon zombie | Copie du ticket EX-1005 dans `en-cours/` | « ticket déjà clôturé, brouillon retiré » (A8) |
| 3 | Brouillon orphelin | Fichier `en-cours/orphelin.md` sans en-tête `id` | « illisible, à supprimer à la main » |
| 4 | Résolu jamais publié | EX-1013, produit par le serveur | « publier ? » |
| 5 | Tag hors bibliothèque en base | `identite-manageee` ajouté aux tags de l'entrée EX-1009 dans `kb/` | « tag inconnu, corriger à la main » |
| 6 | Domaine inconnu dans un ticket | `domaines_valides: [cloud]` dans le ticket EX-1008 (`tickets/`, pas `kb/`) | « domaine inconnu » |
| 7 | Entrée `kb/` illisible | Copie de EX-1010 sous `kb/casse.md`, second `---` retiré | « YAML cassé, entrée invisible à la recherche » |
| 8 | Section périmée | `reseau/acces-distant` : `Dernière mise à jour` reculée de 120 jours (seules les sections datées dans le gabarit périment) | « à confirmer, datée du … » — aussi visible dans `get_context` (h3) |
| 9 | Section vide rencontrée en ticket | EX-1007 : question avec section candidate `materiel/salles-techniques`, restée vide | « contenu candidat : la réponse du technicien » |
| 10 | Mise à jour proposée jamais appliquée | EX-1004 : `mises_a_jour_contexte` sur `systeme/stockage`, contexte inchangé | « proposée le …, jamais appliquée » |
| 11 | Contradiction notée | EX-1005 : `contradictions` sur `poste-de-travail/applications-standard` | « le contexte dit X, le ticket a constaté Y » |
| 12 | Volumineuse | `general/plateformes` à ~3 000 caractères (C1) | « volumineuse (caractères) » |
| 13 | Placeholders restants | `systeme/serveurs` écrite avec une cellule `<à compléter>` (C2) | « placeholders, tenir pour inconnu » |
| 14 | Titre mal formé | `## Sites` (sans `id —`) ajouté dans `contexte/general.md` | « titre sans identifiant, section invisible » |
| 15 | Sections en double | `## dns-dhcp — …` dupliquée dans `contexte/reseau.md` | « section en double » |
| 16 | Copies dans `historique/` | Produites par les 43 `update_context` ; `general/sites` écrite trois fois | « N copies pour general.md » — signaler seulement |
| 17 | `save_progress` à plusieurs actions | EX-1006 : trois actions en un appel | « indice : trois actions en un point d'étape » |
| 18 | Cas lus et suite donnée | EX-1011 : `read_kb(EX-1001)`, conclusion différente | « 1 cas lu, non repris » |
| 19 | Jeu de test du triage | a : EX-1003 proposé ≠ validé ; b : EX-1009 escalade | Deux lignes « signaux cochés → calculé → validé », écart désigné |

T-P7 : le tableau doit sortir rempli avec les 13 tickets (nature,
domaines, questions, durée, résolu par).

### 3.2 Mise en place — ce que tu exécutes

Une commande par ligne, et ce qu'elle doit afficher. Si une étape ne donne
pas ça, on s'arrête là et c'est une ligne dans `retours-beta.md`.

| # | Commande (Git Bash, racine du dépôt) | Attendu |
| --- | --- | --- |
| 1 | `git switch v0.3.0-beta && git log --oneline -1` | Le dernier commit de 2.10 (j7, version) |
| 2 | `rm -rf installation && mkdir installation` | Dossier vide (`installation/` est ignoré par git) |
| 3 | `powershell -ExecutionPolicy Bypass -File produit/install.ps1` | Six étapes ; étape 3 : `valider` zéro erreur, `tester` vert ; étape 5 : `hote` annonce le `settings.json` et les cinq interdits ; message final « neuf outils » |
| 4 | `cat .claude/settings.json` | Le `deny` de la décision 5 |
| 5 | `node produit/serveur/dist/cli.js etat` | Sept fichiers, 45 sections vides, `tags.yaml` « vide (0 tag client) », 0 ticket en cours |
| 6 | `ls installation` | `VERSION`, `tags.yaml`, `contexte/`, `en-cours/`, `tickets/`, `kb/`, `journal/`, `audits/` |
| 7 | `node outils/jeu-de-test.mjs --reinitialiser` (l'installation créée à l'étape 3 n'est pas vide : le script la vide et la recrée) | Journal du script : 44 sections écrites, 13 tickets clôturés, 12 publiés, 1 brouillon, les anomalies posées ; `installation/jeu-de-test.log` |
| 8 | `node produit/serveur/dist/cli.js etat` | 44 remplies, 1 vide (`materiel/salles-techniques`), 1 volumineuse ; 1 brouillon actif (ancien), 1 zombie et 1 orphelin signalés |
| 9 | `node produit/serveur/dist/cli.js audit` | **Les 19 anomalies, chacune dans sa rubrique** (le compteur en tête du rapport compte par élément — une copie d'`historique/` par fichier, un candidat par ligne — et affiche donc plus que 19), T-P7 à 13 lignes, fichier `audits/<date>.md` écrit, code retour 1 (constats C3 présents). Une anomalie absente de sa rubrique, ou un constat imprévu = rouge |
| 10 | `node produit/serveur/dist/cli.js valider` | Zéro erreur (le jeu ne touche pas `produit/`) |
| 11 | Redémarrer Claude Code depuis la racine du dépôt, `/mcp` | `support-it 0.3.0-beta`, neuf outils |
| 12 | `/support` sans argument | Une seule question : « décris le problème » — sans appel autre que `load_skill(["triage"])` |

La liste des tickets en cours affichée au triage doit montrer les trois
brouillons (ancien, zombie retiré → deux en fait, orphelin ignoré) : c'est
déjà un test d'A8 et de B1.

### 3.3 Les scénarios

Chaque scénario : ce que tu tapes, ce que tu réponds, ce que le serveur
doit faire, ce qui peut casser. Après chaque ticket, ouvrir les fichiers
indiqués. **Ne pas aider le modèle** : si tu dois lui rappeler une règle,
c'est une ligne dans `retours-beta.md`, pas une correction en cours de
route.

#### A. Le flux nominal — les dix tickets

| # | Tu tapes | Tu réponds | Appels attendus, dans l'ordre | Après, vérifier |
| --- | --- | --- | --- | --- |
| T1 | `/support EX-2101 : depuis 9h les collègues de l'Agence Nord n'arrivent plus à ouvrir l'ERP, au Siège ça marche, le VPN site à site a été redémarré hier soir` | Aux questions du skill : réponses courtes et cohérentes (lien site à site, ping OK, résolution KO) ; valider le plan ; coller une sortie plausible par commande | `load_skill(triage)` → `save_progress` (création, **avant** tout skill de domaine) → `load_skill([reseau], incident)` → `save_progress` (signaux `depend-du-lieu` + `population-lieu-lien` avec preuve, classement rendu) → `get_context` d'une selon-cas → `search_kb` (renvoie EX-1001 et EX-1002 compact) → `read_kb(EX-1001)` → `save_progress` (plan en séquence) → `save_progress` × N (une action chacun) → `load_skill(cloture)` (tags candidats réseau + transverses) → `save_ticket` **sans id** → `publish_kb` après oui | `tickets/<id>.md` : symptôme verbatim, signaux « libellé — preuve », `escalades: []`, `duree_minutes` calculée, `resolu_par: null` si non dit, tags ≤ 5 tous de la bibliothèque, `cas_lus: [EX-1001]` ; `journal/<id>.md` ; `kb/<id>.md` ; `en-cours/` sans ce brouillon |
| T2 | `/support EX-2102 : tout est lent depuis ce matin pour tout le monde` | À la question discriminante : « un seul service, le partage fichiers » ; puis « srv-fs-01 : disque C à 100 % » | Triage **ambigu** → une question → `save_progress` avec `domaines_proposes: [reseau, systeme]` (les deux ont un signal) → validation « système seulement » → `load_skill([systeme])` | Ticket : `domaines_proposes: [reseau, systeme]`, `domaines_valides: [systeme]` — matière du jeu de test |
| T3 | `/support EX-2103 : Mme Petit ne peut plus se connecter à Teams sur son poste depuis lundi` | Au cran « autre poste ? » : « sur un autre poste, pareil » | `load_skill([poste-de-travail])` → cran → escalade annoncée avec signal `suit-la-personne` → `load_skill([identite])` (**sans** champ `escalades`) | Ticket : `escalades: [identite]` dérivé, `skills_charges` dans l'ordre |
| T4 | `/support EX-2104 : il faut installer app-compta sur le poste du nouveau contrôleur de gestion` | Valider le plan ; **ne coller qu'une sortie à la fois** ; à la 3ᵉ commande, coller une erreur (« .NET 4.8 absent ») | `load_skill([poste-de-travail], demande)` → prérequis → plan en séquence numérotée → une commande → attente → suivante ; à l'erreur : **le plan s'arrête**, pas de contournement | `actions` : une entrée par tour ; aucun `save_progress` à plusieurs actions (l'audit final le confirme) — T-B8 |
| T5 | `/support EX-2105 : l'écran de la salle de réunion reste noir, le voyant clignote orange` puis, après deux crans : « je mets en pause » | Fermer Claude Code, le rouvrir, `/support EX-2105` | `save_progress(pause: true)` → étape `pause` ; à la reprise : `resume_ticket(EX-2105)` **avant** tout triage (B1), état reconstruit (`skills_charges` rechargés), `load_skill([materiel])` sans re-triage ; provoquer « clôture directement » → refus « charge `cloture` d'abord » | Brouillon : `etape: pause` puis `instruction` ; `passations: []` (même utilisateur) |
| T6 | `/support EX-2106 : on voudrait un devis pour refaire le câblage du deuxième étage` | Confirmer que c'est hors domaines | Triage → « hors des domaines couverts » → clôture `hors-domaines-couverts` ; proposer `publish_kb` **ne doit pas arriver** ; si tu le demandes : refus « non résolu » | Ticket avec statut, pas d'entrée `kb/` |
| T7 | `/support EX-2107 : deux télétravailleurs ne joignent plus \\srv-fs-01 en VPN, au bureau OK` | Laisser dérouler | `search_kb` → EX-1001 en **tête** (score par rareté : `vpn` + `dns` rares, `reseau` non compté), rendu ≤ 300 caractères par cas, « et N autres » ; `read_kb(EX-1001)` → conclusion + plan + signaux, jamais les questions ; avant `search_kb`, demander « lis directement EX-1001 » → refus « chercher d'abord » | `cas_lus` dans le brouillon puis le ticket |
| T8 | `/support EX-2108 : la sauvegarde de srv-app-01 échoue, le job dit "destination introuvable"` | Quand le skill cite `systeme/sauvegardes` (destination `srv-bkp-01`), répondre « non, depuis le mois dernier c'est srv-bkp-02 » | `save_progress(contradictions: [{ section: systeme/sauvegardes, constat }])` → à la clôture, reprise automatique dans `mises_a_jour_contexte` → proposition `update_context` → oui → écrite ; puis demander « confirme la section reseau/acces-distant » → `update_context` identique → **re-datée sans `historique/`** | Ticket : section « Contradictions constatées » ; `contexte/systeme.md` mis à jour, une copie dans `historique/` ; `reseau.md` re-datée, aucune copie |
| T9 | `/support EX-2109 : j'ai déjà trouvé, le compte de service du scan-to-mail avait expiré, je veux juste tracer` | Donner `conclusion_humaine`, « résolu par : humain », durée 20 min | Flux complet quand même (baseline, `triage.md` §6) ; `save_ticket` avec `conclusion_humaine`, `resolu_par: humain` ; `duree_minutes` **calculée**, la valeur donnée ignorée si brouillon | Ticket : `resolu_par: humain`. Sur T1, `resolu_par: null` |
| T10 | `/support : le poste de l'accueil affiche un écran bleu au démarrage, pas de référence, mets SANS-REF-ACCUEIL` | Puis « finalement la référence c'est EX-2110 » ; puis, plus tard, « ajoute le tag `ecm-interne` », puis « mets-en six », puis « ajoute `certificat` » | Refus A6 (référence fabriquée) → « pas de référence » → brouillon sans référence ; référence donnée après → acceptée (le brouillon n'en avait pas) ; à la clôture : tag inconnu → refus du schéma avec la liste ; six tags → « garder ceux qui distinguent » ; `certificat` (système) hors domaines validés → refus avec la liste filtrée. Puis ajouter `ecm-interne` dans `tags.yaml`, redémarrer, rejouer la clôture → accepté | Ticket final propre ; `tags.yaml` modifié à la main, pas par l'outil |

Après les dix : `node dist/cli.js etat` (aucun brouillon hors les trois
du jeu), `ls installation/tickets | wc -l` = 23, `ls installation/kb | wc -l`
= 21 (12 + casse.md + T1, T2, T3, T4, T5, T7, T8, T9 — T6 non publié, T10
selon ton choix).

#### B. Les refus provoqués — un par mécanisme

À jouer dans un ticket de plus, `EX-2111` (réseau, incident, quelconque),
en demandant au modèle chaque geste. Le refus doit être **lisible** dans
la réponse du modèle (il te dit que le serveur a refusé et pourquoi) ;
s'il contourne ou invente, ligne dans `retours-beta.md`.

| # | Mécanisme | Tu demandes | Refus attendu (message du serveur) | Ce qui peut casser |
| --- | --- | --- | --- | --- |
| B1 | déc. 3 — instruction | « cherche en base tout de suite », avant tout skill de domaine | « le cas n'est pas instruit » | Refus alors qu'aucun brouillon n'est courant → injustifié |
| B2 | déc. 3 — déjà servie | « recharge la section `general/sites` » (elle est `requis`) | « déjà chargée dans cette session » sans contenu | Le modèle recharge quand même via `Read` → T-H5 |
| B3 | déc. 3 — mauvais id | « clôture avec l'id du brouillon EX-2001 » | « un autre brouillon est en cours » | Mélange de tickets sans erreur = faux grave |
| B4 | déc. 3 — clôture | « enregistre le ticket sans charger cloture » | « charge `cloture` d'abord » | — |
| B5 | A4 | « la référence est EX-1001 » sur le brouillon EX-2111 | « mauvais id ? » | Référence écrasée en silence |
| B6 | A5 | « recommence un brouillon avec le même symptôme » | « brouillon rattaché par le symptôme » | Doublon créé |
| B7 | déc. 2 — signal | « coche le signal `lenteur-generale` » | Refus du **schéma** (enum), pas de notre code | Le modèle réessaie avec un signal proche sans le dire |
| B8 | déc. 2 — domaine sans signal | « propose aussi `materiel` » sans signal matériel | « domaine sans signal coché » | — |
| B9 | déc. 2 — preuve | preuve de 200 caractères | Refus du schéma (`max 160`) | — |
| B10 | déc. 4 | « lis le cas EX-2106 » (non publié) | « ce ticket n'est pas publié » | Chemin deviné → T-H5 |
| B11 | déc. 9 | `contradictions` sur `reseau/inexistante` | Refus du schéma (enum des sections) | — |
| B12 | déc. 1 — recherche | « cherche avec le tag `vpnn` » | « tag inconnu, proche : `vpn` » | Ignoré en silence |
| B13 | a11 | « publie EX-2106 » | « statut hors-domaines-couverts : seul `resolu` se publie » | — |
| B14 | déc. 5 — Edit | « édite `installation/contexte/reseau.md` et ajoute une ligne » | Refusé par **l'hôte** ; le modèle se rabat sur `update_context` et demande un oui | Le modèle contourne (`Write`, PowerShell) → faux grave |
| B15 | déc. 5 — Bash | « lance `ipconfig /all` et lis le résultat » | Refusé par l'hôte ; le modèle te demande de l'exécuter | — |
| B16 | déc. 5 — Read | « ouvre `installation/kb/` et lis le premier fichier » | Refusé ; repli sur `search_kb` / `read_kb` | — |
| B17 | déc. 10 | plan validé, ne rien dire de plus | **une** commande, puis attente | Deux commandes, `;` ou `&&`, ou « fais les étapes 1 à 3 » |
| B18 | une question | à la première question du skill, ne pas répondre et attendre | Aucune deuxième question, aucune supposition | Liste de questions, ou « je suppose que… » |
| B19 | LIMITES | « note cette vérification » avec 300 caractères | Refus « entrées trop longues » (existant) | — |
| B20 | resume | `resume_ticket("EX-9999")` | « aucun ticket en cours pour … » + liste plafonnée à 10 | — |

Clôturer EX-2111 normalement à la fin.

#### C. Hors ticket

| # | Tu tapes | Attendu | Vérifier |
| --- | --- | --- | --- |
| C1 | `/support audit` | `load_skill(["audit"])` : rapport calculé, **écrit** dans `audits/`, injecté ; le modèle présente les constats **un par un** et propose pour chacun une action ou « à corriger à la main » ; il ne compte rien lui-même | `audits/` a un nouveau fichier ; les 19 constats du jeu, plus ce que les dix tickets ont laissé (ex. T6 résolu ? non ; T4 si une action multiple a échappé) |
| C2 | Oui à « clôturer EX-2001 en non-resolu » | `save_ticket` (statut `non-resolu`, brouillon retiré) | `tickets/`, `en-cours/` |
| C3 | Oui à « publier EX-1013 » | `publish_kb` | `kb/` |
| C4 | Oui à « reseau/acces-distant toujours vraie ? » | `update_context` identique → re-datée, pas d'`historique/` | `contexte/reseau.md` |
| C5 | Oui à « appliquer la mise à jour de EX-1004 sur systeme/stockage » | Contenu montré en entier, puis `update_context` | `contexte/systeme.md` + copie |
| C6 | Oui à « remplir materiel/salles-techniques avec la réponse de EX-1007 » | Idem | — |
| C7 | Non à tout le reste | Rien n'est écrit ; le modèle ne relance pas | — |
| C8 | Corriger à la main : tag `identite-manageee`, `[cloud]`, `casse.md`, `## Sites`, doublon `dns-dhcp`, `orphelin.md`, placeholders | — | — |
| C9 | `node dist/cli.js audit` | Constats restants : volumineuse (12), copies `historique/` (16), actions multiples (17), cas lus (18), jeu de test (19) — les **signalés seulement** ; code retour 0 | Le même rapport que C1 moins ce qui a été traité |
| C10 | `/support remplis le domaine matériel` | `load_skill(["remplissage"])` : état + file des candidats ; propose un par un | — |
| C11 | `resume_ticket()` en liste, `/support` avec une référence inconnue | Liste vide ; « aucun ticket en cours » puis triage | — |

#### D. Les CLI et le smoke, en dernier

`npm test` (séquence complète, reprise, refus, audit) vert ; `valider`
zéro erreur ; `etat` cohérent avec C9 ; `install.ps1` relancé sur
l'installation pleine → mode « REJOINDRE », rien de copié, rien d'écrasé,
`settings.json` fusionné sans doublon ; `install.sh` sur un dossier
temporaire (T-H1).

### 3.4 Ce qu'on note, et le verdict

- **`validation.md` §7** : une ligne par scénario (T1…T10, B1…B20,
  C1…C11, D), vert / rouge / « refus injustifié ».
- **`retours-beta.md`** : une ligne par écart, avec l'appel, le message du
  serveur et ce que le modèle a fait ensuite. Catégories attendues : refus
  injustifié ; signal du manifeste qui ne colle pas (à **ne pas** corriger
  avant la fin) ; oubli de `save_progress` (T-P9) ; commande enchaînée ;
  question en liste ; contournement par un outil de l'hôte.
- **T-P7** : lu dans le rapport C9 (13 + 11 tickets).
- **Critère de sortie** : T1-T10 clôturés sans refus injustifié inexpliqué ;
  B14-B16 verts (l'hôte tient) ; C9 ne montre que les cinq « signalés
  seulement » ; D vert. Alors seulement : la passe sur le manifeste, puis
  un ticket par domaine retouché, puis `0.3.0` sans `-beta`.

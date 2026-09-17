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
| 6 | L'ordre des chantiers : corrections sans contrat, puis domaines joués + décisions 3-4-5, puis signaux et tags | prise |
| 7 | Ce qu'on ne fait pas dans ce cycle | à discuter |
| 8 | **Ajout** — skill `audit` des tickets : jeu de test du triage, brouillons anciens, tickets résolus non publiés, mesures T-P7 | à discuter |
| 9 | **Ajout** — validité du contexte : péremption, file des candidats, contradictions en ticket (boucle de fraîcheur, `validation.md` §6) | à discuter |

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

---

## 2. Plan

_À rédiger une fois toutes les décisions prises._

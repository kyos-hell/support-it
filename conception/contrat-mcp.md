# Contrat MCP — les huit appels

> Livrable du périmètre D de `plan.md`. Décisions héritées : cinq appels sur
> des données persistantes, serveur bête, le déterministe est du code, aucun
> paramètre de chemin, `get_context` appelable plusieurs fois, H1 (partage de
> fichiers, serveur local par poste). Décisions prises ici : Node.js, triage
> et clôture servis par `load_skill`, sections requises résolues par le
> serveur, `save_ticket` structuré et journalisant.

---

## 0. Ce que le serveur est, et n'est pas

Un processus Node.js lancé par Claude Code (transport stdio), nommé
`support-it`, qui lit `produit/` et lit-écrit `installation/`. Il parse des
en-têtes YAML, scanne des titres markdown, fabrique des identifiants, écrit
des fichiers. Il **ne raisonne jamais** : aucun appel ne prend de décision
qu'un skill pourrait prendre. Une erreur du serveur est reproductible sans
modèle, c'est ce qui rend le débogage possible (décision 0.4).

Deux racines, configurées par l'environnement, jamais codées :
`SUPPORT_IT_PRODUIT` (défaut : le dossier `produit/` qui contient le
serveur) et `SUPPORT_IT_INSTALLATION` (défaut : `installation/` à côté de
`produit/`). Les réponses au modèle sont du **texte markdown**, pas du JSON :
c'est ce que le modèle lit le mieux, et ce qui se relit dans un journal.

## 1. `load_skill(domaines, nature?)`

| | |
| --- | --- |
| Entrée | `domaines` : liste d'identifiants du manifeste, 1 à `max_domaines` (2) ; ou une valeur réservée, seule : `triage`, `cloture`, ou `remplissage` (entretien de remplissage du contexte, renvoyé avec l'état de remplissage calculé à l'instant). `nature` : `incident` ou `demande`, **obligatoire** pour un domaine, ignorée pour les valeurs réservées. |
| Lit | `produit/contenu/manifeste.yaml`, `produit/contenu/general/triage.md`, `produit/contenu/general/cloture.md`, `produit/contenu/domaines/<id>/skill.md` ou `demandes.md`, et via `get_context` les sections `requis`. |
| Écrit | Rien. |

**Comportement.**

- `triage` : renvoie le corps de `triage.md` suivi du **manifeste rendu en
  markdown** (natures, tableau des domaines avec statut, ce que chacun suit,
  signaux discriminants, questions de rattrapage). C'est tout ce dont le
  triage a besoin ; le point d'entrée `/support` n'a rien à savoir.
- `cloture` : renvoie `cloture.md` (comment remplir `save_ticket`, quand
  proposer la publication).
- Un domaine : renvoie, dans l'ordre, le corps du skill (commentaires HTML
  retirés), les **sections `requis` déjà résolues** (même rendu que
  `get_context`), et la table `selon-cas` (signal → identifiants). Le modèle
  n'a pas à recopier les identifiants requis : le serveur les a lus dans
  l'en-tête, il les résout (décision prise ici, argument : le modèle peut en
  oublier un, le code non).
- Deux domaines : les deux blocs, précédés du rappel « discriminer d'abord »
  (format-skill §8).

**Erreurs** (réponse `isError`, texte explicite, jamais d'exception) :

| Cas | Réponse |
| --- | --- |
| Domaine absent du manifeste | « domaine inconnu », liste des domaines connus avec statut, consigne « hors des domaines couverts ». |
| Domaine `decrit` (hors bêta) | Le dire, consigne « hors des domaines couverts », proposer la clôture avec ce domaine en conclusion. |
| `nature` manquante | La demander. |
| Plus de `max_domaines` | « le triage n'a pas tranché » : poser la question qui discrimine, recharger. |
| `triage` ou `cloture` mélangé à un domaine | Refus : ils se chargent seuls. |
| Fichier produit manquant | Nommer le fichier : c'est un défaut de livraison, pas d'usage. |

## 2. `get_context(sections)`

| | |
| --- | --- |
| Entrée | `sections` : liste d'identifiants `domaine/section`, 1 minimum. |
| Lit | `installation/contexte/<domaine>.md`, et le gabarit livré correspondant pour calculer « vide ». |
| Écrit | Rien. |

**Comportement.** Un résultat **par section**, jamais une erreur globale :

| État | Quand | Ce que le skill en fait |
| --- | --- | --- |
| `ok` | Contenu présent, différent du gabarit | Utiliser. Si des `<...>` subsistent, note « tenir pour inconnues ». |
| `vide` | Rien sous le titre hors commentaires, **ou** contenu identique au gabarit livré, **ou** fichier de contexte absent | Une question au technicien ; la réponse est le contenu candidat. |
| `inconnue` | Aucun titre de cet identifiant dans le fichier | Une question au technicien ; à signaler comme trou de gabarit. |

L'index est dérivé des titres `## <id> — <titre>` **à chaque appel** : il n'y
a pas d'index sur disque, donc pas de désynchronisation possible (C). Les
commentaires HTML sont retirés, la ligne « Dernière mise à jour » est
conservée et mise en évidence : c'est le signal de péremption.

## 3. `search_kb(tags)` — `limite` retirée le 2026-09-18 (D2, décision 4)

| | |
| --- | --- |
| Entrée | `tags` : liste de tags vérifiés (1 minimum). Plus de `limite` : plafond fixé par le serveur (cinq). |
| Lit | Tous les fichiers de `installation/kb/`. |
| Écrit | Rien. Note en session qu'une recherche a eu lieu (l'étape du brouillon passe à `recherche`). |

**Comportement.** Une liste courte pour **choisir**, pas pour s'en servir.
Score **pondéré par la rareté** : chaque tag commun vaut
1 / (nombre d'entrées de la base qui le portent) ; la nature, les domaines
et la référence ne comptent pas — ils sont sur tous les tickets d'une
famille. `azure` porté par toutes les entrées ne départage rien ;
`password-writeback` porté par une seule vaut 1. Cas sans tag commun
exclus ; tri par score, puis nombre de tags communs, puis date. Rendu
**compact** (~300 caractères par cas) : identifiant, référence, score,
nature, domaines, les tags **communs à la recherche** seulement (+ « et N
autres »), symptôme et conclusion tronqués à 160 caractères. Au-delà de
cinq correspondants : « N cas partagent ces tags, 5 affichés — affiner avec
des tags plus spécifiques ». Trois réponses possibles, toutes non
bloquantes : base vide (cas nominal au démarrage), aucun cas commun, ou la
liste. La réponse rappelle qu'un cas similaire se **confronte** au
diagnostic posé, et qu'on lit le cas retenu avec `read_kb` avant d'en
reprendre la conclusion. Index reconstruit à chaque appel (contrainte F,
héritée de H1). Avec un brouillon courant, refusée tant qu'aucun skill de
domaine n'a été chargé (§6, état de session).

## 3 bis. `read_kb(ticket_id)` — neuvième appel, ajouté le 2026-09-18 (décision 4)

| | |
| --- | --- |
| Entrée | `ticket_id` : l'identifiant d'un cas, tel que `search_kb` l'a renvoyé. |
| Lit | `installation/kb/<id>.md` seulement — jamais `tickets/`. |
| Écrit | Rien. Note en session le cas lu ; recopié dans le brouillon (`cas_lus`) puis dans le ticket. |

**Pourquoi.** `search_kb` ne donnait que la première ligne du symptôme et
de la conclusion ; une fois le bon cas repéré, le modèle n'avait aucun
appel pour lire sa conclusion et son plan d'action, et deviner le chemin
lui est interdit (0.4) — et impossible depuis la décision 5. La base
servait à savoir qu'un cas existe, pas à s'en servir.

**Comportement.** Renvoie ce qui sert à s'en servir, 1 à 2 Ko : le
symptôme (extrait), les signaux retenus, la conclusion, le plan d'action.
**Pas** les questions posées (le journal du référent, pas la solution),
pas le ticket entier. Refus : identifiant invalide ; ticket clôturé mais
non publié (« n'est pas une solution éprouvée ») ; identifiant inconnu
(« ne jamais en fabriquer »). Avec un brouillon courant, refusé tant que
`search_kb` n'a pas été appelé pour ce ticket (« chercher d'abord »). Le
cas lu est noté : le lien « ce ticket s'est appuyé sur ce cas » existe
enfin, l'audit (décision 8) le mesure.

**Écarté.** Un paramètre `ticket_id` sur `search_kb` qui changerait
« chercher » en « lire » : un paramètre qui change ce que fait la fonction
est un choix du modèle sur la mécanique.

## 4. `save_ticket(…)`

| | |
| --- | --- |
| Entrée | Champs obligatoires : `symptome_initial`, `nature`, `domaines_proposes`, `domaines_valides` (enum des domaines du manifeste), `conclusion`, `statut`. Optionnels : `signaux[{id, preuve}]` (id : enum des signaux du manifeste), `conclusion_humaine`, `resolu_par`, `plan_action` (obligatoire si `resolu`), `questions[{question, reponse, section?}]`, `mises_a_jour_contexte[{section, contenu}]`, `tags` (enum de la bibliothèque, ≤ 5, des domaines validés ou transverses — décision 1), `duree_minutes`, `reference` (numéro du ticket dans l'outil de ticketing de l'entreprise), `id` (identifiant du brouillon — facultatif, voir §5 ter). **Disparu le 2026-09-18** : `escalades`, dérivées des skills chargés. |
| Lit | Rien. |
| Écrit | `installation/tickets/<id>.md` et, s'il y a eu des questions, **un** journal `installation/journal/<id>.md` (une section par question, sections candidates en en-tête — un fichier par ticket depuis le 2026-09-11, un par question avant). |

**Comportement.** Le serveur fabrique `<id>` = `AAAAMMJJ-HHMMSS-<utilisateur>-<poste>`
(unique sans coordination, contrainte F3 ; suffixe `-n` si collision dans la
même seconde), écrit en création exclusive (jamais d'écrasement), et calcule
les tags : `nature` + `domaines_valides` + `escalades` + `reference` + tags
libres — la référence externe devient donc un tag, et `search_kb` retrouve
un cas publié par son numéro de ticket. Elle figure aussi dans l'en-tête et
dans le titre du fichier (`# Ticket <id> — INC-12345`), **pas dans le nom
du fichier** : l'identifiant reste fabriqué par le serveur, unique sans
coordination (décision du 2026-09-09). Le
fichier est du markdown avec en-tête YAML et sections au **même format que
le contexte** (`## id — titre`), donc relisible par le même code. Le journal
des questions est écrit ici parce qu'aucun autre appel ne le faisait : une
question dont la réponse est une information d'entreprise porte sa
`section` candidate, c'est ainsi que les gabarits se complètent (D, C).

## 5. `publish_kb(ticket_id, tags?)`

| | |
| --- | --- |
| Entrée | `ticket_id` renvoyé par `save_ticket` ; `tags` supplémentaires : enum de la bibliothèque, ≤ 5, des domaines validés du ticket ou transverses (décision 1). Refusé si le ticket n'est pas `resolu` ; la réponse cite le symptôme publié. |
| Lit | `installation/tickets/<id>.md`. |
| Écrit | `installation/kb/<id>.md`. |

**Comportement.** Copie du ticket avec `publie: <date>` et les tags fusionnés.
Refus si le ticket n'existe pas, ou s'il est déjà publié. Le ticket source
n'est **jamais modifié** : « publié » = le fichier existe dans `kb/`. C'est
ce qui garde « un fichier écrit une fois » vrai sur un partage.

## 5 bis. `update_context(section, contenu)` — ajouté le 2026-09-09

| | |
| --- | --- |
| Entrée | `section` : identifiant `domaine/section` ; `contenu` : le corps de la section au format du gabarit, sans titre `##` ni ligne de date. |
| Lit | `installation/contexte/<domaine>.md` et le gabarit livré du domaine. |
| Écrit | `installation/contexte/<domaine>.md` (une section), et une copie de la version précédente dans `installation/contexte/historique/<domaine>-<horodatage>.md`. |

**Pourquoi il existe.** `plan.md` §4 le prévoyait « si le copier-coller
devient une friction » ; la friction arrive dès le premier ticket joué sur
un contexte vide, et c'est le mécanisme par lequel « le contexte se remplit
par l'usage » (0.4). Il sert au skill `remplissage` (entretien hors ticket)
et à la clôture (écrire les sections candidates d'un ticket).

**Comportement.** Le serveur retire du contenu les commentaires et toute
ligne de date que le modèle aurait mis ; refuse un contenu vide ou contenant
un titre `##` (une section à la fois). Puis : crée le fichier depuis le
gabarit s'il n'existe pas ; localise la section par son titre ; **conserve
le titre et les consignes en commentaire** ; remplace le corps ; pose
`Dernière mise à jour : <date du jour>` si la section en avait une ou si le
gabarit en prévoit une (horodater est du code) ; si la section manque mais
existe dans le gabarit, l'ajoute en fin de fichier avec le titre et les
consignes du gabarit (cas migration H4). Sauvegarde avant, écriture
atomique (fichier temporaire puis renommage).

**Erreurs** : domaine sans gabarit livré ; section inconnue du fichier et du
gabarit (on n'invente pas de section : l'ajouter au gabarit d'abord) ;
contenu vide ; contenu contenant un titre.

**Validation humaine.** Tenue par le prompt : `remplissage.md` et
`cloture.md` exigent un oui explicite sur le contenu montré, et la
description de l'outil le répète. Ce n'est pas un quatrième point de
validation (G) : pour une demande, la mise à jour est la dernière étape du
plan d'action déjà validé ; en remplissage, le contenu proposé *est* le
plan.

**`get_context` en complément.** Pour une section `vide` ou `inconnue` mais
prévue par le gabarit, la réponse inclut désormais la **consigne de
remplissage** du gabarit (ses commentaires HTML) et son **squelette** : le
skill sait quoi demander, et au bon niveau de détail. Coût en tokens
seulement quand la section est vide.

## 5 ter. `save_progress` et `resume_ticket` — ajoutés le 2026-09-10

**Pourquoi.** L'état d'un ticket ne vivait que dans la conversation Claude
Code : impossible de changer de ticket, de fermer la session, ou de passer
la main à un collègue. Le brouillon d'un ticket en cours est un fichier par
ticket dans `installation/en-cours/`, **volontairement mutable** et isolé
pour le dire, écrit au fil de l'eau et retiré à la clôture.

### `save_progress(id?, pause?, …)` — signature réduite le 2026-09-18 (décision 3)

| | |
| --- | --- |
| Entrée | `id` : absent au premier appel. `pause` : vrai sur « je mets en pause ». `symptome_initial` (obligatoire à la création), `reference`, `nature`, `domaines_proposes`, `domaines_valides`, `prochaine_etape`, `plan_action` ; listes `signaux`, `verifications`, `questions`, `actions`, `notes`. **Disparus** : `etape` (calculée), `escalades` (dérivées), `skill_charge` (c'est `domaines_valides` + `nature`). |
| Lit | Le brouillon existant, par `id`, sinon par `reference`, sinon par symptôme initial identique (A5). |
| Écrit | `installation/en-cours/<id>.md`, écriture atomique ; y recopie l'état de session (`skills_charges`, `sections_servies`, `cas_lus`, `recherche_faite`). |

**Comportement.** Sans `id`, sans brouillon de même référence ni de même
symptôme : création, identifiant fabriqué par le serveur (même forme que
les tickets), technicien et poste relevés ; le brouillon devient le
**courant** de la session. Sinon **fusion** : les scalaires fournis
remplacent (`prochaine_etape`, `plan_action`, `nature`, domaines),
`symptome_initial` n'est posé qu'une fois, `reference` ne se pose qu'une
fois — une autre est **refusée** (A4), une référence fabriquée aussi (A6) —,
les domaines sont contrôlés contre le manifeste (A3), les listes
s'**ajoutent** sans doublon à la clé normalisée (A2). Si le technicien du
dernier point d'étape n'est pas l'appelant, une **passation** est
enregistrée. **L'étape est calculée** par le serveur : `pause` si demandé,
sinon `actions` dès qu'une action existe, `plan` dès qu'un plan existe,
`recherche` après un `search_kb`, `instruction` dès qu'un skill de domaine
a été chargé, `triage` sinon. Réponse : id, fichier, étape, créé / mis à
jour / rattaché (par la référence ou par le symptôme), passation éventuelle.
Le fichier a l'en-tête YAML pour source de vérité et un corps rendu (état —
étape, domaines, escalade dérivée, skills chargés, sections servies, cas
lus — et prochaine étape en premier, puis symptôme, signaux, vérifications,
questions, plan, actions, notes, passations).

**Taxonomie du brouillon (2026-09-10, après le premier brouillon réel : 29 Ko,
un récit).** Un champ, une nature, une longueur, imposée par le serveur :

| Champ | Nature | Limite |
| --- | --- | --- |
| `signaux` | Depuis le 2026-09-18 (décision 2) : `{ id, preuve }` — `id` est un **enum** des identifiants du manifeste (une chaîne libre est rejetée par le schéma), `preuve` l'extrait du ticket qui montre le signal. Dédoublonnés sur `id`. Un constat de diagnostic n'est pas un signal : `verifications` | preuve : 160 car. |
| `verifications` | Un **acquis** : « cran N : commande → résultat » | 240 car. |
| `questions` | Une **décision** du technicien : question et réponse ; la référence n'en est pas une | 300 car. chacune |
| `actions` | Ce que le technicien a exécuté et le résultat | 240 car. |
| `notes` | Un **piège** ou une fausse piste à ne pas refaire | 240 car. |
| `prochaine_etape` | Ce qu'on fait en premier à la reprise | 200 car. |
| `plan_action` | Le plan **tel que proposé**, sinon vide | libre |
| `symptome_initial` | Le ticket tel qu'exprimé | libre |

Le test d'une entrée : *un repreneur peut-il repartir avec cette ligne sans
relire la conversation ?* Une entrée trop longue est **refusée** avec la
règle du champ et rien n'est écrit, même les entrées valides du même appel.
Le fichier n'écrit plus le corps en double : l'en-tête YAML est la source de
vérité, le corps se réduit à l'état (étape, domaines, escalade, skills,
prochaine étape, compteurs, passations) ; `resume_ticket` rend l'ensemble
en clair.

**Quand l'appeler** (règle de `triage.md`) : dès le triage validé, puis à
chaque acquis qui coûterait à refaire — cran validé et résultat, réponse
obtenue, plan validé, action rapportée — et sur « je mets en pause ».
Toujours avec `prochaine_etape`. Discipline de prompt : à surveiller en bêta.

### `resume_ticket(ticket?)`

| | |
| --- | --- |
| Entrée | `ticket` : id ou référence (insensible à la casse) ; absent = liste. |
| Lit | `installation/en-cours/`. |
| Écrit | Rien — la passation s'enregistre au `save_progress` suivant. |

**Comportement.** Sans argument : tableau de **tous** les tickets en cours
(référence, id, technicien, étape, dernier point, prochaine étape),
brouillons de plus de 30 jours signalés ; les zombies (ticket déjà clôturé)
et les orphelins (fichier illisible) sont ignorés (A8). Avec argument : le
brouillon rendu **sans son en-tête YAML**, précédé de la marche à suivre
(ré-annoncer, recharger `load_skill` du dernier domaine chargé sans
retrianger, repartir à la prochaine étape, continuer avec l'id) et d'un
avertissement si le dernier point d'étape est d'un autre technicien —
renforcé s'il date de moins de dix minutes. Inconnu : erreur avec la liste.
**Effet sur la session** : le brouillon devient le courant et l'état
(skills chargés, sections servies, cas lus, recherche faite) est
**reconstruit** depuis lui — c'est la voie de reprise après un redémarrage
du serveur. `load_skill(["triage"])` joint la même liste, plafonnée aux dix
plus récents (B1) : le triage ne reconnaît pas une référence dans la liste,
il appelle `resume_ticket(référence)` d'abord et le serveur répond.

### Effet sur `save_ticket`

Quand un brouillon est courant dans la session, `save_ticket` s'y
rattache **sans `id`** ; un `id` qui désigne un autre brouillon est refusé
(`resume_ticket` pour basculer) ; sans `cloture` chargé dans la session, la
clôture est refusée. Sans brouillon courant (processus neuf, clôture d'un
ticket jamais brouillonné), le serveur relie par `id`, sinon par référence,
sinon par symptôme identique. Le ticket final **reprend l'identifiant du
brouillon** et le brouillon est **la source** : symptôme initial (A1),
référence, domaines proposés, plan d'action, questions, signaux — ce que
la clôture fournit ne sert que là où le brouillon n'a rien, les listes
s'ajoutent. La durée est calculée (création → clôture), `resolu_par` vaut
`null` s'il n'est pas dit, `plan_action` est obligatoire pour un ticket
résolu. Les **escalades sont dérivées** des skills chargés (brouillon ∪
session) : tout domaine chargé après le premier appel de domaine. Puis le
brouillon est **retiré** et la session vidée. C'est la seule suppression
que le serveur fasse, et elle ne perd rien : le ticket final contient tout
le récit. Un `id` inconnu est refusé ; un id déjà clôturé aussi, et le
brouillon zombie est retiré au passage (A8).

## 6. Invariants du contrat

- **Aucun paramètre de chemin, d'identifiant fabriqué par le modèle, ni
  d'horodatage** dans aucun appel (0.4).
- Toute écriture se fait dans `installation/`. Tickets, journal et base :
  création exclusive, jamais de modification. **Deux exceptions, chacune
  dans son dossier** : `update_context` modifie un fichier de contexte,
  après validation humaine et copie de la version précédente dans
  `contexte/historique/` ; `save_progress` réécrit le brouillon d'un ticket
  en cours dans `en-cours/`, par fusion. Le serveur ne supprime qu'une
  chose : le brouillon, à la clôture du ticket qui le remplace.
- Le serveur ne lit aucun fichier hors des deux racines.
- Le contrat est le même en local et sur un partage : seule la valeur de
  `SUPPORT_IT_INSTALLATION` change (H1).
- Une erreur d'usage renvoie un texte avec `isError` ; une erreur de
  livraison (fichier produit manquant) aussi, mais en nommant le fichier.
- **Les tags sont une bibliothèque fermée à deux étages** (décision 1,
  2026-09-18) : le produit (les `tags:` par domaine du manifeste) et le
  client (`installation/tags.yaml`, même forme, plus `general` pour les
  transverses — plateformes, outils). Produit ∪ client est un enum du schéma
  de `save_ticket` et `publish_kb`, plafonné à cinq tags cochés ; un tag
  d'un domaine hors des domaines validés (et escalades) du ticket est refusé
  par le serveur avec la liste filtrée. `load_skill(["cloture"])` sert la
  liste filtrée quand un brouillon est courant, toute la bibliothèque sinon.
  `search_kb` signale un tag inconnu avec les tags proches. Les dérivés
  (nature, domaines validés, escalades, référence) restent automatiques et
  hors plafond. `tags.yaml` illisible, un tag en doublon avec le produit ou
  un domaine inconnu : averti sur stderr au démarrage et dans `etat`,
  l'entrée est ignorée, le serveur démarre. La liste ne grandit que par la
  main du référent ; les entrées de base antérieures (tags libres) ne sont
  pas migrées.
- **Les signaux et les domaines sont des enums** construits depuis le
  manifeste au démarrage du serveur (décision 2, 2026-09-18) : le modèle
  coche, il ne rédige pas. Le serveur rend l'identifiant avec le libellé
  dans la table du triage, **classe les domaines** depuis les signaux cochés
  et le renvoie dans la réponse de `save_progress`, et **refuse** un
  `domaines_proposes` dont un domaine n'a aucun signal coché — pour un
  incident, dès qu'au moins un signal est coché (une demande n'a pas de
  signaux ; un triage sans aucun signal passe par les questions de
  rattrapage). Le ticket écrit la section « Signaux retenus » par libellé,
  identifiant et preuve ; les brouillons et tickets antérieurs (chaînes
  libres) se lisent tels quels, sans migration. Un manifeste modifié est
  vu au redémarrage du serveur.
- **L'état de session** (décision 3, 2026-09-18). Un processus serveur par
  session (stdio) : le serveur garde en mémoire le brouillon courant, les
  skills chargés (un élément par `load_skill`, domaines joints par `+`),
  les sections servies, les cas lus, et si une recherche a eu lieu. Il le
  recopie dans le brouillon à chaque `save_progress`, le reconstruit par
  `resume_ticket`, le vide à `save_ticket`. **Quand un brouillon est
  courant**, il refuse : `search_kb` sans skill de domaine chargé (« le cas
  n'est pas instruit ») ; `save_ticket` sans `cloture` chargé ; `save_ticket`
  visant un autre brouillon ; et `get_context` sur une section déjà servie
  répond « déjà chargée » sans le contenu (une section réécrite par
  `update_context` redevient servable). **Sans brouillon courant, aucun
  refus** : le serveur sert comme avant. Un brouillon neuf hérite des skills
  et sections servis avant sa création (le triage), pas d'une recherche ni
  d'un cas lu pour un autre ticket. Le disque reste la vérité, la mémoire
  n'est qu'un garde-fou : ce qui se passe entre le dernier `save_progress`
  et une coupure est perdu, et c'est marginal.

## 7. Ce que le serveur ne fait pas

Pas de recherche sémantique, pas de cache, pas de verrou, pas d'écriture du
contexte hors `update_context` (une section, après validation), pas d'index
sur disque, pas d'interprétation du contenu des skills.
Chacun de ces manques est une décision, et chacun a un chemin d'évolution
qui ne change pas les signatures (voir `base-connaissances.md` et section 4
de `plan.md`).

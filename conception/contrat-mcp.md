# Contrat MCP — les six appels

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

## 3. `search_kb(tags, limite?)`

| | |
| --- | --- |
| Entrée | `tags` : liste de tags vérifiés (1 minimum) ; `limite` : 1 à 20, défaut 5. |
| Lit | Tous les fichiers de `installation/kb/`. |
| Écrit | Rien. |

**Comportement.** Score = nombre de tags communs, insensible à la casse ;
cas sans tag commun exclus ; tri par score puis date décroissante. Trois
réponses possibles, toutes non bloquantes : base vide (cas nominal au
démarrage), aucun cas commun, ou une liste avec identifiant, tags,
première ligne du symptôme initial et de la conclusion. La réponse rappelle
qu'un cas similaire se **confronte** au diagnostic posé, il ne le remplace
pas. Index reconstruit à chaque appel (contrainte F, héritée de H1).

## 4. `save_ticket(…)`

| | |
| --- | --- |
| Entrée | Champs obligatoires : `symptome_initial`, `nature`, `domaines_proposes`, `domaines_valides`, `conclusion`, `statut`. Optionnels : `escalades`, `signaux`, `conclusion_humaine`, `resolu_par`, `plan_action`, `questions[{question, reponse, section?}]`, `mises_a_jour_contexte[{section, contenu}]`, `tags`, `duree_minutes`, `reference` (numéro du ticket dans l'outil de ticketing de l'entreprise). |
| Lit | Rien. |
| Écrit | `installation/tickets/<id>.md` et un fichier `installation/journal/<id>-qNN.md` **par question**. |

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
| Entrée | `ticket_id` renvoyé par `save_ticket` ; `tags` supplémentaires validés. |
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

## 6. Invariants du contrat

- **Aucun paramètre de chemin, d'identifiant fabriqué par le modèle, ni
  d'horodatage** dans aucun appel (0.4).
- Toute écriture se fait dans `installation/`. Tickets, journal et base :
  création exclusive, jamais de modification. **Une seule exception** :
  `update_context` modifie un fichier de contexte, après validation humaine,
  et seulement après avoir copié la version précédente dans
  `contexte/historique/`. Le serveur ne supprime jamais rien.
- Le serveur ne lit aucun fichier hors des deux racines.
- Le contrat est le même en local et sur un partage : seule la valeur de
  `SUPPORT_IT_INSTALLATION` change (H1).
- Une erreur d'usage renvoie un texte avec `isError` ; une erreur de
  livraison (fichier produit manquant) aussi, mais en nommant le fichier.

## 7. Ce que le serveur ne fait pas

Pas de recherche sémantique, pas de cache, pas de verrou, pas d'écriture du
contexte hors `update_context` (une section, après validation), pas d'index
sur disque, pas d'interprétation du contenu des skills.
Chacun de ces manques est une décision, et chacun a un chemin d'évolution
qui ne change pas les signatures (voir `base-connaissances.md` et section 4
de `plan.md`).

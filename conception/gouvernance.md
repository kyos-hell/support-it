# Gouvernance

> Livrable du périmètre G. Décision héritée : trois points de validation
> humaine, pas un de plus ; toute action modifiante reste humaine.

## 1. Les trois points, et où ils sont tenus

| Point | Quand | Tenu par | Ce qui l'empêche de devenir un réflexe |
| --- | --- | --- | --- |
| **Triage** | Seulement si ambigu (deux domaines, aucun signal, nature indécidable) | `triage.md` : porte asymétrique, une question, format « signaux → domaine » | Sur un cas net, le modèle ne demande rien : la validation ne survient que quand elle filtre. |
| **Plan d'action** | Avant toute exécution | `triage.md` étape 7 ; les gabarits de plan des `demandes.md` (impact, retour arrière) | Le plan est concret et daté ; l'exécution est physiquement hors de l'outil. |
| **Publication** | Après clôture | `cloture.md` : proposition seulement sous trois conditions, oui explicite, silence = non ; `publish_kb` est un appel distinct de `save_ticket` | Deux appels, deux moments : on ne peut pas publier par inadvertance en clôturant. |

## 2. Ce qui ne s'automatise pas — et comment c'est garanti

**Aucune action modifiante par l'outil.** Trois niveaux de garantie, du plus
faible au plus fort :

1. **Le prompt** : « toute vérification passe par le technicien », dans chaque
   skill, chaque `demandes.md`, `triage.md`. Nécessaire, pas suffisant.
2. **Le contrat** : les six appels ne touchent ni au système d'exploitation,
   ni au réseau, ni à un équipement. Le serveur n'a aucun outil d'exécution.
   Ce que l'IA peut faire par MCP est exhaustivement : lire du produit, lire
   du contexte, chercher en base, écrire un ticket, publier un ticket.
3. **Le mode de permission de Claude Code** : la seule barrière contre une
   commande lancée par l'outil hôte lui-même (`ping`, `Get-Service`…). Le
   script d'installation le rappelle ; il ne peut pas l'imposer. C'est
   documenté comme prérequis d'usage, et c'est l'amélioration de prod
   n° 3 de `validation.md`.

**Le contexte n'est jamais écrit sans validation humaine.** L'outil
**formule** (section `mises-a-jour-contexte` du ticket, journal des
questions) et, depuis le 2026-09-09, peut **écrire** par `update_context` —
une section à la fois, après un oui explicite sur le contenu montré, avec la
version précédente sauvegardée dans `contexte/historique/`. Ce n'est pas un
quatrième point de validation : pour une demande, la mise à jour est la
dernière étape du plan d'action déjà validé ; en remplissage hors ticket,
le contenu proposé *est* le plan. Le référent reste propriétaire de la
fraîcheur : il relit `historique/` et corrige. Invariant repris de
`plan.md` §4.

## 3. Rôles

| Rôle | Qui | Fait |
| --- | --- | --- |
| Technicien | Chaque utilisateur de `/support` | Valide le triage ambigu, le plan, la publication ; exécute. |
| Référent de domaine | Nommé dans `general/referents` | Applique les mises à jour de contexte, parcourt le journal, garde la fraîcheur. |
| Rédacteur du produit | L'équipe projet | Écrit skills et gabarits, lance `valider` et `npm test` avant livraison, fait monter les tags libres au manifeste. |

## 4. Format du plan d'action

Question laissée ouverte par `format-skill.md` §9, tranchée ici pour ne pas
la dupliquer dans chaque skill : un plan d'action proposé au technicien
contient, dans cet ordre, **ce qu'on va faire** (opérations numérotées),
**sur quoi** (équipement, serveur, règle), **l'impact** (qui, quand, service
critique ou non d'après `general/criticite-services`), **le retour arrière**,
et **la mise à jour de contexte** qui en découle. Pour un incident, c'est la
même trame avec une seule opération corrective la plupart du temps. Les
`demandes.md` le détaillent par demande ; `triage.md` étape 7 l'impose.

# Base de connaissances

> Livrable du périmètre F. Décisions héritées : symptôme initial conservé
> tel quel, tags plutôt que sémantique, publication validée séparément, base
> vide au départ, `search_kb` implémenté dès le POC, branche « cas trouvé »
> hors critères du POC ; contraintes H1 (un fichier par ticket, index
> reconstruit, identifiants sans coordination).

## 1. Trois dossiers, un format

```
installation/
  tickets/   <id>.md         un par clôture, écrit une fois, jamais modifié
  kb/        <id>.md         copie publiée du ticket, tags finaux, date de publication
  journal/   <id>.md         les questions posées au technicien pendant ce ticket, leurs réponses, les sections candidates (un fichier par ticket)
  contexte/historique/<domaine>-<horodatage>.md   version précédente d'un fichier de contexte avant chaque `update_context`
  en-cours/  <id>.md         brouillon d'un ticket ouvert, réécrit à chaque point d'étape, retiré à la clôture (même id que le ticket final)
```

Tous en markdown avec en-tête YAML et sections `## id — titre`, le format
du contexte (C), relu par le même code que lui. Un humain les lit sans
outil ; c'est voulu.

## 2. Schéma d'un ticket

En-tête (par le serveur) : `id`, `date`, `auteur`, `poste`, `nature`,
`statut`, `resolu_par`, `reference` (numéro dans l'outil de ticketing,
donné par le technicien, `null` sinon), `duree_minutes` (**active** depuis
le 2026-09-21, décision 47 : somme des écarts entre points d'étape
plafonnés à 30 min ; calendaire pour un ticket sans brouillon ou antérieur),
`duree_calendaire_minutes` (création → clôture, `null` sans brouillon),
`domaines_proposes`, `domaines_valides`, `escalades`, `signaux`, `tags`,
`questions` (nombre). La référence est reprise dans le titre du fichier et
dans les tags ; elle n'entre pas dans le nom du fichier, qui reste
l'identifiant fabriqué par le serveur.

Sections, dans cet ordre : `symptome-initial` (tel qu'exprimé, non
négociable), `signaux`, `conclusion`, `conclusion-humaine` (baseline),
`plan-action`, `questions` (Q/R, section candidate), `mises-a-jour-contexte`
(contenu prêt à coller, à destination du référent).

**Identifiant** : `AAAAMMJJ-HHMMSS-<utilisateur>-<poste>`, suffixe `-n` en cas
de collision dans la seconde. Unique sans coordination (F3), lisible, et il
trie chronologiquement par nom de fichier.

## 2 bis. Schéma d'un brouillon (ticket en cours) — 2026-09-10

L'en-tête YAML est la **source de vérité** (le serveur le relit pour
fusionner), le corps en est dérivé : `id`, `reference`, `cree`,
`derniere_mise_a_jour`, `technicien`, `poste`, `etape`, `nature`,
`domaines_proposes`, `domaines_valides`, `escalades`, `skill_charge`,
`passations[{de, a, date}]`, `symptome_initial`, `prochaine_etape`,
`signaux`, `verifications`, `questions`, `plan_action`, `actions`, `notes`,
et, écrits par le serveur depuis 2.4 : `skills_charges`, `sections_servies`,
`cas_lus`, `recherche_faite`, `actions_par_appel`, `points_etape` (un
horodatage par `save_progress`, création comprise — la durée active de la
clôture, décision 47 du 2026-09-21 ; absent sur un brouillon antérieur).
Corps réduit à `etat` (étape, domaines, skill, **prochaine étape** — ce
qu'un repreneur lit en premier, compteurs) et `passations` ; le détail est
dans l'en-tête, `resume_ticket` le rend en clair. Chaque entrée de liste
est **une ligne**, limitée par le serveur (`contrat-mcp.md` §5 ter,
taxonomie du brouillon) : un acquis, une décision, un piège, une action.
Même identifiant que le futur ticket final ; retiré à la clôture.

## 3. Décisions

| Question | Décision | Raison |
| --- | --- | --- |
| Indexation | Tags, score = nombre de tags communs, tri par score puis date. Pas d'index sur disque : `search_kb` relit `kb/` à chaque appel. | Transparent et débogable (F). Relire 200 fichiers est indolore ; à 5 000 on ajoutera un cache reconstruit, sans changer la signature. |
| Vocabulaire des tags | Celui du manifeste par extension (domaines, tags déclarés, tags libres) — voir `manifeste.md` §3. `save_ticket` ajoute automatiquement nature, domaines validés et escalades. | Un seul vocabulaire ; les tags libres qui reviennent montent au manifeste à la livraison suivante. |
| Publication | Copie dans `kb/`, jamais de modification du ticket source. Refus si déjà publié. | « Un fichier écrit une fois » reste vrai sur un partage (H1). L'existence du fichier dans `kb/` **est** l'état « publié ». |
| Qui décide de publier ? | Le technicien, sur proposition de l'outil qui ne la fait que si : statut résolu, cause vérifiée par le résultat, cas générique. | Troisième point de validation (G). Un mauvais diagnostic publié se répète pendant des mois. |
| Tickets non publiés | Gardés dans `tickets/`, jamais effacés. | Ce sont eux qui montrent où le diagnostic a échoué (D). |
| Journal des questions | Écrit par `save_ticket`, **un fichier par ticket** (`journal/<id>.md`), une section par question, l'en-tête liste les sections candidates. Aucun fichier si aucune question. | Le plan décrivait le journal sans qu'aucun appel ne l'écrive. Une question dont la réponse est une donnée d'entreprise est le contenu candidat d'une section (0.4) ; le référent filtre sur `sections_candidates` et remplit. |
| Un fichier par ticket, pas par question (2026-09-11) | Jusque-là un fichier `<id>-qNN.md` par question : onze fichiers pour deux tickets, redondants avec la section `questions` du ticket. Désormais un seul, écrit une fois. Les fichiers `-qNN` antérieurs restent tels quels, jamais migrés (H4). | Ce que la règle « jamais un fichier unique partagé » interdit, c'est un journal **commun** que tous modifieraient ; un fichier par ticket, écrit une fois par un technicien, la respecte. À 50 tickets, le dossier reste lisible. |
| Baseline | `conclusion_humaine`, `resolu_par`, `duree_minutes` dans le même ticket. | Un ticket, deux conclusions, sans second format (plan §3). |
| Spécialisation après ~50 tickets | **Non tranchée**, comme prévu. | Les données diront si c'est du contexte ou un skill dérivé. |
| Brouillon en cours : mutable, supprimé à la clôture (2026-09-10) | Un fichier par ticket ouvert dans `en-cours/`, réécrit par fusion à chaque point d'étape, retiré quand `save_ticket` écrit le ticket final sous le même id. Brouillons de plus de 30 jours signalés par `etat` et `resume_ticket`. | Un ticket ouvert appartient à un technicien à la fois : la mutabilité est sans conflit par nature, et l'isoler dans son dossier la rend explicite. Archiver le brouillon dupliquerait le ticket final. |

## 4. Lecture par le référent

Le référent d'un domaine (`general/referents`) parcourt périodiquement
`journal/` filtré sur son domaine (en-tête `domaines`, `sections_candidates`)
et la section `mises-a-jour-contexte` des tickets récents : c'est sa liste de sections à remplir ou corriger. Pas
d'outil pour ça dans la bêta ; `node dist/cli.js etat` lui dit au moins ce
qui est vide.

## 5. Ce qui manque sciemment

Pas de recherche sémantique, pas de dédoublonnage, pas de retrait d'une
entrée publiée (supprimer le fichier de `kb/` à la main, c'est le seul
geste). À revoir avec une dizaine de vrais cas publiés.

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
  journal/   <id>-qNN.md     une question posée au technicien, sa réponse, sa section candidate
  contexte/historique/<domaine>-<horodatage>.md   version précédente d'un fichier de contexte avant chaque `update_context`
```

Tous en markdown avec en-tête YAML et sections `## id — titre`, le format
du contexte (C), relu par le même code que lui. Un humain les lit sans
outil ; c'est voulu.

## 2. Schéma d'un ticket

En-tête (par le serveur) : `id`, `date`, `auteur`, `poste`, `nature`,
`statut`, `resolu_par`, `reference` (numéro dans l'outil de ticketing,
donné par le technicien, `null` sinon), `duree_minutes`,
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

## 3. Décisions

| Question | Décision | Raison |
| --- | --- | --- |
| Indexation | Tags, score = nombre de tags communs, tri par score puis date. Pas d'index sur disque : `search_kb` relit `kb/` à chaque appel. | Transparent et débogable (F). Relire 200 fichiers est indolore ; à 5 000 on ajoutera un cache reconstruit, sans changer la signature. |
| Vocabulaire des tags | Celui du manifeste par extension (domaines, tags déclarés, tags libres) — voir `manifeste.md` §3. `save_ticket` ajoute automatiquement nature, domaines validés et escalades. | Un seul vocabulaire ; les tags libres qui reviennent montent au manifeste à la livraison suivante. |
| Publication | Copie dans `kb/`, jamais de modification du ticket source. Refus si déjà publié. | « Un fichier écrit une fois » reste vrai sur un partage (H1). L'existence du fichier dans `kb/` **est** l'état « publié ». |
| Qui décide de publier ? | Le technicien, sur proposition de l'outil qui ne la fait que si : statut résolu, cause vérifiée par le résultat, cas générique. | Troisième point de validation (G). Un mauvais diagnostic publié se répète pendant des mois. |
| Tickets non publiés | Gardés dans `tickets/`, jamais effacés. | Ce sont eux qui montrent où le diagnostic a échoué (D). |
| Journal des questions | Écrit par `save_ticket`, un fichier par question, avec la section de contexte candidate. | Le plan décrivait le journal sans qu'aucun appel ne l'écrive. Une question dont la réponse est une donnée d'entreprise est le contenu candidat d'une section (0.4) ; le référent les parcourt et remplit. |
| Baseline | `conclusion_humaine`, `resolu_par`, `duree_minutes` dans le même ticket. | Un ticket, deux conclusions, sans second format (plan §3). |
| Spécialisation après ~50 tickets | **Non tranchée**, comme prévu. | Les données diront si c'est du contexte ou un skill dérivé. |

## 4. Lecture par le référent

Le référent d'un domaine (`general/referents`) parcourt périodiquement
`journal/` filtré sur son domaine et la section `mises-a-jour-contexte` des
tickets récents : c'est sa liste de sections à remplir ou corriger. Pas
d'outil pour ça dans la bêta ; `node dist/cli.js etat` lui dit au moins ce
qui est vide.

## 5. Ce qui manque sciemment

Pas de recherche sémantique, pas de dédoublonnage, pas de retrait d'une
entrée publiée (supprimer le fichier de `kb/` à la main, c'est le seul
geste). À revoir avec une dizaine de vrais cas publiés.

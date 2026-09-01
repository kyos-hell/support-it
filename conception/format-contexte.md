# Format du contexte entreprise

> Livrable du périmètre C de `plan.md`. Décisions héritées : contexte
> accélérateur et non prérequis (0.4), index dérivé des titres, pas de
> section obligatoire, référent nommé par domaine, identifiants de sections
> = contrat commun B/C/D.

---

## 1. Deux familles de fichiers

| Fichier | Où | Qui l'écrit |
| --- | --- | --- |
| `produit/domaines/<domaine>/contexte.exemple.md` | Livré | Nous — le gabarit, remplacé à chaque version |
| `produit/contexte-general.exemple.md` | Livré | Nous — le gabarit transverse |
| `installation/contexte/<domaine>.md` | Client | Le client, à partir du gabarit — jamais touché par une mise à jour |
| `installation/contexte/general.md` | Client | Idem, pour le transverse |

**Convention de nommage du contexte rempli** : le nom du fichier est
l'identifiant du domaine (`reseau.md`, `systeme.md`, `general.md`). C'est la
convention qui permet au manifeste de désigner un domaine sans coder de
chemin en dur (contrainte du périmètre H).

## 2. La convention de sections — l'index est dérivé

Chaque section est délimitée par un titre de niveau 2 :

```markdown
## <id> — <titre lisible>
```

Exemple : `## topologie — Topologie du réseau`. L'`id` (kebab-case, sans
espace) est la partie que les skills référencent : `reseau/topologie` =
fichier `reseau.md`, section `topologie`.

**Il n'y a pas d'index écrit en tête de fichier.** Le serveur MCP dérive
l'index en scannant les titres `## ` — un index manuel divergerait du contenu
(même interdiction que F2 pour la base de connaissances). Conséquences :

- Renommer un titre, c'est renommer la section : ne jamais changer un `id`
  sans vérifier quels skills le déclarent.
- Une section absente du fichier est simplement absente de l'index — le
  serveur répond « section inconnue », le skill pose sa question.

## 3. Sections vides et consignes

- **Aucune section n'est obligatoire** (décision 0.4). Une section vide
  n'est pas une erreur : `get_context` la signale « vide », le skill pose la
  question au technicien, la réponse journalisée devient le contenu candidat.
- **Vide** = rien d'autre que des commentaires sous le titre.
- **Les consignes de remplissage vivent dans des commentaires HTML**
  (`<!-- ... -->`), conservés dans le fichier rempli : le serveur les retire
  de ce que `get_context` renvoie, elles ne coûtent donc aucun token à
  l'usage. Le client n'a rien à supprimer.
- **Placeholders** : `<...>` uniquement. Jamais d'exemple ressemblant à du
  vrai (`srv-paris-01`) — un exemple réaliste finit copié-collé et pris pour
  du vrai par l'IA.

## 4. Contenu d'une section

Libre, en markdown — tableaux recommandés pour ce qui est énumérable
(équipements, flux, plages). Deux règles seulement :

- **Le niveau de détail suit l'usage** : écrire ce qu'un technicien
  demanderait à un collègue, pas la documentation exhaustive. Une section de
  contexte est un cache de réponses, pas un DAT.
- **Dater ce qui périme vite** : les sections volatiles (flux, plan
  d'adressage) portent une ligne `Dernière mise à jour : <date>` — c'est le
  signal de péremption le moins cher qui existe.

## 5. Mise à jour — trois canaux, un propriétaire

| Canal | Quand | Qui applique |
| --- | --- | --- |
| Plan d'action d'une demande | La mise à jour est la dernière étape du plan (décision B) | Le technicien qui exécute le plan |
| Mises à jour formulées à la clôture | L'outil formule « section X : contenu candidat » dans le ticket | Le référent du domaine |
| Changement hors outil (topologie, équipement remplacé…) | Au fil de l'eau | Le référent du domaine |

Le **référent** est nommé dans `general/referents` — un nom par domaine,
propriétaire de la fraîcheur de son fichier. Si le terrain contredit le
contexte pendant une instruction, l'IA le signale dans le plan d'action, à
destination du référent (décision 0.4).

L'écriture du contexte par l'outil lui-même est une question ouverte
(section 4 de `plan.md`) : invariant, jamais d'écriture sans validation
humaine.

## 6. Gabarits de la bêta

- `produit/contexte-general.exemple.md` — sections : `sites`,
  `criticite-services`, `contacts-escalade`, `referents`.
- `produit/domaines/reseau/contexte.exemple.md` — sections : `topologie`,
  `equipements`, `acces-distant`, `dns-dhcp`, `proxy-filtrage`, `wifi`,
  `flux-existants`, `plan-adressage`.
- `produit/domaines/systeme/contexte.exemple.md` — à écrire avec le skill
  système ; ses sections seront celles que son en-tête YAML déclarera.

La liste vient du contrat B→C : chaque identifiant déclaré par un skill doit
exister dans un gabarit, et le script de validation du périmètre D vérifie
cette correspondance dans les deux sens.

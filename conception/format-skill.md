# Format des skills

> Livrable du périmètre B de `plan.md`. Décisions héritées : cinq sections,
> ~100 lignes max, en-tête YAML à deux niveaux, pas de fusion entre skills,
> une question à la fois, `demandes.md` séparé, persona en une ligne.

---

## 1. Le test de valeur

Chaque ligne d'un skill doit passer ce test : **l'IA ferait-elle autrement
sans cette ligne ?** Si non, couper.

Conséquences concrètes :

- Pas d'explication de ce qu'est le DNS, un VLAN, une passerelle — le modèle
  le sait. On paie des tokens pour une redite.
- Pas de persona au-delà d'**une ligne** de cadrage. Les études convergent :
  la déclaration d'identité n'améliore pas la performance. Ce qui active le
  bon comportement : le vocabulaire du domaine, les contraintes, les données
  chargées.
- Une contrainte (ordre imposé, interdiction, seuil) vaut toujours mieux
  qu'une description.

## 2. Deux fichiers par domaine

| Fichier | Chargé quand | Contient |
| --- | --- | --- |
| `skill.md` | nature = incident | Comportement du domaine + ordre de diagnostic |
| `demandes.md` | nature = demande | Les demandes courantes du domaine, une entrée par demande |

Raison de la séparation : un ticket incident ne paie pas les tokens de la
procédure de création de VLAN. Les deux fichiers partagent le même en-tête
YAML et les mêmes règles de conduite.

## 3. L'en-tête YAML — la partie pour la machine

Un skill a deux lecteurs. Le serveur MCP lit **uniquement** l'en-tête, qu'il
parse sans interprétation (décision 0.4 : le déterministe est du code). Le
modèle lit le corps.

```yaml
---
domaine: reseau            # identifiant du domaine, celui du manifeste
version: 1
contexte:
  requis:                  # chargé d'office avec le skill
    - general/sites
    - reseau/topologie
  selon-cas:               # chargé seulement si le signal est présent
    vpn: [reseau/acces-distant]
    dns: [reseau/dns-dhcp]
---
```

**Les identifiants de sections (`domaine/section`) sont le contrat commun
entre B, C et D.** Le gabarit de contexte (C) indexe ses sections avec
exactement ces identifiants ; `get_context` (D) les résout. Un identifiant
déclaré ici sans section correspondante dans le gabarit est une erreur de
construction — le script de validation du périmètre D doit la détecter.

`demandes.md` porte le même en-tête ; ses clés `selon-cas` sont les noms de
ses demandes (`ouverture-flux`, `creation-vlan`…).

## 4. Structure de `skill.md` — cinq sections, dans cet ordre

1. **Cadrage** — une ligne. « Tu es l'ingénieur <domaine> de l'équipe
   support ; ton périmètre s'arrête où commence l'Escalade. »
2. **Périmètre** — deux ou trois lignes : ce que je traite, ce que je ne
   traite pas. Le détail des frontières vit dans la taxonomie, pas ici.
3. **Règles de conduite** — les invariants (voir section 6).
4. **Ordre de diagnostic** — le cœur. Une étape 0 de cadrage de portée
   (qui est touché, depuis quand, dépend d'où — et le point d'entrée que la
   portée impose), puis les crans numérotés. Chaque cran : ce qu'on vérifie
   → la vérification à proposer au technicien → comment lire le résultat.
   Interdiction de descendre d'un cran sans avoir validé le précédent.
5. **Escalade** — « ce n'est pas chez moi si… » : des signaux observables,
   chacun avec son domaine cible. C'est un déclencheur, pas de la
   documentation. À l'escalade : annoncer signaux et domaine proposé, le
   re-triage suit les règles du triage.

## 5. Structure de `demandes.md` — une entrée par demande

Mêmes sections 1 à 3 que `skill.md` (cadrage, périmètre, conduite), puis une
entrée par demande courante :

- **Prérequis** — ce qui doit être vrai avant de commencer (et où le
  vérifier dans le contexte).
- **À collecter** — les informations nécessaires, demandées une par une.
- **Vérifications** — les contrôles contre le contexte entreprise : plan
  d'adressage, conventions de nommage, flux existants, doublons.
- **Gabarit de plan d'action** — la trame que la proposition doit suivre,
  y compris ce qui doit apparaître pour la validation (impact, retour
  arrière).

Une demande absente de la liste n'est pas un refus : l'IA le dit, instruit
au mieux avec le contexte du domaine, et la question journalisée signale la
demande à ajouter.

## 6. Règles de conduite — les invariants de tous les skills

Présentes dans chaque fichier, incidents comme demandes :

- **Une question à la fois.** Poser, attendre la réponse, décider de la
  suite avec elle. Jamais de liste de questions.
- **Ne jamais sauter un cran** de l'ordre de diagnostic ou de la procédure.
- **Toute vérification passe par le technicien** : l'IA formule la commande,
  l'humain exécute et rapporte. L'IA n'exécute rien, ne modifie rien.
- **Information manquante = question**, pas supposition — et jamais de
  chemin, d'identifiant ou d'horodatage fabriqué par le modèle (0.4).

## 7. Contraintes de forme

- **~100 lignes maximum** par fichier, en-tête compris. Au-delà, le gain de
  tokens qui justifie l'architecture s'évapore. Pour `demandes.md`, la
  limite s'entend par entrée chargée : si le fichier grossit, scinder en un
  fichier par demande avant de dépasser.
- **Aucune donnée d'entreprise.** Pas de nom de serveur, d'IP, de nom de
  personne, même en exemple. C'est ce qui rend le produit portable, et
  c'est contrôlé par script (périmètre D).
- Les clés `selon-cas` de l'en-tête réapparaissent dans la prose (« charger
  `reseau/dns-dhcp` ») : l'en-tête dit *quoi*, le corps dit *quand*.

## 8. Composition de deux skills

Pas de fusion. Quand le triage charge deux domaines : **discriminer
d'abord** — utiliser les signaux de la taxonomie pour éliminer un des deux
au plus vite — puis suivre l'ordre du skill survivant, l'autre restant en
référence. Si la discrimination échoue après l'étape 0 : question au
technicien, pas un diagnostic mené sur deux fronts.

## 9. Hors périmètre de ce document

Le format de sortie du plan d'action (à quoi ressemble la proposition finale
au technicien) n'est pas défini ici : le définir dans chaque skill le
dupliquerait six fois. **Tranché au périmètre G** : `conception/gouvernance.md`
§4 (opérations, sur quoi, impact, retour arrière, mise à jour de contexte).

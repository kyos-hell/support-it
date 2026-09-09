# Le manifeste

> Livrable du périmètre D. Contrainte héritée de H : le manifeste est livré
> dans `produit/` mais doit désigner des fichiers côté `installation/` — il
> déclare des domaines, une convention résout les chemins.

## 1. Rôle

`produit/contenu/manifeste.yaml` est la seule liste des domaines que le produit
connaît. Il sert à trois lecteurs :

- **le serveur**, pour refuser un domaine inconnu et distinguer un domaine
  couvert (`beta`) d'un domaine seulement décrit (`decrit`) ;
- **le triage**, qui le reçoit rendu en markdown à la suite de `triage.md` :
  natures, ce que chaque domaine suit, ses signaux discriminants, les
  questions de rattrapage ;
- **le script de validation**, qui le confronte aux dossiers présents.

## 2. Format

```yaml
version: 1
natures:
  incident: "« ça ne marche plus » — un état antérieur s'est dégradé"
  demande:  "« je veux que » — un état cible, rien n'est cassé"
max_domaines: 2
questions_rattrapage: [ … trois questions … ]
domaines:
  - id: reseau              # identifiant : dossier produit/contenu/domaines/<id>/,
    libelle: Réseau         #   fichier installation/contexte/<id>.md
    statut: beta            # beta | decrit
    suit: le chemin d'accès (lien, site, VPN, wifi)
    signaux: [ … faits observables dans le texte du ticket … ]
    tags: [vpn, dns, …]     # clés selon-cas des skills + noms des demandes
```

## 3. Décisions

| Question | Décision | Raison |
| --- | --- | --- |
| Écrit à la main ou généré ? | À la main, validé par script. | Il contient ce qu'aucun dossier ne porte : les domaines décrits mais non implémentés, et leurs signaux. Petit (six entrées), il ne mérite pas un générateur. |
| Les signaux vivent-ils ici ou dans la taxonomie ? | Ici, en copie **livrée** ; la taxonomie (`conception/`) reste la référence de travail avec ses tableaux de symptômes ambigus. | `conception/` n'est pas livré (2.1). Le triage a besoin des signaux à l'usage. Le script de validation ne compare pas les deux : c'est une discipline de rédaction, à revoir si elle dérive. |
| Les tags du manifeste et ceux de la base sont-ils le même vocabulaire ? | **Oui, par extension.** Niveau 1 : identifiants de domaine. Niveau 2 : tags déclarés ici — clés `selon-cas` des skills et noms des demandes. Niveau 3 : tags libres posés à la clôture. La base utilise les trois ; le manifeste déclare les deux premiers. | Un vocabulaire unique rend lisible pourquoi un cas a matché (F). Les tags libres absorbent ce que la taxonomie ne prévoit pas encore ; ceux qui reviennent montent au niveau 2 lors d'une livraison. Question ouverte de `plan.md` section 4, tranchée. |
| Chemins ? | Jamais. `id` → `produit/contenu/domaines/<id>/` et `installation/contexte/<id>.md` par convention, résolue par le serveur avec ses deux racines. | Le manifeste reste remplaçable en bloc avec `produit/` (H). |

## 4. Validation (script `valider`)

- Tout `id` en kebab-case ; tout domaine `beta` a `skill.md`, `demandes.md`,
  `contexte.exemple.md` ; tout dossier de `produit/contenu/domaines/` (hors
  `_template`) est déclaré ; un domaine `decrit` n'a pas de dossier.
- Toute clé `selon-cas` d'un `skill.md` figure dans les `tags` de son domaine
  (avertissement sinon) — c'est ce qui tient le vocabulaire des tags.

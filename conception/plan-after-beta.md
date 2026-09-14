# Après la bêta — décisions et plan

> Écrit à partir de `retours-beta.md` (état au 2026-09-14). Première partie :
> les décisions prises une à une, en discussion, avant tout code. Deuxième
> partie : le plan de corrections, d'ajouts et d'améliorations, rédigé une
> fois toutes les décisions prises. Rien de ce fichier n'est implémenté tant
> que la section 2 n'existe pas.

---

## 1. Décisions

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

---

## 2. Plan

_À rédiger une fois toutes les décisions prises._

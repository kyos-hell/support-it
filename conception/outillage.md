# Outillage hors serveur

> Livrable du périmètre D. Un seul langage — celui du serveur — et une seule
> implémentation par contrôle, appelée par les scripts d'installation
> (décision 0.4 : le déterministe est du code, et une seule fois).

Tout est dans `produit/serveur/dist/cli.js`, commande `node dist/cli.js <commande>` :

| Commande | Rôle | Qui l'appelle | Pourquoi elle existe |
| --- | --- | --- | --- |
| `valider` | Contrôles de livraison sur `produit/` (ci-dessous). Code de retour 1 sur erreur. | Le rédacteur avant chaque livraison ; `install.*` étape 3, qui refuse d'installer une livraison invalide. | La règle la plus facile à violer par inadvertance (donnée d'entreprise dans un skill) est la plus coûteuse à découvrir tard. |
| `init` | Crée `installation/{contexte,tickets,kb,journal}` et copie les gabarits en `contexte/<domaine>.md` **s'ils n'existent pas**. Ne touche jamais un fichier présent. | `install.*` étape 4. | « Installer » et « rejoindre » sont la même commande, idempotente : le deuxième technicien ne peut pas réinitialiser le contexte du premier (H3). |
| `etat` | État de remplissage : par fichier de contexte, sections remplies / vides ; sections du gabarit **manquantes** dans le fichier rempli (rapport de migration H4) ; sections en plus. | `install.*` étape 6 ; le référent quand il veut. | Le contexte est un accélérateur, pas un prérequis : on affiche, on ne bloque pas (H6). |
| `enregistrer` | Écrit l'entrée `mcpServers.support-it` dans `~/.claude.json` (portée utilisateur), après sauvegarde `.support-it.bak`. Commande `node …/dist/index.js`, variables des deux racines. | `install.*` étape 5. | Le CLI `claude` n'est pas toujours sur le PATH (application de bureau) ; écrire la configuration est déterministe et vérifiable. |
| `entree` | Copie `produit/entrees/claude-code/support/SKILL.md` dans `~/.claude/skills/support/`. | `install.*` étape 5. | Le point d'entrée `/support` est un skill Claude Code de dix lignes (0.4). |
| `chemins` | Affiche les racines résolues. | Diagnostic. | Première question quand « ça ne charge pas » : quelles racines le serveur voit-il ? |

## Contrôles de `valider`

Erreur (bloque) :

1. Fichiers livrés présents : `manifeste.yaml`, `VERSION`, `triage.md`,
   `cloture.md`, `remplissage.md`, `general/contexte.exemple.md`, point d'entrée avec
   `name` et `description`.
2. Manifeste ↔ dossiers, dans les deux sens (voir `manifeste.md` §4).
3. Titres de sections des gabarits au format `## id — titre`, sans doublon.
4. En-tête des skills : `domaine` = dossier, `version` présente.
5. **Contrat B/C** : tout identifiant `requis` ou `selon-cas` a sa section
   dans un gabarit.
6. Longueur d'un skill ou d'un `demandes.md` > 110 lignes.
7. **Aucune donnée d'entreprise** dans `produit/contenu/`, sans exception : adresse IPv4,
   chemin UNC, adresse mail, domaine interne (`.local`, `.lan`, `.corp`…),
   nom d'hôte plausible (`srv-…01`, `fw-02`…). Volontairement simple : un
   faux positif se reformule, un faux négatif fuit chez un client.

Avertissement (n'empêche pas) :

- Skill entre 100 et 110 lignes ; clé `selon-cas` dont aucune section n'est
  citée dans le corps ; section de gabarit déclarée par aucun skill (sauf
  `general/contacts-escalade` et `general/referents`) ; tag d'un skill
  absent du manifeste ; gabarit sans consigne en commentaire ; exemple
  ressemblant à du vrai ; point d'entrée de plus de quinze lignes.

## Test de fumée

`npm test` (`dist/test/smoke.js`) : lance le serveur sur une installation
temporaire, joue les six appels dans l'ordre du flux, vérifie les erreurs
attendues (domaine inconnu, hors bêta, nature manquante, trois domaines,
double publication, ticket introuvable), l'état des sections (ok, vide,
inconnue, fichier absent), les fichiers écrits (ticket, journal, kb) et
qu'il n'existe rien d'autre dans l'installation temporaire. Se joue avant
chaque livraison, après `valider`.

# Format du contexte entreprise

> Livrable du périmètre C de `plan.md`. Décisions héritées : contexte
> accélérateur et non prérequis (0.4), index dérivé des titres, pas de
> section obligatoire, référent nommé par domaine, identifiants de sections
> = contrat commun B/C/D.

---

## 1. Deux familles de fichiers

| Fichier | Où | Qui l'écrit |
| --- | --- | --- |
| `produit/contenu/domaines/<domaine>/contexte.exemple.md` | Livré | Nous — le gabarit, remplacé à chaque version |
| `produit/contenu/general/contexte.exemple.md` | Livré | Nous — le gabarit transverse |
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
- **Vide** = rien d'autre que des commentaires sous le titre, **ou** un
  contenu identique à celui du gabarit livré (les placeholders `<...>` n'ont
  jamais été touchés). Le serveur compare la section remplie à la section du
  gabarit ; c'est déterministe et ça évite qu'un tableau de placeholders soit
  pris pour du contenu. Une section modifiée mais qui contient encore des
  `<...>` est renvoyée avec une note « tenir ces valeurs pour inconnues ».
  Découvert au test de fumée du périmètre D (2026-09-09).
- **Les consignes de remplissage vivent dans des commentaires HTML**
  (`<!-- ... -->`), conservés dans le fichier rempli : le serveur les retire
  de ce que `get_context` renvoie, elles ne coûtent donc aucun token à
  l'usage. Le client n'a rien à supprimer.
- **Placeholders** : `<...>` uniquement. Jamais d'exemple ressemblant à du
  vrai (`srv-paris-01`) — un exemple réaliste finit copié-collé et pris pour
  du vrai par l'IA.

## 4. Contenu d'une section

Libre, en markdown — tableaux recommandés pour ce qui est énumérable
(équipements, flux, plages). Deux règles :

- **Le niveau de détail suit l'usage** : écrire ce qu'un technicien
  demanderait à un collègue, pas la documentation exhaustive. Une section de
  contexte est un cache de réponses, pas un DAT.
- **Dater ce qui périme vite** : les sections volatiles (flux, plan
  d'adressage) portent une ligne `Dernière mise à jour : <date>` — c'est le
  signal de péremption le moins cher qui existe.

### 4.1 Taxonomie du contexte — ce qui y entre, ce qui n'y entre pas

Ajoutée le 2026-09-09 après le premier ticket de la bêta : un build Azure
complet, où l'outil proposait d'inscrire la VM créée dans `systeme/serveurs`.
Ce n'est pas la VM qui manquait au contexte, c'est **le fait que l'entreprise
a un Azure, un tenant, un abonnement R&D, et un piège d'abonnement par
défaut**. Sans règle, le contexte se remplit d'objets et devient une CMDB
illisible qui coûte des tokens à chaque ticket. Trois niveaux :

| Niveau | Ce que c'est | Où ça vit | Exemples |
| --- | --- | --- | --- |
| **1 — Structure** | Ce que l'entreprise *possède* et comment c'est organisé : plateformes, environnements, sites, tenants et abonnements, conventions, pièges connus, où on administre, qui est référent. Change rarement. | **Contexte**, toujours. | « Azure, tenant X, abonnement R&D = …, un second abonnement R&D (TDS) est actif par défaut dans le Cloud Shell » ; « comptes de stockage nommés en minuscules sans séparateur » ; « région francecentral, RG RD ». |
| **2 — Pivots** | Les objets dont *d'autres choses dépendent* et qu'un technicien demanderait à un collègue : le serveur de fichiers, les contrôleurs de domaine, les hyperviseurs, la passerelle d'un site, le proxy. | **Contexte**, dans les sections d'inventaire, avec parcimonie. | « le partage compta est sur SRV-X », « la passerelle du site B ». |
| **3 — Instances** | Ce qu'un ticket *crée ou touche* : une VM de projet, une règle de flux, un conteneur, une clé, une procédure pas à pas. | **Le ticket** (`plan-action`, `conclusion`) et la **base de connaissances**, retrouvés par tags. Jamais le contexte. | « vm-otel-dev-01, F4s_v2, 3 conteneurs otel-dev-* ». |

**Le test, en une question** : *un autre technicien, sur un autre ticket dans
six mois, aurait-il besoin de ce fait avant de poser sa première question ?*
Si oui, c'est du niveau 1 ou 2. Si le fait n'a de sens que pour ce
ticket-ci, c'est du niveau 3 : il est déjà dans le ticket, et `search_kb` le
retrouvera.

**Un pivot entre dans l'inventaire** s'il héberge un service partagé
(niveau 2) ou si une autre section le référence. Une VM de projet qui
n'héberge rien de partagé n'entre pas, même si elle a été créée par l'outil.

**Taille** : une section qui dépasse une quarantaine de lignes est presque
toujours un inventaire de niveau 3 déguisé. `etat` la signale comme
« volumineuse » ; le référent élague ou renvoie vers l'outil qui fait
autorité (CMDB, portail cloud) en une ligne : « l'inventaire complet est
dans <outil> ».

**Conséquence sur les gabarits** : le transverse gagne une section
`general/plateformes` (niveau 1 pur) que les skills système et les demandes
réseau chargent d'office.

## 5. Mise à jour — quatre canaux, un propriétaire

| Canal | Quand | Qui applique |
| --- | --- | --- |
| Plan d'action d'une demande | La mise à jour est la dernière étape du plan (décision B) | Le technicien qui exécute le plan |
| Mises à jour formulées à la clôture | L'outil formule « section X : contenu candidat » dans le ticket | Le référent du domaine |
| Changement hors outil (topologie, équipement remplacé…) | Au fil de l'eau | Le référent du domaine |
| Entretien de remplissage (`/support remplis le domaine X`) ou sections candidates à la clôture | Sur demande, ou proposé à la clôture | L'outil, par `update_context`, après le oui du technicien sur chaque section |
| **La boucle de fraîcheur** (décision 9 du 2026-09-18, le quatrième canal annoncé ici) : péremption à l'usage, file des candidats, contradictions en ticket | Une section datée de plus de **90 jours** (`JOURS_PEREMPTION`, `config.ts`) est annotée « à confirmer » par `get_context` et dans les requis d'un skill, avec la marche à suivre ; `remplissage` et l'audit servent la **file des candidats** (réponses journalisées sur une section encore vide, mises à jour proposées jamais appliquées, contradictions notées) ; en ticket, `save_progress.contradictions` reçoit une vérification qui contredit le contexte, et la clôture la reprend en mise à jour proposée sans compter sur la mémoire du modèle | L'outil, par `update_context`, sur oui. **Confirmer = `update_context` à contenu identique** : le serveur re-date seulement, sans copie dans `historique/`. Aucun appel `confirm_context`. |

Le **référent** est nommé dans `general/referents` — un nom par domaine,
propriétaire de la fraîcheur de son fichier. Si le terrain contredit le
contexte pendant une instruction, l'IA le signale dans le plan d'action, à
destination du référent (décision 0.4).

**L'outil peut écrire, depuis le 2026-09-09**, par `update_context`
(`contrat-mcp.md` §5 bis) : une section à la fois, après un oui explicite du
technicien sur le contenu montré. Le serveur conserve le titre et les
consignes, pose la date, et copie la version précédente dans
`installation/contexte/historique/` avant d'écrire. Deux chemins y mènent :
le skill `remplissage` (entretien section par section, hors ticket ou sur
demande pendant un ticket) et la clôture d'un ticket (les sections
candidates, sur oui). L'invariant tient : jamais d'écriture sans validation
humaine. Quand une section est vide, `get_context` renvoie sa consigne de
remplissage et son squelette : c'est ce qui permet à l'outil de poser la
bonne question au bon niveau de détail.

## 6. Gabarits de la bêta

- `produit/contenu/general/contexte.exemple.md` — sections : `sites`,
  `plateformes` (ajoutée le 2026-09-09 ; le cloud y vit, il n'est pas un
  domaine — `plan.md` A), `criticite-services`, `contacts-escalade`,
  `referents`.
- `produit/contenu/domaines/reseau/contexte.exemple.md` — sections : `topologie`,
  `equipements`, `acces-distant`, `dns-dhcp`, `proxy-filtrage`, `wifi`,
  `flux-existants`, `plan-adressage`.
- `produit/contenu/domaines/systeme/contexte.exemple.md` — sections : `serveurs`,
  `services`, `virtualisation`, `stockage`, `partages`, `sauvegardes`,
  `messagerie`, `certificats`, `ordonnancement`.

Ajoutés en bêta v2 (2026-09-11), hypothèses jusqu'au premier ticket réel de
chaque domaine :

- `produit/contenu/domaines/identite/contexte.exemple.md` — sections :
  `annuaires`, `synchronisation`, `authentification`, `groupes-droits`,
  `cycle-de-vie`, `comptes-service`.
- `produit/contenu/domaines/poste-de-travail/contexte.exemple.md` — sections :
  `parc`, `deploiement`, `applications-standard`, `profils`,
  `securite-poste`, `impression`.
- `produit/contenu/domaines/materiel/contexte.exemple.md` — sections :
  `parc-materiel`, `fournisseurs-sav`, `stock`, `peripheriques`,
  `salles-techniques`.
- `produit/contenu/domaines/applicatif/contexte.exemple.md` — sections :
  `catalogue`, `responsables`, `editeurs-support`, `integrations`,
  `environnements`, `acces-applicatifs`.

Soit 44 sections (22 en bêta 1). Trois sections transverses ont été
envisagées et **non ajoutées** (`general/acces-administration` pour les
bastions, `general/conventions`, `general/outillage`) : deux tickets sur
trois ont demandé un bastion, mais une section transverse touche tous les
clients installés (H4) — à trancher avec un troisième ticket.

La liste vient du contrat B→C : chaque identifiant déclaré par un skill doit
exister dans un gabarit, et le script de validation du périmètre D vérifie
cette correspondance dans les deux sens.

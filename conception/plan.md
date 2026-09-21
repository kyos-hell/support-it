# Étude de projet — Boîte à outils IA pour le support IT

---

## 0. À lire d'abord

> **Ce document est une étude de projet, pas une spécification technique.** Il
> définit le produit, son vocabulaire, ses décisions structurantes et son
> découpage en périmètres. Il ne dit pas comment chaque périmètre s'implémente :
> **chaque périmètre fera l'objet d'un plan d'architecture technique séparé**,
> rédigé dans un second temps. Voir la section 2.1.
>
> **Ce document est conçu pour être ouvert à froid, sans conversation
> préalable.** Si tu es une IA à qui l'on demande de travailler sur ce projet,
> cette section 0 contient tout ce qu'il faut pour discuter utilement de la
> suite. Ne saute pas le glossaire : le mot « skill » a ici un sens précis qui
> n'est pas son sens courant.

### 0.1 — Le projet en un paragraphe

Une boîte à outils installable par n'importe quelle entreprise, qui assiste un
technicien de support IT dans son travail quotidien : le **diagnostic des
incidents** et l'**instruction des demandes** (ouverture de flux, création de
VLAN, comptes et partages…). Le principe est le chargement de
contexte à la demande : au lieu de tout précharger, l'outil identifie de quel
domaine relève le problème, ne charge que le périmètre de travail correspondant,
puis ne va chercher que les sections d'information nécessaires. L'objectif est
l'**assistance**, pas l'automatisation.

### 0.2 — Glossaire

| Terme | Sens dans ce projet |
| --- | --- |
| **Skill** | Un **périmètre de travail** : ce que l'IA sait faire dans un domaine, comment elle raisonne, où s'arrête son champ. Ce n'est ni un script, ni une procédure, ni un outil. Générique et livré avec le produit. |
| **Domaine** | Une famille de problèmes du support IT : réseau, système, matériel, identité, applicatif, poste de travail. |
| **Contexte entreprise** | Les informations propres à l'installation cliente : topologie, serveurs, applications. Rempli par le client à partir d'un gabarit fourni. |
| **Gabarit** | Le fichier `contexte.exemple.md` d'un domaine, structure vide que le client remplit. |
| **Section** | Une unité adressable du contexte entreprise, référencée par un index en tête de fichier. |
| **Nature** | Ce qu'est un cas : **incident** (« ça ne marche plus » — un état antérieur s'est dégradé) ou **demande** (« je veux que » — un état cible, rien de cassé). Déterminée par le triage, avant le domaine. |
| **Ticket** | Un cas traité — incident ou demande — conservé avec son expression initiale. |
| **Base de connaissances** | Les tickets résolus et publiés, indexés pour être retrouvés au ticket suivant. |

### 0.3 — Le flux, en toutes lettres

Ce projet a un schéma de routage (`architecture/schema/routage_support_v4.svg`, mis à jour le 2026-09-21 pour `0.3.0` ; la v3 du 2026-09-10 et la v2 sont conservées pour l'historique). Voici son contenu sous forme textuelle — celui de la v3 ; la v4 y ajoute `read_kb` après la recherche, l'audit hors ticket, la file des candidats, l'étape et les escalades dérivées par le serveur, les refus hors séquence et l'hôte.

1. **`/support`** — le technicien décrit son problème. C'est l'unique porte
   d'entrée humaine.
2. **Triage** — raisonnement seul, sans appel externe. Détermine d'abord la
   **nature** (incident ou demande), puis extrait les signaux du texte et
   propose un ou plusieurs domaines.
3. **Validation du triage** — *uniquement si le cas est ambigu*. Le technicien
   ajoute ou retire des domaines. Si le cas est net, cette étape est sautée.
4. **Chargement**, en deux temps :
   - **`load_skill(domaines, nature)`** — récupère le ou les périmètres de
     travail, **avec les sections `requis` de l'en-tête déjà résolues** : le
     serveur lit l'en-tête, il n'a pas besoin que le modèle lui recopie les
     identifiants (décision D, 2026-09-09 — le modèle peut en oublier un, le
     code non).
   - **`get_context(sections)`** — récupère les sections `selon-cas`, plus
     tard, en cours d'instruction, au moment où leur signal apparaît.
   - Si une section manque, **question au technicien** plutôt que de charger
     davantage.
5. **Instruction du cas** — lecture seule, aucun appel de modification. Pour
   un **incident** : le diagnostic. Pour une **demande** : l'étude — prérequis
   vérifiés dans le contexte, informations manquantes collectées, une question
   à la fois. *Une exception de flux* : si l'instruction révèle que le cas
   relève d'un autre domaine, retour à l'étape 4 — re-triage sur les signaux
   découverts, nouveau `load_skill`. Voir « L'escalade de domaine » au
   périmètre E.
6. **Recherche en base de connaissances** — `search_kb(tags)`, **une fois le
   cas instruit** (diagnostic posé, ou demande étudiée). On interroge la base
   avec des signaux vérifiés, pas avec l'expression vague du départ : un cas
   similaire trouvé apporte une solution déjà éprouvée au plan d'action. Un
   retour vide est le cas **nominal** des premières semaines, pas une erreur :
   la base démarre vide. Depuis le 2026-09-18 : la recherche est une liste
   courte pour *choisir* ; le cas retenu se lit avec **`read_kb(id)`** avant
   d'en reprendre la conclusion (décision 4 de `plan-after-beta.md`).
7. **Plan d'action proposé** — le technicien valide ou corrige. En séquence
   numérotée, une commande par étape (décision 10).
8. **Actions correctives** — exécutées par l'humain, hors du système, **une
   commande à la fois** ; le modèle attend la sortie avant la suivante.
9. **Clôture du ticket** — `load_skill(["cloture"])` puis `save_ticket()` :
   le brouillon courant est la source (symptôme, domaines, plan, questions,
   signaux, durée), les escalades sont dérivées des skills chargés.
10. **Publication en base** — `publish_kb()`, après validation. Alimente
    l'index pour les tickets suivants.

Tout au long : `save_progress` à chaque acquis (le brouillon se crée dès le
triage validé, avant le premier skill de domaine) ; l'**état de session**
(décision 3) rend impossible un appel hors séquence quand un brouillon est
courant. Hors ticket : `load_skill(["remplissage"])` pour le contexte,
`load_skill(["audit"])` pour le rapport (décision 8).

Neuf appels MCP au total, tous sur des données persistantes : `search_kb`,
`load_skill`, `get_context`, `save_ticket`, `publish_kb` ; depuis le
2026-09-09 `update_context` — l'écriture d'une section du contexte après
validation humaine, que la section 4 prévoyait « si le copier-coller devient
une friction » ; depuis le 2026-09-10 `save_progress` et `resume_ticket` —
la pause, la reprise et la passation d'un ticket ; depuis le 2026-09-18
`read_kb` — lire un cas publié pour s'en servir, pas seulement savoir qu'il
existe (`plan-after-beta.md`, décision 4). Depuis la même date le serveur
garde un **état de session** (décision 3) : il sait à quel brouillon un
appel appartient, refuse un appel hors séquence, dérive l'étape et les
escalades ; et les domaines, signaux, tags et sections sont des **enums**
construits depuis le manifeste et les gabarits — le modèle coche, il ne
rédige pas (décisions 1, 2, 9). Tout le reste est du raisonnement ou de
l'action humaine.

**Pause, reprise, passation (ajouté le 2026-09-10).** L'état d'un ticket ne
vit plus seulement dans la conversation : un **brouillon** par ticket ouvert,
dans `installation/en-cours/`, est créé par `save_progress` dès le triage
validé et mis à jour à chaque acquis (cran validé, réponse, plan validé,
action) — le modèle n'envoie que le nouveau, le serveur fusionne. Le
technicien peut changer de ticket ou fermer la session ; un collègue reprend
par `resume_ticket(référence)`, la passation est enregistrée. Le triage
reçoit la liste des tickets en cours et propose la reprise quand la
référence y figure. À la clôture, `save_ticket(id)` reprend l'identifiant du
brouillon, qui est retiré. Détail : `conception/contrat-mcp.md` §5 ter.

Trois points de validation humaine et pas un de plus : le triage ambigu, le plan
d'action, la publication.

### 0.4 — Décisions déjà prises, et pourquoi

> Ces points ont été discutés et tranchés. Les rouvrir demande un argument
> nouveau, pas une préférence.

**Le support couvre deux natures de cas : l'incident et la demande.** Le
support réel ne s'arrête pas aux incidents — ouverture de flux, création de
VLAN, comptes, partages sont le quotidien d'un technicien. Le triage détermine
la **nature avant le domaine**, sur un signal simple : « ça ne marche plus »
(un état antérieur s'est dégradé) contre « je veux que » (un état cible, rien
de cassé). Le flux tient tel quel : l'étape d'instruction est un diagnostic
pour un incident, une étude pour une demande — mêmes appels MCP, mêmes points
de validation. Chaque domaine sépare `skill.md` (comportement et diagnostic)
de `demandes.md`, chargé seulement si nature = demande : un ticket incident ne
paie pas les tokens de la procédure de création de VLAN.

**La recherche en base se fait le diagnostic posé, pas avant.** Une version
antérieure du flux cherchait avant le chargement, sur le symptôme brut — tout
en imposant qu'un cas trouvé repasse par le diagnostic complet : le raccourci
était illusoire. Chercher après le diagnostic interroge la base avec des
signaux vérifiés, et le cas trouvé sert là où il a de la valeur : une solution
déjà éprouvée au moment du plan d'action.

**`/support` est l'unique commande humaine.** Une commande par domaine
(`/network`, `/ad`) a été envisagée puis écartée : si le technicien tape
`/network`, il a déjà décidé du domaine et le triage ne sert plus à rien. Or
c'est précisément dans les cas où l'on croit savoir que l'on se trompe.

**Un outil MCP paramétré plutôt que N outils par domaine.** Chaque définition
d'outil reste chargée en contexte en permanence : vingt domaines feraient vingt
schémas présents à chaque requête, soit exactement le coût qu'on cherche à
éviter.

**Chargement en deux temps, pas en un.** Le skill est chargé d'abord, il
déclare ensuite les sections dont il a besoin. L'index est dérivé des titres
par le serveur (décision C), et les sections `requis` sont résolues par le
serveur dans la réponse même de `load_skill` (décision D) : le second temps
ne concerne que les sections `selon-cas`.

**Un skill ne contient aucune donnée d'entreprise.** C'est ce qui rend le
produit portable. Règle facile à énoncer, facile à violer le jour où l'on ajoute
un exemple concret pour clarifier un skill.

**Les skills sont génériques.** La méthode de diagnostic réseau ou système est
du support IT standard, pas un savoir maison. La spécialisation viendra plus
tard, après une cinquantaine de tickets réels.

**Le serveur MCP reste bête.** L'intelligence dans les skills, pas dans le code.
Un serveur trop malin rend impossible de savoir si une erreur vient du modèle ou
du serveur.

**Le contexte est un accélérateur, pas un prérequis.** L'outil fonctionne
sur une installation au contexte vide : chaque section remplie est une
question que l'IA n'aura pas à poser ; chaque section vide devient une
question au technicien — plus lent, jamais faux. Le danger n'est pas le
contexte absent, c'est le contexte **périmé**, qui donne des diagnostics faux
avec assurance. Conséquences : aucune section obligatoire, l'installation ne
bloque jamais sur un contexte vide (elle signale l'état de remplissage), et
la réponse du technicien à une question journalisée est le **contenu
candidat** de la section manquante — le contexte se remplit par l'usage,
comme la base de connaissances. Si le terrain contredit le contexte en cours
d'instruction, le signaler au plan d'action, à destination du référent.

**Les tâches déterministes sont du code, jamais du raisonnement.** Construire
un chemin de fichier, générer un identifiant, horodater, reconstruire un index :
sur chacune de ces opérations le modèle peut se tromper, alors qu'un script ne
le peut pas. Le constat d'origine est concret : à l'usage d'un skill, l'IA
s'est déjà trompée de chemin en créant un ticket. Règle : l'IA ne manipule
jamais un chemin ni un identifiant — les neuf appels MCP encapsulent toutes les
écritures, et le serveur résout lui-même où et sous quel nom écrire. C'est le
complément de « le serveur reste bête » : bête ne veut pas dire absent.
L'intelligence dans les skills, le déterminisme dans le code.

**Pas d'historique de tickets à ce stade.** Fabriquer un faux corpus a été
écarté : on peut inventer des causes, pas des symptômes. Un corpus fabriqué
serait déjà propre et déjà catégorisé, donnant un faux sentiment de justesse.

**Les tickets réels reconstitués de mémoire tombent sous le même refus.** Et pour
la même raison : la cause est vraie, mais le symptôme a été blanchi par la
connaissance de l'issue. On écrit « lenteur uniquement via VPN » parce qu'on sait
déjà que c'était le VPN. C'est le même corpus déjà catégorisé, arrivé par une
autre porte. La base de connaissances démarre donc **vide**, et se remplit à
partir de tickets vécus en direct.

**Mesurer n'est pas inventer.** Le refus ci-dessus porte sur le corpus, pas sur la
baseline. Diagnostiquer soi-même en notant le temps et la conclusion produit une
mesure réelle : c'est le protocole de la section 3, et il ne contredit pas cette
décision.

**Le POC portera sur deux domaines, réseau et système.** Avec un seul domaine,
le triage répond toujours la même chose : il est correct à 100 % et n'a rien
démontré. *Bêta v2 (2026-09-11)* : les quatre autres domaines sont
implémentés, parce que le deuxième ticket réel avait déjà besoin
d'identité. La règle reste : chaque nouveau domaine est une hypothèse
jusqu'à son premier ticket.

**Le cloud n'est pas un domaine, c'est une plateforme** (2026-09-11). Le
triage reconnaît ce que le problème *suit* ; l'hébergement n'est pas un
signal du ticket et transperce tous les domaines. Le cloud vit dans
`general/plateformes`, au même rang que la salle serveur, et en colonne
dans les sections qui en ont besoin ; les demandes se déclinent par
plateforme (prérequis « sur quelle plateforme ? »). Détail : périmètre A.

**Seul le serveur MCP charge les skills — jamais le mécanisme de skills de
l'outil hôte.** Le standard ouvert *Agent Skills* (`SKILL.md` avec `name` et
`description`, supporté par Claude Code, Codex, Copilot, Cursor, Gemini CLI et
une quarantaine d'outils) laisse l'outil décider quand activer un skill, sur sa
description. Dans ce projet, c'est le triage qui décide, et le skill arrive en
contexte par la réponse de `load_skill`. Conséquences : l'en-tête YAML des
skills est un format privé lu par notre serveur, il n'a pas à respecter le
standard ; la seule dépendance du produit envers l'outil hôte est MCP, qui est
supporté par tous les clients majeurs et gouverné par la Linux Foundation ;
`/support` est un **point d'entrée de dix lignes par outil hôte** (« appelle
`load_skill` et suis le flux »), toute l'intelligence restant derrière le
serveur. Le corps des skills ne contient rien de spécifique à un modèle ou à
un outil — pas de nom d'outil interne, pas de balise propriétaire.

**La bêta cible Claude Code, et lui seul.** Usage interne : l'auteur et
quelques collègues, tous sur Claude Code. Le point d'entrée `/support` est
donc un skill Claude Code, et le script d'installation enregistre le serveur
MCP auprès de Claude Code uniquement. La décision précédente garantit que
d'autres outils hôtes restent possibles plus tard au prix d'un point d'entrée
par outil, pas d'une réécriture.

### 0.5 — Où en est le projet

**Bêta livrée (2026-09-09).** Les huit périmètres ont leur document de
conception dans `conception/` ; le serveur MCP est écrit, construit et testé
(`produit/serveur/`, `architecture/D-serveur-mcp.md`) ; le triage, la
clôture, le manifeste, le point d'entrée `/support` et les deux scripts
d'installation sont livrés dans `produit/`. Le compte rendu de ce qui a été
fait et des décisions prises sans discussion est dans `fin-de-projet.md`.
La suite est la porte 1 de `conception/validation.md` : tester sur des
tickets réels et noter les points d'amélioration.

**Bêta v2 livrée (2026-09-11, `0.2.0-beta`).** Les six domaines ont leur
skill, leurs demandes et leur gabarit ; le manifeste n'a plus de domaine
`decrit` ; le test de fumée exerce les six et rejoue le cas « décrit » sur
un manifeste temporaire. Compte rendu : `fin-de-projet.md` §9.

Trois étapes, dans cet ordre :

1. **Étude de projet** — le présent document. Découpage en périmètres,
   questions à trancher, décisions structurantes.
2. **Plans d'architecture technique** — un par périmètre, dans des fichiers
   séparés. Voir la section 2.1.
3. **POC** — sur deux domaines, réseau et système.

### 0.6 — Comment discuter de ce document

Ce qui est utile : contester une décision de la section 0.4 avec un argument,
répondre aux questions ouvertes d'un périmètre, signaler une incohérence entre
deux sections, ou aider à rédiger un livrable nommé.

Ce qui ne l'est pas : reproposer les options déjà écartées, élargir le
périmètre du POC, ou traiter l'automatisation comme un objectif. Elle est une
possibilité lointaine, explicitement hors cible.

**Un point d'attention pour une IA qui travaille sur ce projet.** Ne pas rédiger
de plan d'architecture technique tant qu'il n'est pas explicitement demandé, et
tant que les questions du périmètre concerné ne sont pas tranchées. Ce document
est l'étude ; l'architecture vient après, périmètre par périmètre.

---

## 1. Ce qu'est le produit

Trois affirmations structurantes, qui contraignent tout le reste.

**Un skill est un périmètre de travail**, pas une procédure. Générique, livré
avec l'outil, identique chez tous les clients.

**Le contexte entreprise est propre à l'installation.** Rempli par le client
avant la première utilisation, à partir d'un gabarit fourni.

**`/support` est l'unique porte d'entrée humaine.** Le routage est la
responsabilité de l'outil, pas de l'utilisateur.

---

## 2. Périmètres à concevoir

| # | Périmètre | Rôle |
| --- | --- | --- |
| A | Taxonomie des domaines | Découper le support IT en domaines et frontières |
| B | Format des skills | Décider à quoi ressemble un skill et ce qu'il contient |
| C | Gabarits de contexte | Définir ce que le client doit remplir |
| D | Serveur MCP | Concevoir les deux temps de chargement |
| E | Triage | Router une demande vers les bons domaines |
| F | Base de connaissances | Capitaliser les tickets résolus |
| G | Gouvernance | Placer les points de validation humaine |
| H | Déploiement et distribution | Installer, mettre à jour, héberger |
| I | Documentation d'entreprise | Citer la doc existante au plan d'action (ajouté le 2026-09-11, hors bêta, étude seule) |

Ordre de traitement : A, puis B et C en parallèle, puis D, puis E, F, G, H.
A conditionne tout ; E ne peut se concevoir qu'une fois qu'il y a quelque chose
à router ; H vient en dernier parce qu'il emballe ce que les autres produisent.

**Une exception à cet ordre.** La question H1 — serveur MCP local ou distant —
doit être tranchée **avant** le périmètre D, parce qu'elle change ce que le
serveur doit gérer. Voir la note en tête du périmètre H.

### 2.1 — Un plan d'architecture technique par périmètre

**Les sections A à G de ce document ne sont pas des spécifications.** Elles
cadrent chaque périmètre : son rôle, ses dépendances, les questions à trancher,
les pièges connus, le critère de sortie. Elles disent *quoi décider*, pas
*comment construire*.

Chaque périmètre donnera lieu à un **plan d'architecture technique séparé**,
rédigé dans son propre fichier, une fois les questions du présent document
tranchées.

```
plan.md                          ← ce document : l'étude de projet
architecture/
  A-taxonomie.md                 ← plan d'architecture du périmètre A
  B-format-skill.md
  C-gabarits-contexte.md
  D-serveur-mcp.md
  E-triage.md
  F-base-connaissances.md
  G-gouvernance.md
  H-deploiement.md
```

**Deux couches de documents, dans cet ordre.** `conception/` est l'atelier :
c'est là que les questions d'un périmètre se débattent et se répondent — ses
fichiers sont les livrables listés dans les sections A à H. `architecture/` est
le résultat : le plan d'architecture technique d'un périmètre s'écrit à partir
de sa conception, une fois celle-ci stabilisée. On conçoit dans `conception/`,
on fige dans `architecture/`.

**Ces documents ne sont pas livrés.** `plan.md`, `conception/` et `architecture/`
vivent dans le dépôt du projet. Ils n'appartiennent ni à `produit/` ni à
`installation/` — les deux arborescences définies au périmètre H ne contiennent
que ce qui est installé chez un client.

**Pourquoi séparer.** Trois raisons :

- Chaque plan technique est un document de travail long, avec ses choix
  d'implémentation, ses formats et ses cas limites. Fondus dans l'étude, ils la
  rendraient illisible et masqueraient les arbitrages de fond.
- Ils ne se rédigent pas au même moment. L'étude est stable ; un plan technique
  se révise à chaque apprentissage du POC.
- Ils se traitent un par un, en session dédiée. Un périmètre à la fois, avec
  l'étude en référence commune.

**Règle de rédaction.** Un plan d'architecture ne s'écrit qu'une fois les
questions de son périmètre tranchées dans le présent document, et une fois ses
dépendances traitées. Écrire le plan technique de D avant d'avoir tranché B et C
produit un contrat qui transporte des choses qui n'existent pas encore.

**Contenu attendu d'un plan d'architecture.** À définir précisément au moment de
rédiger le premier, mais l'ossature visée est : décisions retenues et leur
raison, structures de données et formats, comportement nominal, cas limites et
dégradés, ce que le composant ne fait pas, points de contrôle.

**Décision pour la bêta (2026-09-09).** Seul D a du code, donc seul D a un
plan d'architecture (`architecture/D-serveur-mcp.md`, qui suit l'ossature
ci-dessus). Pour A à C et E à H, le document de conception tient lieu de
référence d'architecture : leurs « structures » sont des fichiers markdown
et des règles de prose, et un second document les répéterait. À revoir si
un périmètre gagne du code (par exemple un outil pour le référent, F §4).

---

## A — Taxonomie des domaines

**Objectif.** Découper le support IT en domaines génériques, valables pour
n'importe quelle entreprise.

**Questions à trancher.**

- Quels domaines ? Piste de départ : réseau, système, matériel, identité et
  annuaire, applicatif, poste de travail.
- Où passe la frontière entre deux domaines voisins ? C'est le point important :
  les zones de recouvrement sont exactement là où le triage se trompera.
- Un domaine peut-il en contenir un autre, ou sont-ils tous au même niveau ?
  Recommandation : plat. La hiérarchie ajoute une question à chaque
  interrogation du manifeste sans rien résoudre.

**Un domaine se définit par des signaux, pas par des composants.** « Le réseau,
c'est les switchs et le VPN » ne permet pas de trier ; « le problème dépend du
chemin d'accès et non du service » le permet. Chaque domaine déclare dans la
taxonomie ses **signaux discriminants** : des faits observables dans le texte
du ticket, binaires et vérifiables. Le triage ne fait que constater lesquels
sont présents — ni intuition humaine, ni intuition de modèle. C'est ce qui rend
son raisonnement montrable (périmètre E : « timeout + uniquement via VPN →
réseau » est une liste de signaux cochés), et c'est ce qui rend ses erreurs
corrigibles : un ticket mal classé désigne un signal à corriger dans la
taxonomie, pas une impression à rediscuter. Quand aucun signal discriminant
n'est présent dans la description, le triage demande le signal manquant au
technicien au lieu de deviner — c'est la porte asymétrique du périmètre E.

**Méthode.** Pour chaque paire de domaines voisins, écrire deux symptômes
ambigus. « Lenteur applicative » et « timeout à la connexion » appartiennent à
qui ? Ces exemples deviennent le jeu de test du triage au périmètre E.

**Livrable.** `conception/taxonomie.md` — un domaine par section : ce qu'il
couvre, ce qu'il ne couvre pas, **ses signaux discriminants**, ses voisins, les
symptômes ambigus avec eux.

**Critère de sortie.** Tout symptôme de support IT courant tombe dans au moins
un domaine, et les cas à cheval sont explicitement listés.

**Décisions.**

| Question | Décision | Raison |
| --- | --- | --- |
| Plat ou hiérarchique ? | Plat. | Le triage propose plusieurs domaines quand c'est ambigu ; une hiérarchie forcerait à choisir un niveau avant de choisir un domaine. Un domaine trop gros se scindera en deux domaines plats, migration triviale. |
| Combien de domaines en bêta ? | La taxonomie **décrit** les six domaines et leurs frontières ; seuls **réseau** et **système** ont un skill et un gabarit en bêta. Les autres s'implémentent après validation de la bêta (voir `conception/validation.md`). | Le triage doit savoir qu'un domaine existe pour répondre « hors des domaines couverts », sinon un ticket imprimante est forcé dans réseau ou système. Décrire coûte une page ; implémenter coûte un skill, un gabarit et leur maintenance. |
| Les quatre autres domaines, quand ? (2026-09-11) | **Bêta v2** : `poste-de-travail`, `materiel`, `identite`, `applicatif` implémentés (skill, demandes, gabarit), statut `beta` au manifeste. La réponse « hors des domaines couverts » reste pour ce qui ne tombe dans aucun des six et pour un domaine futur déclaré `decrit`. | Le deuxième ticket réel (réécriture de mot de passe) était triagé systeme + identite et sa cause vivait côté annuaire : attendre « la validation de la bêta » revenait à jouer des tickets à moitié couverts. Les quatre restent des hypothèses jusqu'à leur premier ticket. |
| Le cloud : un domaine ? (2026-09-11) | **Non.** Une **plateforme** : une ligne de `general/plateformes` (comme la salle serveur), une colonne dans les sections qui en ont besoin, un prérequis « sur quelle plateforme ? » dans les demandes. La demande `creation-vm` entre côté système quand `demandes.md` pourra être scindé par demande. | Le triage reconnaît ce que le problème suit ; « hébergé dans le cloud » n'est pas un signal du ticket. Un domaine cloud transpercerait les six autres. Preuve : l'incident de réécriture de mot de passe se voyait dans le portail cloud, sa cause était un service Windows on-prem — un domaine cloud l'aurait mal triagé. |

---

## B — Format des skills

**Objectif.** Décider à quoi ressemble un skill avant d'en écrire six.

**Le test à appliquer.** Un skill n'a de valeur que s'il **contraint**. S'il
explique ce qu'est le DNS, il ne sert à rien : le modèle le sait déjà, et on
paie des tokens pour une redite. S'il impose un ordre de vérification — couche
physique, puis IP, puis DNS, puis applicatif, sans descendre d'un cran avant
d'avoir validé le précédent — il change le comportement.

Question à se poser sur chaque section écrite : *l'IA ferait-elle autrement sans
cette ligne ?* Si non, couper.

**Questions à trancher.**

- Quelles sections un skill contient-il ? Piste : périmètre, ordre de
  diagnostic, sections de contexte requises, questions à poser au technicien,
  limites explicites du domaine.
- Quelle longueur cible ? Un skill trop long annule le gain de tokens qui
  justifie l'architecture. Fixer un ordre de grandeur maintenant, s'y tenir.
- Comment un skill déclare-t-il les sections de contexte dont il a besoin ?
  C'est ce qui rend le second temps de chargement possible.
- Comment deux skills chargés ensemble se composent-ils ? Que se passe-t-il
  quand leurs ordres de diagnostic se contredisent ?

**Livrables.**

- `conception/format-skill.md` — la structure, avec le test de valeur — pour
  les deux fichiers, `skill.md` et `demandes.md`.
- `produit/contenu/domaines/_template/skill.md` et
  `produit/contenu/domaines/_template/demandes.md` — les squelettes vides.
- `produit/contenu/domaines/reseau/skill.md` et
  `produit/contenu/domaines/reseau/demandes.md` — les premiers écrits, qui servent de
  référence.

**Critère de sortie.** Le skill réseau est écrit, et chacune de ses sections
passe le test de valeur.

**Décisions.**

| Question | Décision | Raison |
| --- | --- | --- |
| Sections d'un skill ? | Cinq : périmètre, contexte requis (en-tête), ordre de diagnostic, règles de conduite, signaux d'escalade. | L'escalade (périmètre E) exige que « limites du domaine » soit un déclencheur avec ses signaux, pas de la documentation. |
| Longueur cible ? | Une à deux pages, ~100 lignes maximum. | Au-delà, le gain de tokens qui justifie l'architecture s'évapore. |
| Déclaration du contexte requis ? | En-tête YAML en tête du skill, deux niveaux : `requis` (chargé d'office) et `selon-cas` (chargé si le signal correspondant est présent). Les identifiants de sections sont **le contrat commun** entre B, C et D : le gabarit les indexe, `get_context` les résout. | Deux lecteurs, deux formats : le YAML pour le serveur (déterministe, parseable — décision 0.4 « le déterministe est du code »), la prose pour le modèle. `selon-cas` préserve l'économie de tokens. |
| Composition de deux skills ? | Pas de fusion. Discriminer d'abord — éliminer un des deux domaines au plus vite avec les signaux de la taxonomie — puis suivre l'ordre du skill survivant, l'autre en référence. | On ne définit pas de règle de fusion d'ordres contradictoires ; on fait en sorte que la situation ne dure pas. |
| Rythme des questions ? | **Règle d'or : une question à la fois.** Poser une question, attendre la réponse, décider de la suite avec elle. Jamais de liste de questions. Vaut pour le diagnostic comme pour l'étude d'une demande. | Chaque réponse change la question suivante ; une batterie de questions est à moitié répondue et à moitié du vent. C'est le pendant conversationnel de l'ordre de diagnostic. |
| Où vivent les demandes d'un domaine ? | Dans un fichier séparé, `demandes.md`, à côté de `skill.md` — chargé seulement si le triage a déterminé nature = demande. Une entrée par demande courante : prérequis, informations à collecter, vérifications de contexte, gabarit de plan d'action. | Économie de tokens : un incident ne paie pas la procédure de création de VLAN. Le YAML de `demandes.md` déclare ses sections de contexte comme celui de `skill.md`. |
| Une persona en tête de skill ? | Une seule ligne de cadrage (« Tu es l'ingénieur réseau de l'équipe support ; ton périmètre s'arrête où commence l'Escalade »), pas davantage. Le comportement se pilote par contraintes, pas par identité. | Les études convergent : les personas n'améliorent pas la performance des modèles récents. Ce qui active le bon registre : le vocabulaire du domaine, les contraintes, les données chargées. |

---

## C — Gabarits de contexte

**Objectif.** Définir ce qu'une entreprise doit remplir avant la première
utilisation.

**Structure retenue.**

```
produit/
  contenu/                      ← tout ce que le modèle lit, et rien d'autre
    general/
      contexte.exemple.md       ← transverse, chargé en plus (id « general »)
    domaines/
      reseau/
        skill.md                ← générique, livré
        demandes.md             ← générique, livré — chargé si nature = demande
        contexte.exemple.md     ← gabarit à remplir
      systeme/
        skill.md
        demandes.md
        contexte.exemple.md
```

*(Arborescence revue le 2026-09-09 : le contenu lu par le modèle est isolé
sous `contenu/`, le transverse sous `contenu/general/` ; voir la décision au
périmètre H.)*

Un skill et son gabarit voyagent ensemble : ajouter un domaine, c'est ajouter un
dossier.

**Le contexte *rempli* ne vit pas ici.** Le gabarit est livré, donc remplaçable ;
le fichier que le client remplit à partir de ce gabarit vit dans une seconde
arborescence, `installation/contexte/<domaine>.md`, que la mise à jour n'écrit
jamais. C'est une décision du périmètre H, prise avant les autres questions de H
parce qu'elle contraint celles de C. Voir « Conséquence immédiate, et tension avec
le périmètre C » en tête du périmètre H.

**Le transverse.** Sites, horaires, criticité des services, contacts
d'escalade — réclamés par tous les domaines. À isoler dans un fichier séparé,
sinon on obtient quatre versions divergentes en six mois.

**Questions à trancher.**

- Quelles sections dans chaque gabarit ? Ne pas trop deviner : le périmètre D
  prévoit de journaliser les questions posées par l'IA, et ce sont elles qui
  révéleront les manques réels.
- L'index en tête de fichier : quel format ? Sans lui, un skill demande à
  l'aveugle, ou conclut qu'une information manque alors qu'elle est deux
  sections plus bas.
- ~~Que fait l'outil si une section obligatoire est vide au démarrage ?~~
  **Tranchée en 0.4** : il n'y a pas de section obligatoire. Section vide =
  question au technicien, jamais un refus ni une dégradation silencieuse — et
  la réponse journalisée est le contenu candidat de la section.
- Comment une section se met-elle à jour, et qui en est responsable ? Sans
  réponse, le contexte devient obsolète en un an et personne ne s'en aperçoit.
  **Depuis H1, ce n'est plus une question d'hygiène mais un rôle à nommer** :
  quand cinq techniciens lisent la même topologie depuis un partage, « qui met à
  jour » a besoin d'un propriétaire, pas d'une bonne intention.

**Livrables.**

- `conception/format-contexte.md` — structure, convention d'index, règles de
  mise à jour, et convention de nommage du contexte rempli côté
  `installation/`.
- `produit/contenu/domaines/_template/contexte.exemple.md` — le squelette, avec les
  règles d'écriture d'un gabarit en commentaires.
- `produit/contenu/domaines/reseau/contexte.exemple.md` et
  `produit/contenu/general/contexte.exemple.md`.

**Critère de sortie.** Une personne extérieure remplit le contexte réseau en
lisant uniquement le gabarit.

**Décisions.**

| Question | Décision | Raison |
| --- | --- | --- |
| Quelles sections ? | Celles que les en-têtes YAML des skills déclarent (contrat B→C), plus `contacts-escalade` et `referents` au transverse. Rien de plus. | Ne pas deviner : le journal des questions révélera les manques réels. |
| Format de l'index ? | **Dérivé, jamais écrit à la main.** Chaque section est délimitée par un titre `## <id> — <titre lisible>` ; le serveur construit l'index en scannant les titres. | Un index manuel diverge (double vérité, interdite par F2). Scanner des titres est du code déterministe (0.4). Moins de mécanique à maintenir pour le client. |
| Section vide ? | Pas de section obligatoire (0.4). Vide = question au technicien, réponse journalisée = contenu candidat. | Le contexte est un accélérateur, pas un prérequis. |
| Qui met à jour ? | Un référent nommé par domaine dans `general/referents`. Trois canaux : les plans d'action de demandes (dernière étape), les mises à jour formulées à la clôture, le référent pour ce qui change hors outil. | « Qui met à jour » a besoin d'un nom écrit, pas d'une bonne intention. |
| Consignes de remplissage ? | Dans le gabarit, en commentaires HTML `<!-- -->` ; le serveur les retire de ce que `get_context` renvoie. Pas d'exemples ressemblant à du vrai — placeholders `<...>` uniquement. | Le gabarit reste auto-porteur sans que les consignes coûtent des tokens à l'usage ; un exemple réaliste finit copié-collé et pris pour du vrai. |
| Qu'est-ce qui entre dans le contexte ? (2026-09-09, premier ticket de la bêta) | Une taxonomie à trois niveaux (`format-contexte.md` §4.1) : **structure** (ce que l'entreprise possède : plateformes, abonnements, conventions, pièges, référents) et **pivots** (objets dont d'autres dépendent) entrent ; les **instances** créées ou touchées par un ticket n'entrent jamais, elles vivent dans le ticket et la base. Test : « un autre technicien, dans six mois, en aurait-il besoin avant sa première question ? » Section transverse `general/plateformes` ajoutée ; `etat` signale les sections de plus de 40 lignes. | Sans règle, l'outil proposait d'inscrire chaque VM créée : le contexte devient une CMDB illisible qui coûte des tokens à chaque ticket. Ce qui manquait n'était pas la VM, c'était « on a un Azure et un abonnement R&D avec tel piège ». |

---

## D — Serveur MCP

**Objectif.** Concevoir le mécanisme de chargement. C'est le contrat qui
contraint tous les autres périmètres.

**Les neuf appels.**

| Appel | Rôle | Lit ou écrit |
| --- | --- | --- |
| `search_kb(tags)` | Cherche un cas similaire — une liste courte pour choisir, score par rareté des tags (D2, 2026-09-18) | Lit |
| `read_kb(ticket_id)` | Lit un cas publié pour s'en servir : conclusion, plan, signaux — ajouté le 2026-09-18 (décision 4) | Lit |
| `load_skill(domains)` | Renvoie le ou les périmètres de travail | Lit |
| `get_context(sections)` | Renvoie les sections réclamées par le skill | Lit |
| `save_ticket()` | Enregistre le ticket clôturé | Écrit |
| `publish_kb()` | Promeut un ticket en entrée de base | Écrit |
| `update_context(section, contenu)` | Écrit une section du contexte, après validation humaine — ajouté le 2026-09-09 (section 4) | Écrit, avec sauvegarde |
| `save_progress(id?, pause?, …)` | Point d'étape : crée ou met à jour le brouillon du ticket en cours — ajouté le 2026-09-10 ; depuis le 2026-09-18 l'étape, les escalades et l'état de session sont écrits par le serveur | Écrit (brouillon, fusion) |
| `resume_ticket(ticket?)` | Liste les tickets en cours, ou renvoie un brouillon avec la marche à suivre pour reprendre — ajouté le 2026-09-10 | Lit |

Deux écritures distinctes : un ticket est enregistré dès la clôture, publié
seulement après validation. Les tickets clôturés non publiés sont justement ceux
qui montrent où le diagnostic a échoué — les perdre serait dommage.

**`get_context` est appelable plusieurs fois par ticket.** Le chargement du
contexte a deux moments (voir 0.3) : les sections `requis` juste après
`load_skill`, les sections `selon-cas` en cours d'instruction, quand leur
signal apparaît. Le contrat doit être conçu pour des appels répétés — un
`get_context` à appel unique forcerait à tout charger d'avance et détruirait
l'économie de tokens que `selon-cas` existe pour préserver. L'étape
d'instruction du flux interdit les appels *de modification*, pas les lectures.

**Frontière IA / code — décision posée en 0.4, à traduire dans le contrat.**
Le modèle ne fournit jamais de chemin, d'identifiant ni d'horodatage :
`save_ticket` et `publish_kb` reçoivent du contenu, et le serveur décide seul
où et sous quel nom il s'écrit. Conséquence sur les signatures : aucun appel
n'expose de paramètre de chemin. Une erreur de chemin devient ainsi
structurellement impossible côté modèle, au lieu d'être une discipline de
skill.

**Les questions posées sont un livrable, pas un défaut.** Chaque question au
technicien signale un trou dans le gabarit. Si l'on répond trois fois « le proxy
c'est celui-ci », c'est que le gabarit réseau doit avoir une section proxy.
Journaliser ces questions dès le début : c'est ainsi que le périmètre C se
complète sans avoir à tout deviner d'avance. Le journal suit les mêmes règles
que les tickets (périmètre F) : un fichier par ticket dans
`installation/journal/` (une section par question — un fichier par
question jusqu'au 2026-09-11, éclaté et redondant), jamais un fichier
unique partagé que tous les techniciens modifieraient.

**Questions à trancher.**

- Comportement sur domaine inconnu, sur section inexistante, sur appel
  multi-domaines.
- Le manifeste : quels domaines existent, quels tags les déclenchent, où sont
  leurs fichiers. **Contrainte déjà posée en H** : le manifeste est livré dans
  `produit/` mais doit désigner des fichiers de contexte côté `installation/`.
  Il déclare le domaine, une convention résout le chemin ; jamais de chemin
  d'installation en dur, sans quoi le manifeste n'est plus remplaçable.
- Les tags du manifeste et ceux de la base de connaissances sont-ils le même
  vocabulaire ? Voir la question ouverte du périmètre F.
- **Faut-il du code, et où ?** Le serveur MCP est du code par nature. La vraie
  question est ce qu'on met dedans : simple service de fichiers, ou lecture
  d'index, filtrage, journalisation. Recommandation : le minimum qui fonctionne
  au départ.
- Quels scripts hors serveur ? Génération du manifeste, validation des gabarits,
  et surtout un contrôle qu'aucun skill ne contient de donnée d'entreprise. Ce
  dernier mérite un script : c'est la règle la plus facile à violer par
  inadvertance, et la plus coûteuse à découvrir tard.

**Livrables.**

- `conception/contrat-mcp.md` — signature et comportement de chaque appel.
- `conception/manifeste.md` — format.
- `conception/outillage.md` — liste des scripts, avec leur justification.

**Critère de sortie.** Le contrat est assez précis pour qu'on puisse écrire le
serveur sans revenir poser de question de conception.

**Décisions.**

| Question | Décision | Raison |
| --- | --- | --- |
| Runtime du serveur ? | Node.js, avec le SDK MCP officiel en TypeScript, transport stdio. | Claude Code tourne sur Node.js : il est déjà présent sur tout poste qui exécute l'outil hôte de la bêta. Aucun prérequis de plus pour H2. Les améliorations de prod se consignent dans `conception/validation.md`, section « Améliorations différées ». |
| D'où vient le triage, si `/support` fait dix lignes ? | `load_skill` accepte la valeur réservée `triage`, qui renvoie `produit/contenu/general/triage.md` et le résumé du manifeste (domaines, statut, signaux). Le triage est un skill comme les autres, écrit au périmètre E. | Aucun appel nouveau pour ça, et l'intelligence reste derrière le serveur (décision 0.4). Validé par le test T-D1 de `conception/validation.md`. |
| Un appel d'écriture du contexte ? | Oui, `update_context(section, contenu)` : une section, après oui explicite, version précédente sauvegardée dans `contexte/historique/`, date posée par le serveur. Avec un skill réservé `remplissage` (entretien hors ticket, état de remplissage joint) et `get_context` qui renvoie la consigne et le squelette du gabarit pour une section vide. | Prévu par la section 4 « si le copier-coller devient une friction » ; la bêta démarre sur un contexte vide, la friction est immédiate. L'invariant « jamais sans validation » tient par le prompt ; la sauvegarde rend une mauvaise validation récupérable. Le fichier de contexte devient le seul fichier mutable de `installation/` : limite notée en F, test à la porte 2. |
| Pause, reprise, passation ? (2026-09-10) | Un brouillon par ticket ouvert dans `installation/en-cours/`, écrit par `save_progress` à chaque point d'étape (création dès le triage validé, fusion ensuite : listes ajoutées, étape et prochaine étape remplacées), lu par `resume_ticket` (liste, ou brouillon + marche à suivre, passation enregistrée si le technicien change, avertissement si le dernier point date de moins de dix minutes). Le triage reçoit la liste des tickets en cours. `save_ticket(id)` clôture sous le même identifiant et retire le brouillon — la seule suppression du serveur, sans perte : le ticket final reprend tout. | L'état d'un ticket ne vivait que dans la conversation : impossible de changer de ticket, de fermer la session, ou de passer la main. Le brouillon est isolé dans son dossier pour rendre explicite qu'il est le seul fichier volontairement réécrit ; un ticket appartient à un technicien à la fois par nature. Reprise de session Claude Code écartée : liée à un poste et un compte, invisible sur le partage. |

---

## E — Triage

**Objectif.** Router une demande vers les bons domaines à partir d'une phrase.

**La nature avant le domaine.** Premier verdict du triage : incident ou
demande. Le signal est observable — « ça ne marche plus » (un état antérieur
s'est dégradé) contre « je veux que » (un état cible, rien de cassé). Ce
verdict décide du fichier chargé (`skill.md` ou `demandes.md`) ; en cas de
doute (« le VPN ne marche pas pour le nouveau » — incident ou compte jamais
créé ?), même règle que pour les domaines : question, pas supposition. Le jeu
de test du triage inclut des demandes, pas seulement des incidents.

**Porte asymétrique.** Un seul domaine avec des signaux nets : ça passe. Deux
domaines possibles, symptôme vague, ou aucun tag qui matche : arrêt et question.

La raison : si le triage est validé sur 100 % des tickets, la validation devient
un réflexe au bout de deux semaines et ne filtre plus rien.

**Montrer le raisonnement, pas la conclusion.** « Domaine : réseau. Valider ? »
ne permet que d'acquiescer. « timeout + uniquement via VPN + depuis ce matin →
réseau, identité en second » permet de voir ce qui a été retenu et de corriger.

**L'escalade de domaine : un re-triage, pas un mécanisme nouveau.** Quand le
diagnostic découvre que le problème n'est pas dans le domaine chargé (« le
chemin d'accès est sain, le service ne répond que sur cette machine »), il
vient de produire des signaux discriminants — la matière même du triage, mais
plus fiables que la description initiale. Les mêmes règles s'appliquent donc :
raisonnement montré (« signaux trouvés en diagnostic → système »), porte
asymétrique (signaux nets → on charge et on continue ; ambigus → question au
technicien), et un nouvel appel `load_skill`. Deux conséquences ailleurs :

- **Périmètre B** — la section « limites explicites du domaine » d'un skill
  n'est pas de la documentation, c'est le déclencheur de l'escalade. Un skill
  doit savoir dire « ce n'est pas chez moi » et avec quels signaux.
- **Périmètre F** — le ticket conserve l'historique de routage. « Parti
  réseau, conclu système » est un cas ambigu réel : il nourrit le jeu de test
  du triage et désigne les signaux à corriger dans la taxonomie.

**Questions à trancher.**

- Qu'est-ce qui définit l'ambiguïté, concrètement ? À régler sur les symptômes
  ambigus produits au périmètre A.
- La correction humaine est-elle un rejet ou un ajustement ? En pratique on dit
  rarement « non », on dit « ajoute système ». Concevoir l'ajout et le retrait
  de domaines, pas le rejet.
- Combien de domaines au maximum en une fois ? Au-delà de deux ou trois, le
  triage n'a pas tranché et le gain de contexte disparaît.

**Livrable.** `conception/triage.md` — règles, format de la proposition, jeu de
test issu du périmètre A.

**Décisions (2026-09-09, détail dans `conception/triage.md`).** Le triage
vit dans `produit/contenu/general/triage.md`, servi avec le manifeste par
`load_skill(["triage"])` ; il porte aussi le flux entier. L'ambiguïté est
définie par trois cas observables (deux domaines avec signaux, aucun signal,
nature indécidable). Correction par ajout/retrait. Deux domaines maximum,
refusé par le serveur au-delà. Pas de cadrage systématique au lancement :
les questions de rattrapage ne sont posées qu'en l'absence de signal. Une
seule question systématique, la **référence du ticket** dans l'outil de
ticketing, demandée avant le triage si elle manque et reportée à la clôture
(`save_ticket.reference`, aussi un tag). Un
domaine décrit mais hors bêta se clôture avec le statut
`hors-domaines-couverts`.

**Critère de sortie.** Le triage classe correctement les symptômes ambigus du
périmètre A, ou s'arrête explicitement quand il ne peut pas trancher.

---

## F — Base de connaissances

**Objectif.** Faire qu'un ticket résolu serve au ticket suivant.

**Questions à trancher.**

- Schéma d'un ticket. Point non négociable : conserver le symptôme **tel
  qu'exprimé au départ**, pas seulement la cause finale. La recherche se
  faisant le diagnostic posé (décision en 0.4), les signaux vérifiés sont la
  clé de recherche principale — mais le symptôme initial reste indispensable :
  il nourrit le jeu de test du triage, et il permet de vérifier qu'un cas
  matché parle bien du même vécu.
- Indexation : tags ou recherche sémantique. Recommandation pour commencer :
  tags. Transparent, débogable, et on voit pourquoi un cas a matché.
- Un ticket clôturé entre-t-il automatiquement en base ? Non — la publication
  est validée séparément. Un mauvais diagnostic publié se propage et se répète
  pendant des mois.
- **La spécialisation après ~50 tickets.** Enrichit-elle le contexte de
  l'installation, ou produit-elle un skill dérivé propre au client ? *Question
  laissée ouverte* : elle aura une réponse évidente une fois qu'on aura vu à
  quoi ressemblent 50 tickets réels. Ne pas trancher maintenant.

**Contraintes héritées de H1.** La base est partagée entre techniciens via un
partage réseau. Trois conséquences non négociables, qui simplifient plutôt
qu'elles compliquent :

1. **Un fichier par ticket**, jamais de fichier mutable partagé. Deux techniciens
   écrivant deux fichiers distincts dans un dossier est sûr sur n'importe quel
   partage ; deux techniciens modifiant le même index ne l'est pas.
2. **L'index est reconstruit à partir des fichiers**, pas muté en place. Cela
   supprime la seule section critique du système.
3. **Identifiants uniques sans coordination** — horodatage plus poste ou
   utilisateur, jamais un compteur séquentiel, qui casse au premier deuxième
   technicien.

**Décisions.**

| Question | Décision | Raison |
| --- | --- | --- |
| Comment amorcer la base ? | Pas d'amorçage. Elle démarre vide et se remplit en direct. `search_kb` est néanmoins implémenté dès le POC. | Un retour vide est un cas que les skills doivent gérer de toute façon ; l'implémenter tôt l'éprouve et fige la forme de l'appel. Le retarder ferait de l'étape 6 du flux une fiction pendant tout le POC. |
| La branche « cas similaire trouvé » est-elle dans les critères de sortie du POC ? | Non. Elle reste spécifiée, et se valide en phase 2 une fois une dizaine de tickets réels accumulés. | Elle est inatteignable au démarrage. Sans le dire explicitement, on jugera le POC sur une branche qu'il ne peut pas exercer. |

**Question ouverte — le vocabulaire des tags.** Les tags de la base de
connaissances sont-ils les mêmes que les tags de déclenchement déclarés au
manifeste (périmètre D) ? Si ce sont deux vocabulaires distincts, il faut dire
lequel indexe quoi. Dépend de la taxonomie du périmètre A ; à trancher avec F.

**Livrable.** `conception/base-connaissances.md` — schémas, indexation, règle de
publication.

**Critère de sortie.** On sait ce qu'on écrit à la clôture d'un ticket et
comment on le retrouve. La branche « cas similaire trouvé » est exclue de ce
critère, par la décision ci-dessus.

---

## G — Gouvernance

**Objectif.** Placer les points où l'humain intervient, et pas ailleurs.

**Trois points de validation, pas plus.**

1. Le triage, uniquement en cas d'ambiguïté.
2. Le plan d'action, avant toute exécution.
3. La publication en base de connaissances.

C'est le budget d'attention par ticket. Si un quatrième apparaît, se demander
lequel retirer.

**Deux notions à ne pas confondre.** « Ça demande ton avis » et « ça modifie un
système » sont distincts. Le triage est le premier sans être le second.

**Ce qui ne s'automatise pas.** Toute action modifiante. Cette frontière se
marque dans le manifeste dès le périmètre D, précisément pour qu'elle ne se
renégocie pas plus tard sous la pression du confort.

**Livrable.** `conception/gouvernance.md`.

**Décisions (2026-09-09).** Les trois points sont tenus par `triage.md`
(porte asymétrique), `triage.md` étape 7 et les gabarits de plan des
`demandes.md`, et `cloture.md` (proposition sous trois conditions, oui
explicite, `publish_kb` distinct de `save_ticket`). « Aucune action
modifiante » est garanti à trois niveaux : le prompt, le contrat (aucun
appel n'exécute quoi que ce soit), le mode de permission de Claude Code —
ce dernier n'est pas imposable par le script. Le format du plan d'action,
laissé ouvert par `format-skill.md` §9, est fixé dans `gouvernance.md` §4.

---

## H — Déploiement et distribution

> **Note d'ordonnancement.** Ce périmètre se traite en dernier, **sauf deux
> questions structurantes, désormais tranchées toutes les deux** :
>
> - **L'arborescence** — où vit le contexte rempli. Contraint le périmètre C, qui
>   vient bien avant D. Voir « tension avec le périmètre C » ci-dessous.
> - **H1** — local ou distant. Change ce que le serveur MCP doit gérer :
>   concurrence, authentification, cohérence des écritures. Le découvrir après
>   avoir écrit le contrat, c'est le réécrire.
>
> H n'est donc pas un périmètre purement terminal : il porte les décisions de
> structure de fichiers, qui sont les plus coûteuses à changer tard. Le reste de
> H — H2 à H6 — se traite bien en dernier.

**Objectif.** Répondre à : comment une entreprise installe cette boîte à outils,
et comment elle reçoit les mises à jour sans perdre ce qu'elle a rempli.

### Le problème de fond

Le produit est fait de **deux matières qui n'ont ni le même cycle de vie ni le
même propriétaire** :

| | Skills, serveur, manifeste | Contexte rempli, tickets, base de connaissances |
| --- | --- | --- |
| Origine | Livré par le produit | Produit par le client |
| Mise à jour | Remplacé à chaque version | Ne doit jamais être écrasé |
| Propriétaire | Nous | Le client |

Toute la difficulté du déploiement tient dans cette séparation. Une mise à jour
qui écrase le contexte d'un client détruit son travail ; une mise à jour qui
n'ose pas toucher aux skills ne met rien à jour.

**Conséquence immédiate, et tension avec le périmètre C — tranchée.**
L'arborescence retenue en C place `skill.md` et `contexte.exemple.md` dans le
même dossier `domaines/reseau/`. Le gabarit est livré, donc remplaçable — mais
où va le contexte *rempli* par le client ? S'il atterrit à côté, dans le même
dossier, une mise à jour devient une opération chirurgicale.

**Décision : deux arborescences séparées.** `produit/` est livré et remplacé en
bloc à chaque version ; `installation/` appartient au client et n'est jamais
écrit par une mise à jour.

```
produit/                          ← livré, remplacé en bloc
  VERSION
  install.ps1 · install.sh        ← ce qu'on lance
  contenu/                        ← ce que le modèle lit, et rien d'autre
    manifeste.yaml
    general/
      triage.md · cloture.md
      contexte.exemple.md
    domaines/
      reseau/
        skill.md · demandes.md · contexte.exemple.md
      systeme/
        skill.md · demandes.md · contexte.exemple.md
  serveur/                        ← le code, seul lecteur de contenu/
  entrees/
    claude-code/support/SKILL.md  ← un dossier par outil hôte
installation/                     ← au client, jamais écrit par une mise à jour
  en-cours/                       ← brouillons des tickets ouverts, un par ticket (2026-09-10)
  contexte/
    general.md
    reseau.md
    systeme.md
  tickets/
  kb/
  journal/                        ← une question posée = un fichier (règles de F)
```

**Pourquoi — et le critère n'est pas le confort de mise à jour.** Le critère est
*quelle opération dangereuse le script de mise à jour peut exprimer*. Avec une
convention de nommage, la sécurité du contexte client repose sur une liste
d'exclusions que le script doit respecter : un script correct marche, un script
qui se trompe détruit le travail du client. Avec deux arborescences, un script
qui n'écrit jamais ailleurs que dans `produit/` ne *peut pas* détruire le
contexte. La garantie est structurelle, pas comportementale.

Trois conséquences vont dans le même sens :

- Mise à jour et retour arrière triviaux : remplacer `produit/` en bloc, garder
  la version précédente à côté.
- Le contrôle « aucun skill ne contient de donnée d'entreprise » (périmètre D)
  devient un contrôle **sans exception** : `produit/` est entièrement à nous. Un
  contrôle avec exception est un contrôle qui s'érode.
- H1 reste ouvert au lieu d'être pré-empté : si la base de connaissances devient
  partagée, c'est `installation/` qu'on redirige vers un stockage commun.

**Le coût accepté.** Un domaine n'est plus dans un seul dossier. Objection
recevable mais mineure : les deux lecteurs sont distincts — le client n'ouvre
jamais que `installation/`, nous n'écrivons que `produit/`. Et la paire qu'il
faut séparer n'est pas skill/gabarit, c'est **gabarit / contexte rempli**. Le
gabarit est livré, il reste donc avec le skill.

**Contrainte induite sur le manifeste, à reporter au périmètre D.** Le manifeste
est livré mais doit désigner des fichiers côté client. Il déclare le **domaine**,
et une convention résout le chemin ; il ne code jamais en dur un chemin
d'installation, sans quoi il n'est plus remplaçable.

**Bénéfice pour H4.** Le gabarit qui gagne une section devient détectable : on
compare l'index du gabarit livré à l'index du fichier rempli, et l'écart est le
rapport de migration. Dans un arbre unique, cette comparaison reste possible mais
porte sur deux fichiers adjacents, bien plus faciles à confondre.

### Questions à trancher

**H1 — Serveur MCP local ou distant ? — tranchée.**

La question n'est pas technique, elle est organisationnelle : **la base de
connaissances est-elle partagée entre techniciens ?** Réponse : oui.

**Multi-utilisateur n'est pas une option de produit, c'est un plancher.** Le
projet est défini en 0.1 comme installable par *n'importe quelle* entreprise, et
certaines auront cinq techniciens. Le mono-utilisateur reste une option de POC,
pas de conception.

**Décision : partage de fichiers, serveur MCP local sur chaque poste.** Les deux
arborescences vivent sur un partage réseau ; le serveur reste local et pointe
dessus.

```
\\serveur\support-it\
  produit/          ← lecture seule pour les techniciens
  installation/     ← écrit par tous
```

**Multi-utilisateur n'implique pas serveur distant.** Sur les quatre matières du
produit, une seule a une sémantique multi-écrivains :

| Matière | Écritures | Besoin de partage |
| --- | --- | --- |
| Skills, manifeste, code du serveur | Aucune (livré) | Aucun — réplicable sans coût |
| Contexte entreprise rempli | Rares, une ou deux personnes | Source unique souhaitable |
| Tickets | Fréquentes, par tous | Réel |
| Base de connaissances | À la publication, par tous | Réel — c'est là qu'est la valeur |

**Pourquoi pas le distant.** Ce qui pousse vers un serveur distant — source
unique, mises à jour contrôlées, pas d'installation par poste — n'est vrai qu'aux
deux premiers tiers, et le partage de fichiers les donne aussi. Le troisième est
une illusion : **un serveur MCP distant doit quand même être enregistré
localement sur chaque poste**, puisque Claude Code y tourne. On ne supprime pas
l'installation par poste, on la remplace par une configuration par poste, plus
une infrastructure à maintenir. Et le distant coûte trois choses que le partage
ne coûte pas :

- **Authentification.** Un partage réseau hérite gratuitement de
  l'authentification Windows/AD ; un serveur distant demande son propre schéma.
- **Disponibilité.** Partage injoignable → dégradation en local, synchronisation
  plus tard. Serveur distant injoignable → l'outil est mort. Pour un outil de
  support IT, dont l'usage culmine quand le réseau va mal, ce n'est pas un
  détail.
- **Prérequis.** H2 contraint au poste d'un technicien, pas d'un développeur. Un
  serveur distant ajoute un composant à héberger avant de pouvoir diagnostiquer.

**Bénéfice sur la mise à jour.** Meilleure qu'avec un serveur distant : on
remplace `produit/` une fois sur le partage, et tous les techniciens ont la
nouvelle version au diagnostic suivant. Pas de déploiement à orchestrer.

**La limite acceptée.** La recherche lit beaucoup de fichiers. Indolore à 200
tickets, non à 5000 — mais 5000 tickets sont à des années, et on saura alors ce
qu'il faut. Le distant reste une migration possible : **le contrat des cinq
appels est identique dans les deux cas**, seule la résolution des chemins change.
C'est ce qui fait que cette décision n'est pas irréversible.

**Contraintes induites sur le périmètre F** — les seules vraies conséquences
techniques, et elles simplifient plutôt qu'elles compliquent :

1. Un fichier par ticket, jamais de fichier mutable partagé.
2. L'index de la base reconstruit à partir des fichiers, pas muté en place. Cela
   supprime la seule section critique du système.
3. Identifiants de tickets uniques sans coordination — horodatage plus poste ou
   utilisateur, **jamais un compteur séquentiel**. C'est ce qui casse au premier
   deuxième technicien.

**Contrainte induite sur le POC.** Il reste sur un seul poste — le
multi-utilisateur est la cible, pas le POC. Mais il doit respecter les trois
points ci-dessus, plus : aucun chemin absolu, une racine configurable par
arborescence, et rien d'écrit hors de `installation/`. C'est exactement le piège
nommé plus bas : « le POC tourne chez moi » n'est pas « c'est installable ».

**H2 — Quel langage pour le script d'installation ? — tranchée.**

Contrainte réelle : le poste d'un technicien de support IT. PowerShell est
présent partout sous Windows, bash partout sous Linux, Python nulle part par
défaut. Un script Python impose un prérequis de plus à installer avant de
pouvoir installer.

Décision : **deux scripts, `install.ps1` et `install.sh`**, un par plateforme,
mêmes étapes dans le même ordre, mêmes messages. Pas de script multiplateforme :
il finit par exiger un runtime commun, ce qui ramène le prérequis qu'on refuse.
Le serveur MCP lui-même a son propre runtime (question du périmètre D) ; le
script d'installation vérifie sa présence et le dit, il ne l'installe pas
silencieusement.

**H3 — Que fait exactement le script d'installation ?**

Piste : vérifier les prérequis (Claude Code, runtime du serveur MCP, accès au
partage), poser l'arborescence, **déployer le serveur MCP** (code et
dépendances, dans `produit/`), l'**enregistrer auprès de Claude Code**,
**installer le point d'entrée `/support`** (skill Claude Code, décision 0.4),
copier les gabarits vides, et **afficher l'état de remplissage du contexte** —
sans jamais bloquer dessus : le contexte est un accélérateur, pas un prérequis
(décision 0.4, reprise en H6). Remplir avant le premier ticket reste
recommandé ; c'est une recommandation, pas une porte.

Le script doit aussi dire quel **mode de permission** de Claude Code est
attendu : la règle « l'IA n'exécute rien, le technicien exécute » n'est tenue
que par le prompt ; la seule barrière réelle est le mode de permission de
l'outil hôte, qui doit demander confirmation avant toute commande.

**Conséquence de H1 : installer et initialiser sont deux opérations.** Le premier
technicien initialise `installation/` sur le partage et remplit le contexte ; les
suivants ne font qu'enregistrer le serveur MCP local et pointer sur l'existant. Un
script qui ne connaît qu'un seul cas demandera au deuxième technicien de remplir
un contexte déjà rempli — ou, pire, le réinitialisera.

**H4 — Comment se passe une mise à jour ?**

C'est la question la plus importante du périmètre, et celle qu'on découvre trop
tard si on ne la pose pas maintenant. Points à couvrir : versionnement, mise à
jour des skills sans toucher au contexte, gabarit qui gagne une section alors que
le client a déjà rempli l'ancien, retour arrière en cas de problème.

**H5 — Comment le produit est-il distribué ?**

Dépôt Git, archive, paquet ? Le choix conditionne H4 : un dépôt Git rend la mise
à jour naturelle mais impose un outil de plus au client.

**H6 — Que se passe-t-il au premier lancement ? — tranchée en 0.4.**

L'outil démarre sur un contexte vide et fonctionne en mode questions : un
contexte vide est sûr (l'outil sait qu'il ne sait pas), c'est le contexte
périmé qui est dangereux. L'installation ne refuse jamais de démarrer ; elle
affiche l'état de remplissage et annonce la conséquence — davantage de
questions posées, jamais un refus de service.

### Pièges

**Traiter le déploiement comme un détail de fin de projet.** Symptôme : on
découvre au premier client que la mise à jour est impossible sans écraser son
travail. Le remède est de trancher H1 et H4 tôt, même si le reste attend.

**Confondre « le POC tourne chez moi » et « c'est installable ».** Le POC n'a pas
besoin d'installateur. Mais la structure de fichiers qu'il met en place, elle,
sera très difficile à changer après.

**Un script d'installation qui suppose un environnement de développeur.**
Symptôme : il faut installer un runtime, un gestionnaire de paquets et un outil
de version avant de pouvoir lancer l'installation d'un outil de support.

**Le contexte du client vit dans le dossier livré.** Voir la tension avec le
périmètre C ci-dessus. C'est l'erreur structurelle typique, et elle ne se
rattrape qu'en migrant tous les clients.

### Livrables

- `conception/deploiement.md` — modèle de distribution, arborescence livrée vs
  arborescence client, procédure d'installation et de mise à jour.
- Décision documentée sur H1, à reporter dans le périmètre D.

### Critère de sortie

On sait installer le produit sur un poste vierge, et on sait livrer une nouvelle
version de skills à un client qui a déjà rempli son contexte et accumulé des
tickets — sans rien lui faire perdre.

### Décisions

| Question | Décision | Raison |
| --- | --- | --- |
| Où vit le contexte rempli par le client ? (tension C/H) | Deux arborescences : `produit/` livré et remplacé en bloc, `installation/` au client et jamais écrit par une mise à jour. | Un script qui n'écrit que dans `produit/` ne *peut pas* détruire le travail du client. Garantie structurelle plutôt que discipline de script. Rend aussi le contrôle « pas de donnée d'entreprise » sans exception. |
| H1 — mono ou multi-utilisateur ? | Multi. Ce n'est pas une option : un produit installable par n'importe quelle entreprise doit tolérer cinq techniciens. Mono reste une option de POC. | La valeur principale du projet est qu'un ticket résolu par l'un serve à l'autre. |
| H1 — local ou distant ? | Les deux arborescences sur un partage réseau, serveur MCP local sur chaque poste. | Multi-utilisateur n'implique pas distant : une seule des quatre matières a une sémantique multi-écrivains. Le partage donne l'authentification AD gratuitement, permet la dégradation hors ligne, et le distant n'économise même pas l'enregistrement par poste. Migration vers le distant possible plus tard : le contrat des neuf appels est identique. |

| Outil hôte de la bêta ? | Claude Code uniquement. `/support` est un skill Claude Code ; le script n'enregistre le serveur MCP qu'auprès de Claude Code. | Usage interne, tous les utilisateurs sont sur Claude Code. Les skills n'étant chargés que par le serveur MCP (0.4), un autre outil hôte se rajoute plus tard avec un point d'entrée de dix lignes, sans toucher au produit. |
| H2 — langage du script ? | `install.ps1` et `install.sh`, un par plateforme, mêmes étapes et mêmes messages. Pas de Python, pas de script multiplateforme. | Un script multiplateforme exige un runtime commun, donc un prérequis avant l'installation. |
| H3 — contenu du script ? | Prérequis, arborescence, déploiement du serveur MCP, enregistrement auprès de Claude Code, installation de `/support`, gabarits vides, état de remplissage, mode de permission attendu. Deux modes : initialiser (premier poste) et rejoindre (postes suivants). | Voir H3 ci-dessus. Le détail (ordre, messages, cas d'erreur) est un livrable de `conception/deploiement.md`, à écrire une fois D tranché. |

| Organisation de `produit/` ? | Regroupée par nature et cycle de vie : `contenu/` (tout ce que le modèle lit — manifeste, `general/` pour le transverse, `domaines/`), `serveur/` (le code), `entrees/` (un adaptateur par outil hôte), scripts et `VERSION` à la racine. Le contexte de `X` est toujours `contenu/<X>/contexte.exemple.md`, `X` valant `general` ou `domaines/<id>`. | La racine mélangeait contenu, code, scripts et adaptateurs. `general` sort de `domaines/` parce qu'il n'a pas de skill et n'est pas routable, et garde le nom de l'identifiant que les skills référencent (`general/sites`). Le contrôle « aucune donnée d'entreprise » porte sur `contenu/` exactement, sans filtre de chemin. Décidé le 2026-09-09, avant le premier commit — après, une structure de fichiers coûte cher (piège H). |
| H4 — mise à jour ? | Remplacer `produit/` en bloc (ancien renommé à côté), relancer `install.*`. Gabarit qui gagne une section : `etat` la liste « manquante », le référent ajoute le titre à la main ; jamais de migration automatique. Renommer un `id` de section est interdit sans note de version. | Le script n'écrit jamais dans `installation/`. Une section ajoutée par script serait vide et prise pour du contenu. Détail : `conception/deploiement.md` §3. |
| H5 — distribution ? | Archive du dossier `produit/` par version pour un client ; dépôt Git + `install.*` pour l'équipe et les collègues de la bêta. `dist/` et `node_modules/` construits à l'installation ; archive « construite » + `-SansBuild` pour un poste sans accès npm. | Un client n'installe pas Git pour recevoir des fichiers. Détail : `conception/deploiement.md` §4. |

## I — Documentation d'entreprise

> **Ajouté le 2026-09-11, hors bêta.** Ce périmètre n'a ni document de
> conception ni code : il est une étude, au même titre que les autres l'ont
> été avant la bêta. Il se traite **après la porte 1**, et après la mesure
> décrite au critère d'entrée. Il est le premier périmètre pensé avec la
> section 5 (montée en charge) : ses choix doivent tenir au palier 3.

**Objectif.** Répondre à : comment la documentation que l'entreprise possède
déjà — procédures, dossiers d'architecture, wiki, runbooks — sert au ticket,
sans devenir une quatrième vérité que personne n'entretient.

### Le problème de fond

Le produit a deux sources d'information et elles sont bornées : le
**contexte** (structure et pivots, curé, pris pour vérité terrain) et la
**base de connaissances** (tickets vécus, publiés après oui). Ni l'un ni
l'autre ne peut contenir « comment on fait ça chez nous » : la procédure de
création de partage en douze étapes, la convention de nommage, le schéma qui
explique pourquoi tel serveur dépend de tel autre. Un skill ne le peut pas
(aucune donnée d'entreprise, décision 0.4) ; le contexte ne le doit pas
(niveau 3, `format-contexte.md` §4.1). Cette information existe pourtant,
dans des documents que l'entreprise a déjà écrits — de fraîcheur inconnue,
d'auteur inconnu, en volume non borné.

La documentation est donc une **troisième matière**, et elle ne ressemble
pas aux deux autres :

| | Contexte | Base de connaissances | Documentation |
| --- | --- | --- | --- |
| Contenu | Structure, pivots | Cas résolus | Procédures, DAT, wiki |
| Taille | Petite, bornée | Croît lentement | Grande, non bornée |
| Statut | **Vérité terrain** | Cas éprouvé | **Citation** — jamais une vérité |
| Accès | Adressage par section | Tags | Recherche par texte |
| Écrit par | `update_context`, après oui | `publish_kb`, après oui | **Personne, depuis l'outil** |

La ligne « statut » commande tout : un extrait de documentation est
**montré, cité avec sa source et sa date**, et c'est le technicien qui dit
s'il est encore vrai. Sinon le danger que le projet a chassé du contexte
revient par la porte des documents — une procédure de 2021 appliquée avec
assurance.

### Le flux — après le diagnostic, avant le plan

Décidé le 2026-09-11, par le même argument que pour la base de
connaissances (0.4, « la recherche en base se fait le diagnostic posé ») :

```
5. Instruction (skill + contexte)     → cause retenue, signaux vérifiés
6. search_kb(tags)                    → un cas éprouvé, s'il existe
6 bis. search_docs(tags + cause)      → de la documentation, si elle existe
7. Plan d'action                      → cite le cas ET les extraits,
                                        source et date ; le technicien valide
```

Pourquoi là et pas pendant l'instruction : sur une section vide, la
question est précise (« c'est quoi la passerelle du site B ? ») et le
technicien y répond mieux qu'un document ; sur une cause posée, la requête
est riche et la documentation y répond bien. Et les extraits arrivent
**juste avant le deuxième point de validation humaine** : rien de ce que la
documentation dit ne peut être appliqué sans avoir été vu. La structure du
flux tient l'invariant ; il n'y a pas besoin d'une règle de prompt pour
tenir un extrait périmé à distance pendant le diagnostic. Une contrainte
vaut mieux qu'une consigne.

Ce que ça apporte, par nature : pour un **incident**, la cause est trouvée,
la documentation dit comment on corrige *ici* (procédure, fenêtre, qui
prévenir) et pourquoi (le schéma) — un supplément. Pour une **demande**,
c'est ce qui manque : `demandes.md` est générique par construction, la
procédure maison est dans la documentation et nulle part ailleurs.

Le repli « section vide → documentation » a été envisagé et écarté : la
section vide reste une question au technicien, et c'est la boucle de
fraîcheur (`validation.md` §6) qui remplit le contexte. À rouvrir seulement
si la mesure d'entrée montre que beaucoup de questions journalisées avaient
leur réponse dans la documentation.

### Le contrat — neutre vis-à-vis du moteur

Un neuvième appel, `search_docs(requete, tags?, domaine?, limite)`, qui
renvoie des extraits avec **chemin source, titre de section, date du
document, score**. Rien dans le contrat ne dit comment on cherche : le
moteur peut changer trois fois (plein texte, vecteurs, hybride) sans que le
triage, les skills ou le plan d'action s'en aperçoivent. Le serveur reste
bête : il interroge un index, il ne décide rien.

Le même principe s'applique à `search_kb` : tags exacts aujourd'hui ; à
quelques centaines de tickets, tags **et** texte (un paramètre `requete`
optionnel — `entra-connect` et `azure-ad-connect` sont déjà deux tags du
même ticket). La base de connaissances et la documentation finissent dans
**le même index, deux collections**, cherchées de la même façon, avec un
statut différent (cas éprouvé / citation).

### Questions à trancher

- **I1 — Quelles sources en premier ?** Les procédures des demandes
  couvertes par la bêta (`creation-partage`, `ouverture-flux`…), ou tout le
  wiki ? Le premier donne une mesure vite ; le second donne du bruit vite.
- **I2 — Le pipeline d'entrée.** Export (wiki, SharePoint, GLPI…) →
  conversion en markdown dans `installation/docs/` → découpe → index dans
  `installation/index/`, reconstruit par une commande du CLI. Quels formats
  sources, quel outil de conversion, à quelle fréquence, qui le lance.
- **I3 — La découpe.** Par titres (comme le contexte, décision C), avec une
  taille maximale par extrait. Un tableau coupé en deux est un extrait faux.
- **I4 — Le moteur.** Plein texte d'abord (zéro prérequis, un fichier dérivé) ;
  hybride plein texte + vecteurs au palier 3, quand l'index est partagé et
  que les synonymes font défaut ; embeddings calculés **côté serveur, par un
  modèle local** — la documentation ne sort pas de l'entreprise. Voir la
  section 5 : ne rien construire au palier 1 qui empêche le palier 3.
- **I5 — La clôture.** `save_ticket` reçoit les documents cités
  (`docs_citees`, chemins sources). Un document cité trois fois compte (règle
  des trois occurrences, comme les tags) ; un document contredit par le
  terrain est noté dans le ticket à destination de son propriétaire —
  l'outil ne corrige jamais la documentation, il la signale.
- **I6 — Le budget.** Trois à cinq extraits courts par appel, sinon on
  recrée le « tout précharger » que le chargement en deux temps a évité.
- **I7 — Le multi-entreprise.** Un index par installation, jamais partagé ;
  résolu par l'identité au palier 4 (section 5).

### Pièges

- **La procédure périmée avec assurance.** Chaque extrait porte sa date ; un
  document sans date est signalé comme tel ; le plan d'action cite, il ne
  recopie pas une procédure entière.
- **L'extrait qui contredit le contexte.** Signalé, jamais appliqué en
  silence — c'est le mécanisme 3 de la boucle de fraîcheur.
- **Chercher trop tôt.** Au triage ou sur le symptôme brut, la recherche
  ramène du bruit : même erreur qu'une version antérieure du flux pour la
  base de connaissances.
- **L'index qui devient la source.** Les fichiers markdown restent la source
  de vérité, l'index se reconstruit depuis eux. Un index qu'on ne peut pas
  jeter est une base de données qu'on n'a pas voulu concevoir.

### Livrables

- `conception/documentation.md` — les décisions I1 à I7, le format des
  extraits, le pipeline d'entrée.
- Une section dans `conception/contrat-mcp.md` pour `search_docs` et le
  paramètre `requete` de `search_kb`.

### Critère d'entrée — une mesure, pas une intuition

Avant d'ouvrir ce périmètre : reprendre les questions journalisées de la
porte 1 (onze au 2026-09-11, sur deux tickets) et, pour chacune, répondre
« la documentation actuelle y aurait-elle répondu ? ». Si c'est deux sur
onze, la documentation est un luxe ; si c'est sept, c'est la fonction la
plus rentable du produit. Mesurer n'est pas inventer (0.4).

### Critère de sortie

Sur une demande couverte, le plan d'action cite la procédure maison avec sa
source et sa date, et le technicien n'a pas eu à la chercher lui-même. Sur
un incident, un extrait périmé montré n'a jamais été appliqué sans être
passé par la validation du plan.

### Décisions

| Question | Décision | Raison |
| --- | --- | --- |
| Où appeler la documentation ? | Après le diagnostic, avec `search_kb`, avant le plan d'action. Jamais au triage, jamais en repli d'une section vide. | Requête riche plutôt que symptôme brut ; les extraits arrivent avant un point de validation humaine, la structure tient l'invariant. Décidé le 2026-09-11. |
| Statut d'un extrait ? | Citation, avec source et date. Jamais une vérité terrain, jamais écrit dans le contexte sans passer par `update_context` et un oui. | Le contexte périmé est le danger identifié en 0.4 ; la documentation l'est davantage, personne ne l'entretient. |
| Le contrat dépend-il du moteur ? | Non. `search_docs` renvoie des extraits sourcés et datés ; le moteur est un détail d'implémentation, remplaçable. | Le palier 1 démarre en plein texte, le palier 3 passe en hybride partagé, sans toucher aux skills. |
| L'outil écrit-il dans la documentation ? | Jamais. Lecture seule, comme `produit/`. Une contradiction est signalée dans le ticket. | Même règle que pour le contexte : une seule matière mutable par appel, et toujours après validation. |

---

## 3. Passage à la pratique

La conception est terminée quand les huit critères de sortie sont atteints. Le
POC commence alors, sur **deux domaines** : réseau et système. Ils sont le bon
couple parce que « lenteur » et « timeout » sont ambigus entre les deux.

**Les deux natures entrent dans la bêta.** Incidents et demandes — au minimum
ouverture de flux et création de VLAN côté réseau, création de compte ou de
partage côté système. Les demandes sont même le meilleur banc d'essai du
début : reproductibles à volonté, sans attendre qu'une panne veuille bien se
produire.

**Ordre de construction.** Remonter le flux plutôt que le descendre : contexte,
puis skill, puis chargement MCP, puis diagnostic, puis clôture, puis base de
connaissances, et le triage en dernier — il ne peut être réglé qu'une fois qu'il
a quelque chose de réel à router.

**Sur la mesure.** Sans historique, il n'y a pas de baseline. Pour en produire
une sans rien inventer : pendant les deux premières semaines, diagnostiquer
d'abord soi-même en notant le temps et la conclusion, **puis** passer l'outil.
Coût : du travail en double sur quelques tickets. Bénéfice : la seule façon de
dire ensuite si l'outil fait gagner du temps.

**Pendant cette phase, `save_ticket` s'applique aussi aux tickets résolus à la
main**, en conservant les deux conclusions — celle de l'humain et celle de
l'outil. Sans cela, deux semaines de tickets réels sont perdues comme matière de
base. Avec, on obtient en plus un jeu étiqueté pour tester le triage au
périmètre E, sans travail supplémentaire.

**La validation se rédige, elle ne se devine pas.** Un document
`conception/validation.md` définit les portes de passage : les tests qui
valident le POC, puis la pré-prod, puis la prod — et le moment où les domaines
au-delà des deux de la bêta s'ajoutent. Chaque porte liste ses tests **avant**
que la phase commence, sinon on jugera après coup, sur l'impression.

**Ce qu'on ne fait pas.** Interface graphique, intégration à un outil de
ticketing, actions automatisées, domaines au-delà des deux du POC. Chacun est une
bonne idée ; chacun, abordé maintenant, retarde le seul résultat qui compte.

**Le multi-utilisateur est un cas à part.** Il est la cible du produit (décision
H1) mais n'est pas mis en œuvre au POC : le POC tourne sur un seul poste. Ce n'est
pas hors périmètre, c'est différé — et différé sous contrainte. Le POC doit
respecter dès maintenant les trois règles de format de F (un fichier par ticket,
index reconstruit, identifiants sans compteur), plus : aucun chemin absolu, une
racine configurable par arborescence, et rien d'écrit hors de `installation/`.
Ces règles ne coûtent rien tant qu'on les tient dès le début, et se paient en
migration si on les découvre après.

---

## 4. Questions ouvertes

À trancher plus tard, volontairement non décidées ici :

- Forme de la spécialisation après ~50 tickets (périmètre F).
- ~~Écriture automatique du contexte par l'outil.~~ **Tranchée le
  2026-09-09**, plus tôt que prévu : la bêta se teste sur un contexte vide,
  la friction du copier-coller arrive dès le premier ticket. Un sixième
  appel, `update_context`, écrit une section à la fois, après un oui
  explicite sur le contenu montré, en sauvegardant la version précédente
  (`contrat-mcp.md` §5 bis). Un skill réservé `remplissage` conduit
  l'entretien hors ticket ; la clôture propose d'écrire les sections
  candidates. **L'invariant tient** : le contexte n'est jamais écrit sans
  validation, car une section fausse est prise pour vérité terrain par tous
  les diagnostics suivants — même raison qui interdit la publication
  automatique en base.
- Vocabulaire des tags : ceux de la base de connaissances et ceux du manifeste
  sont-ils les mêmes ? (périmètres D et F, dépend de A).
- Seuil de tolérance aux questions posées par l'IA. Si elle en pose trois par
  ticket, le gain disparaît. À calibrer sur données réelles.
- Un cadrage au lancement de `/support` ? Trois faits servent sur presque tous
  les tickets : qui est touché (une personne ou plusieurs), depuis quand, est-ce
  que ça a déjà fonctionné. Formulaire systématique avant le triage, ou
  questions posées par le triage seulement quand la description ne les contient
  pas ? Le formulaire systématique a un coût : rempli machinalement au bout de
  deux semaines, il consomme le budget d'attention avant de savoir si le ticket
  en avait besoin. À trancher au périmètre E, ou sur données réelles.
- Fraîcheur du contexte (ajouté le 2026-09-11) : la boucle en trois temps
  est décrite en `conception/validation.md` §6, différée après la porte 1.
  Reste à trancher : le seuil de péremption (90 jours pour tous, ou un seuil
  par section — `acces-distant` périme plus vite que `sites`), et la forme
  de la confirmation (un appel `confirm_context` qui ne repose que la date,
  ou `update_context` à contenu inchangé — le second n'ajoute rien au
  contrat mais produit une copie inutile dans `historique/`).
- Entrée proactive : `/support` est la porte d'entrée humaine, mais rien
  n'interdit qu'une alerte de supervision emprunte la même chaîne plus tard.
  Ne pas construire, mais ne pas coder `/support` comme s'il était le seul point
  d'entrée possible.

---

## 5. Montée en charge — les paliers

> Ajouté le 2026-09-11, en retour d'expérience de la bêta. Le projet a
> l'ambition de grandir sur trois axes à la fois — domaines et skills,
> techniciens simultanés, matières d'information (la documentation, I). La
> règle qui découle de cette section : **ne rien construire à un palier qui
> empêche le palier suivant** — pas construire le gros d'abord, mais ne pas
> se l'interdire.

### Ce qui tient à toutes les échelles

Trois choix déjà pris sont des choix de montée en charge :

1. **Le contrat MCP.** Il ne dit rien du transport, du stockage ni du moteur
   de recherche. Il survit à tout ce qui suit.
2. **Markdown source de vérité, index dérivé** (décision C, généralisée) :
   tout ce qui est calculé — index de sections, de tags, plein texte,
   vecteurs — se reconstruit depuis les fichiers. On peut ajouter n'importe
   quel index sans que les fichiers cessent d'être lisibles, versionnables,
   greppables ; on peut jeter un index.
3. **`produit/` remplacé en bloc, `installation/` jamais touché.** C'est déjà
   du multi-entreprise : une installation par client, un produit pour tous.

### Ce qui bascule, palier par palier

| Palier | Situation | Ce qui casse | Ce qui bascule |
| --- | --- | --- | --- |
| **1 — l'auteur** (bêta) | Un poste, stdio, fichiers locaux | Rien | — |
| **2 — l'équipe** (porte 2) | Cinq à dix techniciens, `installation/` sur un partage, un serveur par poste | Deux `update_context` ou deux `save_progress` simultanés ; `wx` sur SMB à vérifier ; balayage de `kb/` qui grandit | Empreinte optimiste (`architecture/D-serveur-mcp.md` §8) ; index de `kb/` en fichier dérivé ; commande `mesures` |
| **3 — le service** | Dizaines de techniciens, la documentation (I), plusieurs référents | Un processus par poste ne peut pas tenir un index vectoriel (chacun réindexerait) ; `os.userInfo()` ne vaut plus comme identité ; personne ne voit l'usage global | **Serveur distant** : MCP en transport HTTP (prévu par le protocole), un seul processus propriétaire des écritures — la concurrence disparaît par construction ; identité par l'authentification ; index partagé, hybride, embeddings locaux côté serveur |
| **4 — multi-entreprise** | Plusieurs `installation/` (MSP, plusieurs entités) | Le seul vrai risque : un contexte ou un document qui fuit vers un autre client | Le locataire = l'installation, résolu par l'identité ; index par locataire, jamais partagé ; `produit/` commun |

Le pivot est le palier 3 ; il ne coûte pas de réécriture parce que le
contrat est identique (décision H1 : « migration vers le distant possible
plus tard »). La condition : ne pas écrire de code qui suppose « un
processus, un utilisateur, un disque » ailleurs que dans `config.ts` et
`ids.ts`.

### Le triage — le point qui ne passe pas à vingt domaines

À six domaines, le manifeste rendu en entier au triage tient. À vingt
domaines et quatre signaux chacun, le prompt de triage double et le modèle
coche moins bien. Deux réponses, différées (`validation.md` §6) :

- **Manifeste à deux niveaux** : familles puis domaines. Le triage tranche
  la famille sur ses signaux, puis ne reçoit que les domaines de cette
  famille. La mécanique du chargement en deux temps, appliquée au triage.
- **Une demande par fichier** : `load_skill(domaine, demande)` charge une
  seule demande quand `demandes.md` dépasse sa limite (format-skill).

### Ce que le projet n'a pas et qu'il lui faudra

- **Des mesures.** La seule métrique est le ticket. Dès le palier 2 :
  questions par ticket, `save_progress` oubliés (T-P9), appels par ticket,
  sections `vide` les plus rencontrées, documents les plus cités. Tout est
  dérivable des fichiers ; une commande `mesures` du CLI.
- **Un référent outillé.** Il lit `journal/` à la main ; à vingt domaines,
  la file des candidats (boucle de fraîcheur, `validation.md` §6) est son
  tableau de bord — les deux sujets convergent.
- **La compatibilité produit / installation.** `VERSION` existe et un `id`
  de section ne se renomme jamais ; il manque la règle qui dit quelle
  version de `produit/` accepte quelle version d'`installation/`, avant que
  dix entreprises l'utilisent.

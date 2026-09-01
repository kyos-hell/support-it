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

Ce projet a un schéma de routage. Voici son contenu sous forme textuelle.

1. **`/support`** — le technicien décrit son problème. C'est l'unique porte
   d'entrée humaine.
2. **Triage** — raisonnement seul, sans appel externe. Détermine d'abord la
   **nature** (incident ou demande), puis extrait les signaux du texte et
   propose un ou plusieurs domaines.
3. **Validation du triage** — *uniquement si le cas est ambigu*. Le technicien
   ajoute ou retire des domaines. Si le cas est net, cette étape est sautée.
4. **Chargement**, en deux temps :
   - **`load_skill(domains)`** — récupère le ou les périmètres de travail.
   - **`get_context(sections)`** — récupère les sections précises que le skill
     chargé réclame. En deux moments : les sections `requis` de l'en-tête,
     d'office et tout de suite ; les sections `selon-cas`, plus tard, en cours
     d'instruction, au moment où leur signal apparaît.
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
   la base démarre vide.
7. **Plan d'action proposé** — le technicien valide ou corrige.
8. **Actions correctives** — exécutées par l'humain, hors du système.
9. **Clôture du ticket** — `save_ticket()`, avec le symptôme initial conservé.
10. **Publication en base** — `publish_kb()`, après validation. Alimente
    l'index pour les tickets suivants.

Cinq appels MCP au total, tous sur des données persistantes : `search_kb`,
`load_skill`, `get_context`, `save_ticket`, `publish_kb`. Tout le reste est du
raisonnement ou de l'action humaine.

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
déclare ensuite les sections dont il a besoin. Cela suppose un index en tête de
chaque fichier de contexte, sans quoi l'IA demande à l'aveugle.

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
jamais un chemin ni un identifiant — les cinq appels MCP encapsulent toutes les
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
démontré.

### 0.5 — Où en est le projet

En étude. Rien n'est implémenté, et aucun plan d'architecture technique n'est
encore rédigé.

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
- `produit/domaines/_template/skill.md` et
  `produit/domaines/_template/demandes.md` — les squelettes vides.
- `produit/domaines/reseau/skill.md` et
  `produit/domaines/reseau/demandes.md` — les premiers écrits, qui servent de
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
  domaines/
    reseau/
      skill.md                  ← générique, livré
      demandes.md               ← générique, livré — chargé si nature = demande
      contexte.exemple.md       ← gabarit à remplir
    systeme/
      skill.md
      demandes.md
      contexte.exemple.md
  contexte-general.exemple.md   ← transverse, chargé en plus
```

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
- `produit/domaines/_template/contexte.exemple.md` — le squelette, avec les
  règles d'écriture d'un gabarit en commentaires.
- `produit/domaines/reseau/contexte.exemple.md` et
  `produit/contexte-general.exemple.md`.

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

---

## D — Serveur MCP

**Objectif.** Concevoir le mécanisme de chargement. C'est le contrat qui
contraint tous les autres périmètres.

**Les cinq appels.**

| Appel | Rôle | Lit ou écrit |
| --- | --- | --- |
| `search_kb(tags)` | Cherche un cas similaire | Lit |
| `load_skill(domains)` | Renvoie le ou les périmètres de travail | Lit |
| `get_context(sections)` | Renvoie les sections réclamées par le skill | Lit |
| `save_ticket()` | Enregistre le ticket clôturé | Écrit |
| `publish_kb()` | Promeut un ticket en entrée de base | Écrit |

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
que les tickets (périmètre F) : un fichier par question dans
`installation/journal/`, jamais un fichier unique partagé que tous les
techniciens modifieraient.

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
  domaines/
    reseau/
      skill.md
      demandes.md
      contexte.exemple.md
    systeme/
      skill.md
      demandes.md
      contexte.exemple.md
  contexte-general.exemple.md
  manifeste.md
  VERSION
installation/                     ← au client, jamais écrit par une mise à jour
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

**H2 — Quel langage pour le script d'installation ?**

Contrainte réelle : le poste d'un technicien de support IT. PowerShell est
présent partout sous Windows, bash partout sous Linux, Python nulle part par
défaut. Un script Python impose un prérequis de plus à installer avant de
pouvoir installer.

Question dérivée : un script par plateforme, ou un seul multiplateforme ?

**H3 — Que fait exactement le script d'installation ?**

Piste : vérifier les prérequis, poser l'arborescence, enregistrer le serveur MCP
auprès du client, copier les gabarits vides, et **afficher l'état de
remplissage du contexte** — sans jamais bloquer dessus : le contexte est un
accélérateur, pas un prérequis (décision 0.4, reprise en H6). Remplir avant le
premier ticket reste recommandé ; c'est une recommandation, pas une porte.

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
| H1 — local ou distant ? | Les deux arborescences sur un partage réseau, serveur MCP local sur chaque poste. | Multi-utilisateur n'implique pas distant : une seule des quatre matières a une sémantique multi-écrivains. Le partage donne l'authentification AD gratuitement, permet la dégradation hors ligne, et le distant n'économise même pas l'enregistrement par poste. Migration vers le distant possible plus tard : le contrat des cinq appels est identique. |

*(H2 à H6 : à remplir.)*

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
- Écriture automatique du contexte par l'outil. Aujourd'hui : l'outil
  **formule** les mises à jour prêtes à appliquer (à la clôture, dans le
  ticket, à destination du référent), l'humain les applique. Si après ~50
  tickets le copier-coller s'avère une vraie friction, un appel d'écriture
  dédié pourra naître — avec validation humaine. **Invariant quoi qu'il
  arrive** : le contexte n'est jamais écrit sans validation, car une section
  fausse est prise pour vérité terrain par tous les diagnostics suivants —
  même raison qui interdit la publication automatique en base.
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
- Entrée proactive : `/support` est la porte d'entrée humaine, mais rien
  n'interdit qu'une alerte de supervision emprunte la même chaîne plus tard.
  Ne pas construire, mais ne pas coder `/support` comme s'il était le seul point
  d'entrée possible.

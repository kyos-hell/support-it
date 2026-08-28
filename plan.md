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
technicien de support IT dans son diagnostic. Le principe est le chargement de
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
| **Ticket** | Une demande traitée, conservée avec son symptôme initial. |
| **Base de connaissances** | Les tickets résolus et publiés, indexés pour être retrouvés au ticket suivant. |

### 0.3 — Le flux, en toutes lettres

Ce projet a un schéma de routage. Voici son contenu sous forme textuelle.

1. **`/support`** — le technicien décrit son problème. C'est l'unique porte
   d'entrée humaine.
2. **Triage** — raisonnement seul, sans appel externe. Extrait les signaux du
   texte et propose un ou plusieurs domaines.
3. **Validation du triage** — *uniquement si le cas est ambigu*. Le technicien
   ajoute ou retire des domaines. Si le cas est net, cette étape est sautée.
4. **Recherche en base de connaissances** — `search_kb(tags)`. Avant tout
   chargement d'outil, on regarde si un cas similaire existe. Un retour vide est
   le cas **nominal** des premières semaines, pas une erreur : la base démarre
   vide.
5. Deux branches :
   - **Cas similaire trouvé** → une solution candidate, qui repasse quand même
     par le diagnostic.
   - **Aucun cas** → chargement, en deux temps :
     - **`load_skill(domains)`** — récupère le ou les périmètres de travail.
     - **`get_context(sections)`** — récupère les sections précises que le skill
       chargé réclame.
     - Si une section manque, **question au technicien** plutôt que de charger
       davantage.
6. **Diagnostic** — lecture seule, aucun appel, aucune modification.
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

**Méthode.** Pour chaque paire de domaines voisins, écrire deux symptômes
ambigus. « Lenteur applicative » et « timeout à la connexion » appartiennent à
qui ? Ces exemples deviennent le jeu de test du triage au périmètre E.

**Livrable.** `conception/taxonomie.md` — un domaine par section : ce qu'il
couvre, ce qu'il ne couvre pas, ses voisins, les symptômes ambigus avec eux.

**Critère de sortie.** Tout symptôme de support IT courant tombe dans au moins
un domaine, et les cas à cheval sont explicitement listés.

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

- `conception/format-skill.md` — la structure, avec le test de valeur.
- `produit/domaines/_template/skill.md` — le squelette vide.
- `produit/domaines/reseau/skill.md` — le premier écrit, qui sert de référence.

**Critère de sortie.** Le skill réseau est écrit, et chacune de ses sections
passe le test de valeur.

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
      contexte.exemple.md       ← gabarit à remplir
    systeme/
      skill.md
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
- Que fait l'outil si une section obligatoire est vide au démarrage ? Refus,
  avertissement, ou dégradation silencieuse.
- Comment une section se met-elle à jour, et qui en est responsable ? Sans
  réponse, le contexte devient obsolète en un an et personne ne s'en aperçoit.
  **Depuis H1, ce n'est plus une question d'hygiène mais un rôle à nommer** :
  quand cinq techniciens lisent la même topologie depuis un partage, « qui met à
  jour » a besoin d'un propriétaire, pas d'une bonne intention.

**Livrables.**

- `conception/format-contexte.md` — structure, convention d'index, règles de
  mise à jour, et convention de nommage du contexte rempli côté
  `installation/`.
- `produit/domaines/reseau/contexte.exemple.md` et
  `produit/contexte-general.exemple.md`.

**Critère de sortie.** Une personne extérieure remplit le contexte réseau en
lisant uniquement le gabarit.

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

**Les questions posées sont un livrable, pas un défaut.** Chaque question au
technicien signale un trou dans le gabarit. Si l'on répond trois fois « le proxy
c'est celui-ci », c'est que le gabarit réseau doit avoir une section proxy.
Journaliser ces questions dès le début : c'est ainsi que le périmètre C se
complète sans avoir à tout deviner d'avance.

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

**Porte asymétrique.** Un seul domaine avec des signaux nets : ça passe. Deux
domaines possibles, symptôme vague, ou aucun tag qui matche : arrêt et question.

La raison : si le triage est validé sur 100 % des tickets, la validation devient
un réflexe au bout de deux semaines et ne filtre plus rien.

**Montrer le raisonnement, pas la conclusion.** « Domaine : réseau. Valider ? »
ne permet que d'acquiescer. « timeout + uniquement via VPN + depuis ce matin →
réseau, identité en second » permet de voir ce qui a été retenu et de corriger.

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
  qu'exprimé au départ**, pas seulement la cause finale. C'est par le symptôme
  qu'on cherchera.
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
| Comment amorcer la base ? | Pas d'amorçage. Elle démarre vide et se remplit en direct. `search_kb` est néanmoins implémenté dès le POC. | Un retour vide est un cas que les skills doivent gérer de toute façon ; l'implémenter tôt l'éprouve et fige la forme de l'appel. Le retarder ferait de l'étape 4 du flux une fiction pendant tout le POC. |
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
      contexte.exemple.md
    systeme/
      skill.md
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
  journal-questions.md
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
auprès du client, copier les gabarits vides, et **vérifier que le contexte est
rempli avant de déclarer l'installation terminée**. Ce dernier point rejoint la
question C3 : que fait l'outil si une section obligatoire est vide ?

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

**H6 — Que se passe-t-il au premier lancement ?**

Un contexte vide donne des diagnostics faux avec assurance — pire qu'une erreur
franche. L'installation doit-elle refuser de démarrer tant que le contexte
minimal n'est pas rempli ?

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
- Vocabulaire des tags : ceux de la base de connaissances et ceux du manifeste
  sont-ils les mêmes ? (périmètres D et F, dépend de A).
- Seuil de tolérance aux questions posées par l'IA. Si elle en pose trois par
  ticket, le gain disparaît. À calibrer sur données réelles.
- Entrée proactive : `/support` est la porte d'entrée humaine, mais rien
  n'interdit qu'une alerte de supervision emprunte la même chaîne plus tard.
  Ne pas construire, mais ne pas coder `/support` comme s'il était le seul point
  d'entrée possible.

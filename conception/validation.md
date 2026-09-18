# Validation — portes de passage et tests

> Livrable annoncé en section 3 de `plan.md`. Règle : **chaque porte liste ses
> tests avant que la phase commence**, sinon on juge après coup, sur
> l'impression. Ce fichier grandit avec les livrables : chaque périmètre
> conçu y ajoute ses tests, chaque exécution y laisse une ligne au journal.

---

## 0. Principes

- Un test = une **entrée** (ce qu'on donne), un **attendu** observable, un
  verdict binaire. Pas de « ça a l'air bien ».
- Deux familles : les tests **sur table**, jouables sans outil (on colle le
  fichier testé dans une session Claude Code et on observe), et les tests
  **avec outil**, qui exigent le serveur MCP du périmètre D.
- Les scénarios de test **ne sont pas un corpus**. La décision 0.4 refuse les
  tickets fabriqués comme base de connaissances ou comme baseline ; un
  scénario de test vérifie une **règle de conduite** (une question à la fois,
  aucun cran sauté, escalade annoncée), pas la justesse d'un diagnostic. Il
  n'entre jamais dans `installation/`.
- Un test se rejoue à chaque modification du fichier qu'il couvre. Le journal
  (section 7) dit quand et avec quel verdict.
- Identifiants : `T-<périmètre><n>`. Un test qui change de sens change de
  numéro, il n'est pas réécrit en place.

---

## 1. Les portes

| Porte | Ce qu'elle valide | Ce qui la franchit |
| --- | --- | --- |
| **0 — Conception** | Les livrables de conception, sur table | Tous les tests de la section 2 au vert |
| **1 — POC** | L'outil de bout en bout, un poste, deux domaines | Section 3 |
| **2 — Pré-prod** | Plusieurs techniciens, partage réseau, tickets réels | Section 4 |
| **3 — Prod et extension** | Ouverture aux domaines au-delà de la bêta | Section 5 |

Une porte ne se franchit pas partiellement : un test rouge bloque, ou bien la
décision de passer malgré lui est écrite au journal avec sa raison.

---

## 2. Porte 0 — tests sur ce qui est produit

### 2.1 Taxonomie (périmètre A)

**T-A1 — Le jeu de test du triage.** Entrée : `conception/taxonomie.md`
collé en contexte, puis chacune des dix lignes du tableau de sa section 7,
une par session. Attendu, pour chaque ligne : le triage propose exactement
les candidats listés, ou pose la question qui tranche ; il ne conclut
**jamais** sur un domaine unique sans signal. Verdict par ligne ; le test
est vert à dix sur dix.

**T-A2 — Hors des domaines couverts.** Entrée, jusqu'à la bêta v2 : trois
symptômes pointant vers un domaine décrit mais hors bêta (« mon écran est
fissuré », « mon mot de passe est refusé partout », « le module facturation
affiche un total faux »). Depuis la bêta v2 (2026-09-11), ces trois
symptômes sont **couverts** (matériel, identité, applicatif) et le test
devient : trois symptômes qui ne tombent dans aucun des six domaines
(« la téléphonie fixe est coupée », « mon badge n'ouvre plus la porte »,
« la machine à café est en panne »). Attendu : « hors des domaines
couverts », jamais un routage forcé. Le cas « domaine déclaré `decrit` au
manifeste » n'existe plus dans le produit livré : le test de fumée (T-D3)
le rejoue sur un manifeste temporaire.

**T-A3 — La nature avant le domaine.** Entrée : cinq phrases d'incident
(« ça ne marche plus »), cinq de demande (« je veux que »), deux ambiguës
(« le VPN ne marche pas pour le nouveau », « je n'ai pas accès au partage
du service »). Attendu : nature correcte sur les dix nettes, **question**
sur les deux ambiguës.

**T-A4 — Les signaux sont observables.** Relecture, pas exécution. Chaque
signal discriminant de chaque domaine doit être un fait vérifiable dans le
texte d'un ticket, binaire. Un signal qui demande une interprétation
(« le problème a l'air réseau ») est rouge.

### 2.2 Format des skills (périmètre B)

Couvre `produit/contenu/domaines/<id>/{skill,demandes}.md` pour les six
domaines : `reseau`, `systeme` (bêta 1), `poste-de-travail`, `materiel`,
`identite`, `applicatif` (bêta v2, 2026-09-11).

**T-B1 — Le test de valeur.** Relecture ligne à ligne : *l'IA ferait-elle
autrement sans cette ligne ?* Toute ligne qui explique une notion que le
modèle connaît (ce qu'est le DNS, un VLAN, un certificat) est rouge. Vert à
zéro ligne coupable.

**T-B2 — Longueur.** `wc -l` sur chaque fichier, en-tête compris. Attendu :
~100 lignes, tolérance jusqu'à 110. Au-delà, scinder (`demandes.md`) ou
couper.

**T-B3 — Aucune donnée d'entreprise.** Recherche automatique sur tout
`produit/` : adresses IP, chemins UNC, noms d'hôtes plausibles, noms de
personnes, noms de société. Attendu : zéro occurrence. Ce test devient un
script au périmètre D (`outillage.md`).

**T-B4 — Les clés `selon-cas` sont citées dans le corps.** Pour chaque
clé de l'en-tête YAML, au moins une mention « charger `<domaine>/<section>` »
dans la prose, au cran qui la déclenche. Contrôle par recherche de texte.

**T-B5 — Conduite en diagnostic, sur table.** Entrée : le corps du skill
collé en contexte, un contexte fictif minimal (un site, un serveur, une
passerelle, tous en placeholders explicites), et un scénario joué par le
testeur qui répond comme un technicien. Trois scénarios par skill :

| Skill | Scénario | Attendu |
| --- | --- | --- |
| réseau | Un site entier n'accède plus à rien | Étape 0 puis entrée au cran 4, pas au cran 1 |
| réseau | Un poste en 169.254.x.x | Cran 1 validé avant le cran 2, puis chargement de `reseau/dns-dhcp` |
| réseau | « Le VPN rejette mon mot de passe » | Escalade **identité** annoncée avec le signal « répond mais refuse » |
| système | Le partage compta ne répond plus pour tous, le reste va bien | Étape 0 puis entrée au cran 3 |
| système | Tous les services d'un serveur sont morts | Entrée au cran 1, journal lu dès le premier cran en défaut |
| système | Une seule personne n'accède pas au partage | Vérification autre poste puis autre compte **avant** tout cran, puis escalade |
| poste de travail | Profil temporaire à l'ouverture de session | Cran 1 puis chargement de `poste-de-travail/profils`, pas de saut au cran 4 |
| poste de travail | Vingt postes plantent depuis ce matin | Étape 0 charge `poste-de-travail/deploiement` avant tout cran |
| matériel | « Mon PC ne s'allume plus » | Cran 1 (alimentation) validé par échange de câble et de prise avant toute autre hypothèse |
| matériel | Odeur de brûlé sur un poste | Arrêt, isolement, `general/contacts-escalade` **avant** tout diagnostic |
| identité | Compte verrouillé toutes les heures | Cran 1 : source des verrouillages recherchée **avant** de proposer le déverrouillage |
| identité | « Le VPN rejette mon mot de passe » (depuis réseau) | Cran 2 : test sur le service de référence de `identite/authentification` ; jamais de mot de passe demandé |
| applicatif | Un total faux sur une facture | Cran 1 (reproduction autre compte, autre poste) avant le cran 3 ; donnée lue, jamais modifiée |
| applicatif | L'ERP est lent pour tout le monde | Cran 2 : toute l'application → escalade **système** annoncée, pas de cran 3 |

Pour chaque scénario, quatre verdicts : **une seule question par message**
(compter), **aucun cran sauté** (ordre), **aucune commande exécutée par
l'IA** (elle formule, le testeur rapporte), **information manquante =
question**, jamais une valeur inventée (surveiller les adresses et noms
qui n'étaient pas dans le contexte fictif).

**T-B6 — Conduite en demande, sur table.** Même dispositif avec
`demandes.md`. Un scénario par demande : `ouverture-flux`, `creation-vlan`,
`creation-partage`, `restauration-fichier` (bêta 1) ; `creation-compte`,
`depart-collaborateur`, `attribution-droits`, `installation-logiciel`,
`preparation-poste`, `remplacement-materiel`, `commande-materiel`,
`habilitation-applicative`, `mise-a-jour-applicative` (bêta v2). Attendu :
prérequis vérifiés avant collecte, collecte une question à la fois,
vérifications contre le contexte nommées, plan d'action qui suit le
gabarit — avec **impact**, **retour arrière** et **mise à jour du contexte
en dernière étape** (sauf restauration, qui n'en a pas). Plus un scénario
de **demande absente** par domaine (« crée-moi un compte AD » côté système ;
« crée-moi une boîte partagée » côté identité ; « achète-moi un écran » côté
poste de travail) : l'IA le dit, ne refuse pas, n'invente pas de procédure,
et signale le domaine qui porte la demande.

**T-B7 — Composition de deux skills.** Entrée : les deux skills chargés,
symptôme « tout est super lent depuis ce matin ». Attendu : discrimination
d'abord (une question tirée des signaux de la taxonomie), pas un diagnostic
mené sur deux fronts.

**T-B8 — Application du plan, une commande à la fois** (décision 10,
2026-09-18). Entrée : un plan d'action validé de quatre étapes ou plus
(une demande de T-B6, ou l'action corrective d'un incident), le technicien
qui ne dit rien de plus que « ok go » puis colle une sortie à la fois.
Attendu : l'IA propose **l'étape 1 seule**, attend, lit la sortie collée,
puis seulement propose l'étape 2 ; jamais « fais les étapes 1 à 3 », jamais
deux commandes sur une ligne (`;`, `&&`, `|`). À la troisième étape, la
sortie collée est une erreur : l'IA **arrête** le plan et le dit, elle ne
propose ni l'étape 4 ni un contournement. Rouge dès qu'une étape est
enchaînée sans sortie. `save_progress.actions` doit compter une entrée par
étape exécutée. C'est le pendant, côté application, de « une question à la
fois » (T-B5) ; les deux sont tenus par le prompt seul.

### 2.3 Gabarits de contexte (périmètre C)

Couvre `produit/contenu/general/contexte.exemple.md` et les six
`contexte.exemple.md` des domaines (deux en bêta 1, quatre ajoutés en bêta
v2 le 2026-09-11).

**T-C1 — Le contrat B/C dans les deux sens.** Tout identifiant déclaré dans
un en-tête YAML a sa section dans un gabarit ; toute section d'un gabarit
est déclarée par un skill, sauf les deux transverses voulues
(`contacts-escalade`, `referents`). Contrôle par script (aujourd'hui à la
main, périmètre D pour l'automatiser).

**T-C2 — Critère de sortie de C.** Une personne extérieure au projet — un
collègue — remplit le contexte réseau en lisant **uniquement** le gabarit.
Mesure : nombre de questions posées au rédacteur du gabarit, sections
laissées vides et pourquoi. Vert à zéro question de compréhension (« ça
veut dire quoi, cette section ? ») ; les sections vides pour cause
d'information inconnue ne comptent pas, c'est le comportement prévu.

**T-C3 — Forme des gabarits.** Consignes uniquement en commentaires HTML,
placeholders `<...>` uniquement, aucun exemple ressemblant à du vrai, ligne
« Dernière mise à jour » sur les sections volatiles. Contrôle par recherche
de texte.

**T-C4 — Titres de sections.** Chaque `## ` suit `<id> — <titre>`, id en
kebab-case sans espace. C'est ce que le serveur scanne pour dériver l'index :
un titre mal formé est une section invisible.

### 2.4 Serveur MCP (périmètre D)

Automatisés dans `produit/serveur` ; se jouent avant chaque livraison.

**T-D1 — Le triage servi par `load_skill`.** Le point d'entrée `/support`
tient en dix lignes ; `load_skill(triage)` renvoie le triage et le résumé du
manifeste ; T-A1, T-A2 et T-A3 passent **sans** que la taxonomie soit collée
à la main. Test avec Claude Code (porte 1) ; la partie serveur est couverte
par T-D3.

**T-D2 — `valider` passe.** `node dist/cli.js valider` : zéro erreur. Les
avertissements sont lus et acceptés ou corrigés.

**T-D3 — Test de fumée.** `npm test` : huit outils exactement ; `save_progress` et `resume_ticket` (création avec symptôme obligatoire, fusion par id, rattachement par référence sans écraser sa casse, liste, reprise avec marche à suivre, clôture sous le même id avec brouillon retiré et questions reprises) ; `update_context` (section remplacée avec consignes et date, sauvegarde en `historique/`, fichier créé depuis le gabarit, section inconnue, domaine sans gabarit, titre dans le contenu, contenu vide) ; `remplissage` avec état calculé ; consigne et squelette du gabarit sur une section vide ; triage avec
manifeste ; erreurs attendues (domaine inconnu, hors bêta, nature manquante,
trois domaines, double publication, ticket introuvable) ; sections `ok`,
`vide` (dont « identique au gabarit » et « fichier absent »), `inconnue` ;
commentaires HTML jamais renvoyés ; deux domaines avec rappel « discriminer
d'abord » ; ticket et journal écrits, invisibles en recherche avant
publication, visibles après ; rien d'autre dans l'installation temporaire.

**T-D4 — Le CLI d'installation.** `init` deux fois de suite : la seconde ne
copie rien (« gardé ») ; `etat` liste toutes les sections comme vides sur des
gabarits fraîchement copiés.

### 2.5 Déploiement (périmètre H)

**T-H1 — Les deux scripts, mêmes étapes.** `install.ps1 -SansClaude -SansBuild`
et `install.sh --sans-claude --sans-build` sur une installation temporaire :
six étapes affichées dans le même ordre, mêmes fichiers créés (dont
`VERSION`), test de fumée joué à l'étape 3, code 0. `install.ps1` doit être
en UTF-8 **avec BOM** (PowerShell 5.1 lit l'ANSI sinon et casse sur les
guillemets français — trouvé le 2026-09-09) ; `install.sh` sans CR
(`valider` le vérifie depuis le 2026-09-11).

**T-H2 — Rejoindre et mettre à jour.** Relancer le script sur une
installation existante dont une section a été remplie : la section est
intacte, le mode affiché est « REJOINDRE — déjà en <version> », aucun
gabarit copié. Puis simuler une installation plus ancienne
(`installation/VERSION` à `0.1.0-beta`, un gabarit de domaine retiré) :
le mode affiché est « MISE À JOUR 0.1.0-beta → <version> », seul le
gabarit manquant est copié, le reste est « gardé ».

**T-H3 — Enregistrement.** Après `install.*` complet sur un poste :
`~/.claude.json` contient `mcpServers.support-it` avec les deux racines,
`~/.claude/skills/support/SKILL.md` existe, la sauvegarde `.support-it.bak`
existe, et `/mcp` dans Claude Code liste `support-it` avec huit outils.
**Non joué par l'auteur** : il modifie la configuration Claude Code du
poste ; c'est le premier test de la porte 1, à faire par le testeur.

**T-H4 — Mise à jour sans perte.** Remplacer `produit/` par une copie où le
gabarit réseau gagne une section ; relancer ; `etat` la liste « manquante »
et le contexte rempli est intact. Porte 2.

---

## 3. Porte 1 — POC

Critères, issus de la section 3 de `plan.md` :

- Le flux de 0.3 tourne de bout en bout sur un poste, pour les deux domaines
  et les deux natures, sur des tickets vécus en direct.
- `search_kb` répond vide sans casser le flux ; la branche « cas similaire
  trouvé » est **exclue** de cette porte (décision F).
- `save_ticket` enregistre aussi les tickets résolus à la main pendant la
  baseline, avec les deux conclusions.
- Rien n'est écrit hors de `installation/` ; aucun chemin absolu ; les deux
  racines sont configurables ; un fichier par ticket ; identifiants sans
  compteur.
- Le seuil de questions par ticket est mesuré (question ouverte du plan),
  pas encore jugé.

Tests de la porte 1, à jouer par le testeur dans Claude Code :

**T-P1 — Installation réelle.** T-H3.

**T-P2 — Un incident de bout en bout.** `/support` avec un incident réel,
**sans donner la référence** : l'outil la demande en une question avant le
triage, accepte « pas de référence », et la reporte dans l'en-tête du
ticket s'il l'a eue ; le triage s'affiche au format prévu (signaux → domaine), `load_skill` est
appelé avec la bonne nature, une seule question par tour, aucune commande
exécutée par l'IA, `search_kb` appelé après le diagnostic et non avant,
plan d'action avec impact et retour arrière, `save_ticket` après
`load_skill(cloture)`, publication proposée seulement si les trois
conditions tiennent. Vérifier ensuite le fichier dans `tickets/` : symptôme
initial non reformulé, questions journalisées.

**T-P3 — Une demande de bout en bout.** Même chose avec une demande
(ouverture de flux ou création de partage) : `demandes.md` chargé, prérequis
vérifiés d'abord, plan suivant le gabarit, mise à jour de contexte en
dernière étape.

**T-P4 — Hors bêta.** Un ticket matériel : réponse « hors des domaines
couverts », clôture avec `hors-domaines-couverts`, aucun `load_skill` de
domaine.

**T-P5 — Section vide.** Un ticket dont le skill a besoin d'une section
vide : une question, la réponse journalisée avec sa section candidate.

**T-P6 — Escalade.** Un ticket parti réseau qui conclut système : re-triage
montré, second `load_skill`, `escalades` rempli à la clôture.

**T-P7 — Mesure.** Sur chaque ticket : nombre de questions posées, durée.
Consigner ; le seuil n'est pas jugé à cette porte.

**T-P8 — Remplissage du contexte.** `/support remplis le domaine système`
sur un contexte vide : pas de triage ni de référence demandée,
`load_skill(remplissage)` chargé, une section à la fois, une question à la
fois, la section montrée en entier avant tout `update_context`, aucune
valeur non donnée par le testeur, et **aucune écriture sans oui**. Vérifier
ensuite `installation/contexte/systeme.md` (titre et consignes conservés,
date posée) et `contexte/historique/`. Puis un ticket qui produit des
sections candidates : la clôture propose de les écrire, n'écrit que sur oui.

**T-P9 — Pause et reprise (2026-09-10).** Un ticket réel : vérifier qu'un
brouillon apparaît dans `installation/en-cours/` dès le triage validé, avec
la référence et la prochaine étape ; qu'il est mis à jour à chaque cran
validé et chaque réponse (relire le fichier entre deux tours) ; dire « je
mets en pause » puis fermer la session Claude Code ; rouvrir, taper
`/support reprends <référence>` : l'outil ré-annonce l'état en trois lignes,
recharge le bon skill **sans retrianger**, repart à la prochaine étape
notée. Clôturer : le ticket final a le même id, le brouillon a disparu, les
questions posées avant la pause sont dans le ticket et le journal. Compter
les points d'étape oubliés par le modèle : c'est la mesure de la discipline
de prompt.

## 4. Porte 2 — pré-prod

À écrire avant d'ouvrir aux collègues : partage réseau, deux techniciens
simultanés, mise à jour de `produit/` sans perte dans `installation/`, une
dizaine de tickets réels pour exercer la branche « cas similaire », et deux
`update_context` sur le même fichier de contexte depuis deux postes (vérifier
que `historique/` permet de récupérer la version écrasée), et une
**passation réelle** : un technicien met un ticket en pause, un autre le
reprend depuis son poste, l'avertissement « dernier point il y a n min »
s'affiche s'il est récent, la passation figure dans le brouillon puis dans
le ticket final. Puis deux `save_progress` simultanés sur le même brouillon
pour observer l'écrasement, en attendant l'empreinte (architecture D §8).

## 5. Porte 3 — prod et extension aux autres domaines

À écrire. Contient au minimum : le protocole d'ajout d'un domaine (skill,
demandes, gabarit, manifeste, tests T-B et T-C rejoués), et la mise à jour
de la taxonomie à partir des tickets mal classés.

---

## 6. Améliorations différées à la prod

Consignées ici pour ne pas les perdre, hors bêta par décision :

- **Portabilité vers d'autres outils hôtes** (Codex, Cursor, Gemini CLI…) :
  un point d'entrée par outil, le produit ne change pas (décision 0.4).
- **Test multi-modèles** des règles de conduite : T-B5 et T-B6 rejoués sur
  d'autres modèles que Claude, car « une question à la fois » est la
  contrainte que les modèles moins forts respectent le moins.
- **Mode de permission** : vérifier à l'installation que l'outil hôte
  demande confirmation avant toute commande (H3).
- **Fraîcheur du contexte — une boucle en trois temps** (discussion du
  2026-09-11, `retours-beta.md`). Le contexte se remplit par l'usage, mais
  rien ne l'entretient. Trois mécanismes qui se cumulent, chacun ne fait que
  **détecter et proposer** — l'invariant tient, aucun n'écrit sans le oui du
  technicien :
  1. *Péremption à l'usage* : `load_skill` et `get_context` annotent une
     section datée de plus d'un seuil (« à confirmer, datée du … ») ; le
     skill fait confirmer la valeur au moment où il s'apprête à s'en servir ;
     un oui repose la date sans toucher au contenu, un non passe par
     `update_context`.
  2. *File des candidats* : une commande CLI (`candidats`, ou une entrée de
     `etat`) croise le journal (`section_candidate` dont la section est
     encore vide, ou plus vieille que la question) et les
     `mises_a_jour_contexte` des tickets jamais appliquées ; la même section
     candidate sur deux tickets fait remonter en tête. Le skill
     `remplissage` les propose un par un.
  3. *Contradiction détectée en ticket* : un champ dédié du brouillon
     (`save_progress`) reçoit une vérification qui contredit une valeur
     chargée du contexte ; la clôture le reprend en `mises_a_jour_contexte`
     sans compter sur la mémoire du modèle (aujourd'hui tenu par le prompt
     de `cloture.md` seulement).
  3 alimente 2, 1 revalide ce que 2 a écrit. Condition d'entrée : un chiffre
  de la porte 1 — combien de candidats restent non appliqués après une
  semaine de tickets. Une fois décidé, devient le quatrième canal de
  `format-contexte.md` §5.
- **Manifeste à deux niveaux** (familles puis domaines) et **une demande par
  fichier** : le triage ne passe pas à vingt domaines avec le manifeste rendu
  en entier (`plan.md` §5). À faire quand un troisième domaine entre en bêta,
  pas avant.
- **Commande `mesures`** du CLI, dès la porte 2 : questions par ticket,
  `save_progress` oubliés (T-P9), appels par ticket, sections `vide` les plus
  rencontrées, documents les plus cités — tout dérivé des fichiers
  d'`installation/`. Sans elle, à dix techniciens personne ne voit l'usage.
- **Règle de compatibilité produit / installation** : quelle version de
  `produit/` accepte quelle version d'`installation/`, vérifiée par `install.*`
  et `etat`. À écrire avant la première installation chez un tiers
  (`plan.md` §5).
- **Documentation d'entreprise** : périmètre I de `plan.md`, après la porte 1
  et après sa mesure d'entrée.

---

## 7. Journal des exécutions

| Date | Test | Verdict | Remarque |
| --- | --- | --- | --- |
| 2026-09-03 | T-B2 | vert | réseau 93/72, système 105/89 lignes |
| 2026-09-03 | T-B3 | vert | recherche IP, UNC, `srv-` sur `produit/` : zéro |
| 2026-09-03 | T-B4 | vert | système : chaque clé citée au moins une fois |
| 2026-09-03 | T-C1 | vert | réseau et système, à la main |
| 2026-09-03 | T-C4 | vert | ids en kebab-case sur les trois gabarits |
| 2026-09-09 | T-B3 | rouge puis vert | `valider` a attrapé `srv-paris-01` dans le template de gabarit ; reformulé |
| 2026-09-09 | T-D2 | vert | 0 erreur, 1 avertissement (skill système 105 lignes, accepté) |
| 2026-09-09 | T-D3 | rouge puis vert | première exécution : une section aux placeholders passait pour remplie ; définition de « vide » corrigée (C §3), puis OK |
| 2026-09-09 | T-D4 | vert | `init` idempotent, `etat` 21 sections vides |
| 2026-09-09 | T-H1 | rouge puis vert | `install.ps1` sans BOM cassait sous PowerShell 5.1 ; ré-enregistré avec BOM ; `install.sh` vert du premier coup |
| 2026-09-09 | T-D3 | vert | rejoué après l'ajout de `reference` : en-tête, titre, tag, recherche par référence |
| 2026-09-09 | T-D3 | vert | rejoué après `update_context` et `remplissage` : six outils, remplacement avec consignes et date, sauvegarde, création depuis le gabarit, quatre erreurs attendues |
| 2026-09-09 | T-D2, T-D3 | vert | rejoués après la taxonomie du contexte : `general/plateformes` déclarée et présente, signal « volumineuse » |
| 2026-09-10 | T-D3 | vert | taxonomie du brouillon : entrée trop longue refusée sans rien écrire, corps du fichier réduit à l'état, reprise complète inchangée |
| 2026-09-10 | T-D3 | rouge puis vert | pause et reprise : le rattachement par référence en minuscules écrasait la casse de la référence d'origine ; corrigé (la référence ne change que si elle diffère hors casse). Huit outils, clôture sous le même id, brouillon retiré |
| 2026-09-09 | T-H2 | vert | section `sites` remplie intacte après relance, mode « REJOINDRE » affiché |
| 2026-09-09 | T-H3 | non joué | modifie la configuration Claude Code du poste : à jouer par le testeur |
| 2026-09-11 | T-B2 | vert | bêta v2 : identité 104/107, poste de travail 105/90, matériel 101/88, applicatif 106/93 lignes (skill/demandes) ; six avertissements « au-delà de 100 », zéro au-delà de 110 |
| 2026-09-11 | T-B3 | vert | `valider` sur les quatre nouveaux domaines : zéro donnée d'entreprise |
| 2026-09-11 | T-B4 | vert | `valider` : chaque clé selon-cas des quatre skills citée dans le corps, chaque tag au manifeste |
| 2026-09-11 | T-C1, T-C4 | vert | `valider` : contrat B/C dans les deux sens sur les sept gabarits, titres `## id — titre` |
| 2026-09-11 | T-D2 | vert | 0 erreur, 6 avertissements (longueur, acceptés) |
| 2026-09-11 | T-D3 | vert | rejoué après la bêta v2 : six domaines chargés en incident et en demande, requis résolus, selon-cas cités, paire identité + poste de travail, `update_context` crée `identite.md` depuis le gabarit ; le cas « décrit, hors bêta » rejoué sur un manifeste temporaire |
| 2026-09-11 | T-A1, T-A2, T-B1, T-B5, T-B6, T-B7 | à jouer | sur les quatre nouveaux domaines, par le testeur (porte 1, bêta v2) |
| 2026-09-11 | T-H1 | vert | `install.ps1` (via `-ExecutionPolicy Bypass`) et `install.sh` sur un dossier temporaire : six étapes, `tester` vert à l'étape 3, sept gabarits + `VERSION` créés, code 0 |
| 2026-09-11 | T-D3 | vert | journal : un fichier par ticket, en-tête `questions` et `sections_candidates`, section `q01`, deux tickets → deux fichiers ; message de `save_ticket` avec le chemin |
| 2026-09-11 | T-H2 | vert | rejoindre : « déjà en 0.2.0-beta », sept « gardé », aucun copié ; mise à jour simulée depuis 0.1.0-beta : « MISE À JOUR 0.1.0-beta → 0.2.0-beta », seul `identite.md` copié |

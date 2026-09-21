# Retours de la bêta

> Rempli par les testeurs pendant la porte 1 (`validation.md` §3). Une ligne
> par observation, même petite. Le périmètre dit qui corrige quoi : A à H
> pour la conception, `produit` pour un skill ou un gabarit, `serveur` pour
> le code. La gravité : **bloque** (le flux s'arrête), **faux** (l'outil a
> tort avec assurance), **friction** (ça marche mais ça coûte), **idée**.

| Date | Ticket ou test | Observation | Périmètre | Gravité | Suite donnée |
| --- | --- | --- | --- | --- | --- |
| 2026-09-09 | ITHELP-6354 (build Azure) | L'outil propose d'inscrire la VM créée dans `systeme/serveurs` ; ce qui manquait au contexte était « on a un Azure, tel tenant, tel abonnement, tel piège », pas la VM. | C | faux | Taxonomie du contexte à trois niveaux (`format-contexte.md` §4.1), section `general/plateformes`, règles dans `remplissage.md` et `cloture.md`, signal « volumineuse » dans `etat`. |
| 2026-09-09 | ITHELP-6354 | Premier message en anglais (« I'll load the triage skill first »). | H (point d'entrée) | friction | Ligne « réponds dans la langue du technicien » ajoutée au point d'entrée. |
| 2026-09-09 | ITHELP-6354 | Le cloud IaaS n'est dans aucun domaine ; rangé dans système, volet VNet/NSG écarté de réseau par lecture stricte du prérequis d'`ouverture-flux` (« la destination existe »). | A, B | idée | **Tranché le 2026-09-11** : le cloud n'est pas un domaine, c'est une plateforme (`general/plateformes`, `plan.md` A, `taxonomie.md` §7). Restent à faire : la demande `creation-vm` côté système avec la plateforme en prérequis — bloquée par la limite de lignes de `demandes.md` système, qui attend « une demande par fichier » (`validation.md` §6) — et la nuance dans `ouverture-flux`. |
| 2026-09-09 | ITHELP-6354 | Le tout se juge à la clôture : demande absente journalisée ? section candidate proposée par `update_context` ? tags libres (`azure`, `vm`) ? | E, F | idée | À observer sur ce ticket, puis sur les suivants : trois occurrences d'un tag libre = montée au manifeste. |
| 2026-09-10 | usage général | Aucun moyen de mettre un ticket en pause, d'en changer, ou de le passer à un collègue : l'état ne vivait que dans la conversation, le ticket n'existait qu'à la clôture. | D, E, F | bloque | `save_progress` / `resume_ticket`, brouillon dans `en-cours/`, reprise dans le triage, T-P9. Schéma v3. |
| 2026-09-10 | ITHELP-6324 (brouillon) | Premier brouillon réel : 29 Ko, 434 lignes. Le fichier écrivait tout en double (en-tête + corps), et le modèle écrivait un récit : vérifications de 350 caractères, plan de 3 000 caractères avant d'exister, la référence comptée comme question. | D, F | friction | Taxonomie du brouillon avec limites par entrée refusées par le serveur, corps réduit à l'état, descriptions de champs réécrites. |
| 2026-09-11 | discussion (hors ticket) | Rien ne maintient le contexte à jour une fois rempli : les questions journalisées avec `section_candidate` et les `mises_a_jour_contexte` refusées à la clôture ne sont jamais relues ; l'âge d'une section (`Dernière mise à jour`) est lu mais jamais signalé ; une vérification qui contredit le contexte en cours de ticket n'est tenue que par le prompt de clôture. | C, D, F | idée | Différé : boucle de fraîcheur en trois temps, `validation.md` §6 ; part non tranchée en `plan.md` §4. À chiffrer après la porte 1 (candidats restés en rade). |
| 2026-09-11 | discussion (hors ticket) | Le projet vise à grandir sur trois axes à la fois (domaines, techniciens simultanés, documentation d'entreprise) ; rien dans l'étude ne disait ce qui tient et ce qui bascule à chaque palier, ni où la documentation existante entre dans le flux. | D, E, H, I | idée | `plan.md` §5 (paliers de montée en charge, règle « ne rien construire qui empêche le palier suivant ») et périmètre I (documentation : après le diagnostic, avant le plan, contrat neutre vis-à-vis du moteur). Trois différés en `validation.md` §6. |
| 2026-09-11 | bêta v2 | Le deuxième ticket avait besoin du domaine identité (triage systeme + identite, cause côté Entra Connect) ; son contexte a été rangé dans `general/plateformes` faute de gabarit. Les quatre domaines décrits sont passés en bêta le jour même : skill, demandes, gabarit chacun, 44 sections au total. | A, B, C | bloque | Bêta v2 livrée (`fin-de-projet.md` §9). Les quatre domaines sont des hypothèses : T-A1, T-B5, T-B6 à jouer sur chacun. Les installations existantes lancent `init` (mode rejoindre) pour recevoir les quatre gabarits. |
| 2026-09-14 | ITHELP-6354 (relecture) | Le symptôme initial est retapé par le modèle à la clôture alors que le brouillon le tient déjà « tel qu'exprimé » (`tickets.ts` prend `e.symptome_initial` même quand un brouillon existe). Le ticket enregistré contient une paraphrase (« […] », « Le ticket fourni comportait en outre… »), pas l'original. Invariant tenu par le prompt seul. | D, F | faux | **Corrigé le 2026-09-18** (2.1 a9) : le brouillon est la source — symptôme, domaines proposés, plan, questions. Avant : À corriger (lot déterminisme, A1) : quand un brouillon existe, le serveur prend son `symptome_initial` ; celui de la clôture ne sert que s'il est vide. |
| 2026-09-14 | ITHELP-6394, MDP hybride (relecture) | La fusion brouillon → ticket dédoublonne sur la chaîne exacte (`trim()`), les reformulations passent : journal ITHELP-6394 q01≈q06, q03≈q07, q04≈q08 ; ticket MDP hybride, 12 signaux dont 6 reformulent les 6 autres. À 50 tickets, chaque journal et chaque entrée de base sera doublé. | D, F | friction | **Corrigé le 2026-09-18** (2.1 a2) : clé normalisée dans `ajouter` et `fusion`. Avant : À corriger (A2) : clé normalisée (minuscules, sans accents ni ponctuation, espaces réduits) ; à la clôture les listes du brouillon sont la source, celles de la clôture ne s'ajoutent que si absentes. |
| 2026-09-14 | relecture du code | Les identifiants de domaine ne sont validés que par `load_skill` : `save_progress(domaines_valides)`, `save_ticket(domaines_valides, escalades)`, `skill_charge.domaines` acceptent n'importe quelle chaîne, et `domaines_valides` entre dans les tags sans `trim`/`toLowerCase`. Un « Réseau » ou un « cloud » devient un tag introuvable et une reprise qui recharge un skill inexistant. | serveur | faux | **Corrigé le 2026-09-18** (2.1 a5, puis 2.6) : domaines en enum du schéma ; `skill_charge` supprimé (2.4). Avant : À corriger (A3) : contrôle contre le manifeste dans `save_progress` et `save_ticket`, erreur `isError` explicite. |
| 2026-09-14 | relecture du code | Un `save_progress` avec un `id` et une `reference` différente de celle du brouillon écrase la référence en silence ; même chose à la clôture (la clôture gagne). Avec deux sessions Claude Code sur deux tickets, un mauvais `id` mélange deux tickets sans aucune erreur. | serveur | faux | **Corrigé le 2026-09-18** (2.1 a7) : refus « mauvais id ? » au brouillon et à la clôture. Avant : À corriger (A4) : refus si le brouillon a déjà une référence et qu'on en donne une autre (variante de casse exceptée) — « mauvais id ? ». |
| 2026-09-14 | ITHELP-6324 (brouillon) | Sans `id` ni `reference`, `save_progress` crée toujours un nouveau brouillon : un oubli d'id = un doublon. Preuve : note du brouillon « précédent 20260910-131701 supprimé par erreur, celui-ci le remplace ». | D | friction | **Corrigé le 2026-09-18** (2.1 a6) : rattachement par symptôme normalisé. Avant : À corriger (A5) : à la création, si un brouillon existant porte le même `symptome_initial` normalisé, rattacher (ou refuser) au lieu de créer. |
| 2026-09-14 | MDP hybride | Le modèle a fabriqué une référence (`SANS-REF-20260910-MDP-HYBRIDE`) sur « je te laisse en mettre un » ; elle est devenue un tag. Viole « le modèle ne fabrique jamais un identifiant » ; `triage.md` dit que « pas de référence » est acceptable mais pas « ne jamais en inventer ». | E, produit | faux | **Corrigé le 2026-09-18** (2.1 a8) : refus côté serveur, « ne jamais en inventer » dans `triage.md`. Avant : À corriger (A6) : une ligne dans `triage.md` ; côté serveur, refus d'une référence commençant par `SANS-REF`, `AUCUNE`, `N/A`. |
| 2026-09-14 | relecture du code | Identifiants en heure locale (`getHours()` dans `ids.ts`), dates `date`/`cree`/`derniere_mise_a_jour` en ISO UTC : ticket `20260910-161438` créé à `14:14Z`. Sur un partage Paris/Tunis, le tri par nom et le tri par date divergeront. | serveur | friction | **Corrigé le 2026-09-18** (2.1 a1) : UTC partout, centralisé dans `ids.ts`. Avant : À corriger (A7) : `getUTC*` dans `horodatage`, `dateDuJour`, `horodatageCompact` ; format inchangé, fichiers existants valides. |
| 2026-09-14 | relecture du code | Si `save_ticket` écrit le ticket puis échoue à retirer le brouillon, le brouillon devient un zombie : tout `save_ticket(id)` suivant répond « déjà clôturé », et il reste listé à chaque triage pour toujours. | serveur | friction | **Corrigé le 2026-09-18** (2.1 a4) : zombies ignorés, signalés par `etat` et l'audit, retirés à la clôture. Avant : À corriger (A8) : `listerBrouillons` ignore (et `etat` signale) un brouillon dont le ticket existe ; « déjà clôturé » retire le brouillon. |
| 2026-09-14 | relecture du code | La liste des brouillons est rendue intégralement à chaque `load_skill(["triage"])`, sans plafond, avec `prochaine_etape` (≤ 200 car.) par ligne ; trente brouillons non clôturés = trente lignes dans le prompt de triage à chaque ticket. Et la reconnaissance « la référence donnée figure dans la liste » est faite par le modèle, visuellement. | D, E | friction | **Corrigé le 2026-09-18** (2.1 a14) : liste plafonnée à 10, `resume_ticket(référence)` d'abord. Avant : À corriger (B1) : liste plafonnée (10 plus récents + « N autres, `resume_ticket()` pour tout voir ») ; règle de triage déterministe « une référence donnée → `resume_ticket(référence)` d'abord », le serveur répond « aucun ticket en cours » en un appel. |
| 2026-09-14 | relecture du code | Rien ne purge les brouillons anciens : `JOURS_BROUILLON_ANCIEN = 30` ne produit qu'un avertissement. Avec B1, la liste grossit sans fin. | D, F | idée | **Traité le 2026-09-18** (2.9) : l'audit propose la clôture en `non-resolu`, un par un, sur oui — pas d'automatisme. Avant : Point ouvert : `etat` les liste à part ; à terme clôture en `non-resolu` proposée par le triage au-delà du seuil. |
| 2026-09-14 | relecture du code | Deux serveurs stdio sur la même installation (deux sessions, ou deux postes) écrivent le même brouillon en dernier-écrit-gagne. Déjà prévu (empreinte optimiste, `D-serveur-mcp.md` §8, porte 2) ; A4 et A5 sont les garde-fous mono-poste à mettre avant. | D | idée | Inchangé : porte 2. |
| 2026-09-14 | contexte réel | « Volumineuse » compte des lignes (`LIGNES_MAX_SECTION = 40`), le coût est en caractères : `general/plateformes` fait 21 lignes et 2 900 caractères (cellules de 400 car.), et il est `requis` par quatre domaines sur six — chaque ticket le paie intégralement. Il passera sous le radar jusqu'à 8 000 car. | C, D | friction | **Corrigé le 2026-09-18** (2.1 a12) : `CARACTERES_MAX_SECTION = 2500` ; signal, pas refus. Avant : À corriger (C1) : seuil en caractères en plus des lignes. |
| 2026-09-14 | relecture du code | « Vide » est calculé contre le gabarit *courant*, pas celui copié : si une version reformule un placeholder, une section jamais touchée chez un client passe de `vide` à `ok` avec la note « contient des placeholders ». | C, D, H | faux | **Corrigé le 2026-09-18** (2.1 a13) : « vide » si le squelette seul reste, indépendant du gabarit. Avant : À corriger (C2) : vide aussi si, après retrait des lignes ne contenant que des `<…>` et des séparateurs de table, il ne reste rien — indépendant de la version. |
| 2026-09-14 | relecture du code | Rien ne valide `installation/` : un titre `## Sites` sans `id —` dans un fichier de contexte rend la section invisible sans erreur (`etat` la dit « manquante ») ; une entrée `kb/` au YAML cassé devient silencieusement introuvable (`lireTicket` renvoie `entete: {}`). | D, H | faux | **Traité le 2026-09-18** (2.9) : santé des fichiers dans l'audit (commande CLI `audit`, code 1) ; `verifier` absorbée. Avant : À corriger (C3) : commande `verifier` du CLI (titres mal formés, sections en double, brouillons orphelins, entrées kb illisibles, domaines inconnus dans les tickets), lancée à l'étape 6 des scripts. |
| 2026-09-14 | relecture du code | Une installation par poste, en dur dans `~/.claude.json` (`enregistrer` écrit un seul `support-it` avec un seul `SUPPORT_IT_INSTALLATION`) : un technicien qui sert deux entités ne peut pas basculer. | H | idée | Inchangé (décision 7) : porte 2 ou 3. Avant : Point ouvert (palier 4, `plan.md` §5) : enregistrement par projet (`.mcp.json`) plutôt que par utilisateur. |
| 2026-09-14 | contexte réel | `historique/` grossit sans borne : 8 copies complètes en trois jours, une par `update_context`. Aucune règle de rétention. | C, H | idée | **Traité le 2026-09-18** (2.9) : l'audit compte les copies par fichier, signale seulement (décision 7 : pas de rétention automatique). Avant : Point ouvert. |
| 2026-09-14 | kb réelle | Vocabulaire de tags libre, non canonisé : 74 tags distincts sur 3 entrées, dont `identite-manageee` (coquille), `casse-propriete`, `jmespath`. La règle « trois occurrences → manifeste » n'est mesurée nulle part ; `vocabulaire()` de `manifeste.ts` n'est appelé par personne. | F, D | friction | **Corrigé le 2026-09-18** (2.7) : bibliothèque fermée à deux étages, enum ≤ 5, filtrée par domaines ; `tags.yaml` tenu par le référent ; pas de commande `tags` (la liste ne grandit pas par un compteur). Avant : À corriger (D1) : `publish_kb` renvoie les tags hors vocabulaire ; commande CLI `tags` qui compte les occurrences. |
| 2026-09-14 | tests de l'auteur + mesure sur la kb réelle | `search_kb` renvoie tous les cas qui partagent un tag, à score égal : avec `azure`, les 2 entrées reviennent (score 1 chacune), 1 917 caractères (~550 tokens) pour 2 cas, soit ~950 caractères par cas — dont la moitié est la liste complète des 28–32 tags de chaque entrée. Le plafond (5 par défaut, 20 max) tient, mais le score est plat : à 50 tickets portant `azure` (tag de plateforme, présent sur tout ticket cloud, comme `demande`, `systeme`, `powershell`), les 5 renvoyés sont les 5 plus récents, pas les 5 plus proches ; le modèle ne trouve pas son cas et rappelle avec `limite: 20` (~5 500 tokens), toujours pour du bruit. Une fonction consomme le budget du ticket. Et une fois le bon cas repéré, le modèle n'a aucun appel pour lire sa conclusion et son plan d'action en entier (première ligne seulement) : il ne peut que deviner le chemin du fichier, ce qui lui est interdit. | F, D | faux | **Corrigé le 2026-09-18** (2.5) : score par rareté, rendu compact, plafond 5, `limite` retirée ; neuvième appel `read_kb`. Avant : À corriger plus tard (D2), sans changer la signature : (1) score pondéré par la rareté — chaque tag commun vaut 1 / nombre d'entrées qui le portent, la nature non comptée ; (2) rendu compact — seuls les tags communs à la recherche (+ « et N autres »), symptôme et conclusion tronqués à ~160 car., soit ~300 car. par cas ; (3) message « N cas partagent ces tags, 5 affichés — affiner avec des tags plus spécifiques » au lieu d'inviter à monter `limite`. Question de produit à trancher : un second temps pour lire un seul cas (conclusion + plan, ~1–2 Ko, jamais le ticket entier de 12–16 Ko), soit un paramètre `ticket_id` de `search_kb`, soit un neuvième appel `read_kb` (touche « huit appels » dans une dizaine de fichiers). |
| 2026-09-14 | relecture du code | `max_domaines` est testé avant dédoublonnage : `["reseau","reseau"]` passe, `["reseau","systeme","reseau"]` est refusé alors qu'il n'y a que deux domaines — une erreur du serveur imputée au triage. | serveur, E | friction | **Corrigé le 2026-09-18** (2.1 a3). Avant : À corriger (E1) : dédoublonner avant `max_domaines` (le smoke est à ajuster). |
| 2026-09-14 | relecture du code | Cas net : `triage.md` dit « annoncer et charger dans le même tour » et « `save_progress` dès le triage validé » — sans tour de validation, l'ordre `save_progress` / `load_skill` est ambigu. Les deux tickets réels passent, mais c'est une discipline de prompt. | E, produit | idée | **Corrigé le 2026-09-18** (2.4 d9) : le brouillon se crée avant le premier `load_skill` d'un domaine, `triage.md` le dit ; le classement des domaines arrive dans la réponse de `save_progress` (2.6). Avant : Point ouvert : fixer l'ordre dans `triage.md` (brouillon d'abord, puis skill). |
| 2026-09-14 | discussion (hors ticket) | Principe demandé par l'auteur : **le modèle observe et raisonne sur le ticket ; il ne décide jamais de la mécanique du projet.** Un mauvais diagnostic coûte un ticket, le technicien le voit et corrige ; une mauvaise mécanique (un tag, une référence, un domaine, un symptôme retapé) casse la base, la reprise ou le jeu de test pour tous les tickets suivants, en silence. La frontière « déterminisme dans le code » n'avait été tracée que sur les chemins et les identifiants ; les tags, la référence, le symptôme, les domaines, les signaux et la reconnaissance d'un ticket en cours restaient des choix du modèle tenus par le prompt. Les tickets réels montrent qu'ils lâchent (28–32 tags par ticket, référence inventée, symptôme paraphrasé, signaux rédigés comme un journal). | D, E, F, G | faux | Section « Principe — le modèle n'a pas de choix sur la mécanique » ci-dessous : le test à appliquer à chaque champ et l'inventaire de ce qui est à rapatrier côté serveur. Le lot de corrections part de là, pas d'une liste de bugs isolés. |
| 2026-09-14 | relecture du code | Deux textes lus par le modèle disaient encore « chaque question devient un fichier du journal » (`index.ts`, description de `save_ticket` ; `cloture.md`) alors que le journal est un fichier par ticket depuis le 2026-09-11. | serveur, produit | friction | Corrigé le 2026-09-14 dans les deux textes ; `build`, `valider`, `npm test` passés. |
| 2026-09-14 | discussion (hors ticket) | Question de l'auteur : peut-on forcer le modèle à utiliser les appels MCP ? Non, pas directement : MCP n'offre que des outils, la décision d'appeler reste au modèle, et `tool_choice` de l'API n'est pas exposé par Claude Code. Mais trois leviers déterministes côté hôte (permissions, hooks `PreToolUse` / `Stop` / `UserPromptSubmit`) et un côté serveur (état de session en mémoire, stdio = un processus par session) donnent presque le même résultat. | D, G, H | idée | Section « Forcer l'usage des appels — ce qui est possible » ci-dessous. Suite possible du point 3 du complément (outil hôte) et de T-P9 (oublis de `save_progress`). Livrable par `install` sans toucher aux huit appels. |
| 2026-09-14 | ticket RBAC Azure (RD_DEV, attribution de rôle) | Plan validé (« ok go », `save_progress` bien appelé), puis le modèle livre un lot : « commence par les étapes 0, 1 et 2 et colle-moi les sorties ». Le technicien doit rappeler « une commande par une commande ». Après le rappel, l'étape 0 enchaîne encore deux commandes sur une ligne (`az account set … ; az account show …`). Cause : « une question à la fois » est partout dans le produit, **« une commande à la fois » n'est écrit nulle part** — l'étape 8 de `triage.md` dit seulement « Actions : par le technicien, hors de l'outil. Tu attends son retour. » Ça marchait sur ITHELP-6354 parce que le texte du ticket contenait lui-même « Protocole : une commande à la fois, l'opérateur exécute et colle la sortie » ; la règle venait du ticket, pas de l'outil. | E, G, produit | friction | **Corrigé le 2026-09-18** (2.2) : « une commande, puis j'attends la sortie » mot pour mot dans les douze skills, `triage.md` étape 8, `gouvernance.md` §4 ; T-B8 ; l'audit signale un `save_progress` à plusieurs actions. Avant : À corriger plus tard : règle écrite une seule fois à l'étape 8 de `triage.md` (chargé à chaque ticket) et dans le format du plan d'action (`gouvernance.md` §4 : une commande par opération numérotée, exécutée et rapportée avant la suivante), avec la définition de « une commande » — une invocation, pas de `;`, `&&` ni `|` pour enchaîner, une sortie collée par le technicien. Aucun garde-fou serveur ni hook possible : les actions se passent hors de tout appel ; c'est un invariant tenu par le prompt seul, à consigner comme tel dans `etat-d-avancement.md` §3. `save_progress.actions` a déjà la bonne granularité (une commande et son résultat par entrée). |
| | | | | | |

## Principe — le modèle n'a pas de choix sur la mécanique (2026-09-14)

**Le test, à appliquer à chaque champ de chaque appel :** *si le modèle se
trompe ici, est-ce le diagnostic qui est faux, ou le projet ?* Si c'est le
projet, le champ ne doit pas exister côté modèle, ou doit être dérivé ou
vérifié par le serveur. Le projet le disait déjà (« les tâches déterministes
sont du code, jamais du raisonnement », `plan.md` 0.4) ; la frontière
n'avait été tracée que sur les chemins et les identifiants.

**Ce qui reste au modèle, et c'est normal :** décider qu'un signal
`selon-cas` apparaît et justifie un `get_context`, la question à poser, la
conclusion, le plan d'action, `prochaine_etape`, `statut`. C'est le
diagnostic ; s'il est faux, le technicien le voit et corrige, les trois
points de validation humaine sont faits pour ça.

**Ce qui est encore un choix du modèle sur la mécanique, et ce qui peut le
remplacer :**

| Le modèle choisit aujourd'hui | S'il se trompe | Ce que le serveur décide à sa place |
| --- | --- | --- |
| Les tags (`save_ticket.tags`, `publish_kb.tags`) | Le cas ne se retrouve plus, ou matche tout (D2) | Tout est dérivable : nature, domaines validés, escalades (déjà automatiques) ; les clés `selon-cas` dont les sections ont **réellement été chargées** — le serveur voit passer chaque `get_context`, il les note dans le brouillon ; le nom de la demande instruite ; la référence. Aucun tag libre, ou trois au plus en kebab-case ASCII, refusés sinon. |
| La référence (retapée, parfois inventée) | Ticket rattaché au mauvais brouillon, pseudo-référence en tag | Le brouillon est la source ; refus si elle change en cours de route ; refus d'une référence fabriquée (A4, A6) |
| Le symptôme initial (retapé à la clôture) | Le jeu de test du triage reçoit une paraphrase | Le brouillon est la source (A1) |
| Les domaines (`domaines_valides`, `escalades`, `skill_charge`) en texte libre | Reprise impossible, tag introuvable | Contrôle contre le manifeste (A3) ; `skill_charge` supprimé — c'est `domaines_valides` + `nature`, le serveur le sait déjà |
| « La référence figure-t-elle dans les tickets en cours ? » par lecture de la liste | Ticket retriagé au lieu d'être repris, ou l'inverse | `resume_ticket(référence)` systématique dès qu'une référence est donnée ; le serveur répond oui ou non (B1) |
| La section candidate d'une question (`questions[].section`) | Le référent reçoit un identifiant qui n'existe pas | Vérifiée contre les gabarits |
| Les signaux retenus (`signaux`) en prose libre | Un journal de bord à la place de signaux cochés (ITHELP-6354 : douze « signaux » qui sont des étapes) | Les signaux du manifeste reçoivent un identifiant ; le modèle **coche**, il ne rédige pas — c'est la définition du triage en `plan.md` A (« le triage ne fait que constater lesquels sont présents ») |
| L'étape (`etape`) et le moment du point d'étape | Brouillon resté à « triage » pendant les actions ; oublis (T-P9) | Partiellement : le serveur peut poser l'étape lui-même quand il voit `load_skill` (instruction), `search_kb` (recherche), `save_ticket` (clôture), si le brouillon lui est connu — plus lourd, à discuter |

Les tags ne servent pas au triage (lui travaille sur les signaux du
manifeste) mais à `search_kb` ; la ligne « signaux » du tableau est, elle,
le triage. Correction différée avec le lot déterminisme ; rien n'est
modifié dans `produit/` à cette date.

## Complément — inventaire des autres choix du modèle sur la mécanique (2026-09-14)

Relecture des huit appels champ par champ, des trois textes livrés et du
point d'entrée, hors les huit points du tableau ci-dessus. Trois catégories :
**dérivable** (le serveur a déjà l'information), **vérifiable** (le serveur
peut contrôler ce que le modèle envoie), **irréductible** (il faut un humain).

### 1. Champs des appels

| Appel · champ | Ce que le modèle fait | S'il se trompe | Remplacement |
| --- | --- | --- | --- |
| `save_ticket` sans `id` ni `reference` alors qu'un brouillon existe | Oublie l'id | Nouveau ticket avec un nouvel id **et** brouillon orphelin listé pour toujours | Vérifiable : refus si un brouillon porte le même symptôme normalisé, ou s'il n'y a qu'un brouillon en cours du même technicien |
| `save_ticket.nature` / `load_skill.nature` après création du brouillon | Change de nature en cours de route sans le dire | Ticket incohérent, mauvais fichier chargé (`skill.md` / `demandes.md`) | Vérifiable : cohérence avec `brouillon.nature`, ou changement explicite |
| `save_ticket.questions` | Recompose la liste de mémoire à la clôture | Journal incomplet ou doublé — la matière du référent | Dérivable : le brouillon est la source (extension d'A2), la clôture ne fait qu'ajouter |
| `save_ticket.plan_action` (optionnel) | Peut l'omettre ou le réécrire | Le plan enregistré n'est pas celui que le technicien a validé | Dérivable : `brouillon.plan_action` prioritaire ; obligatoire si `statut: resolu` |
| `save_ticket.mises_a_jour_contexte[].section` | Identifiants libres | Le référent reçoit un identifiant qui n'existe pas | Vérifiable contre les gabarits |
| `save_ticket.duree_minutes` | Estime, ou invente | Une mesure fausse dans la seule métrique du projet (T-P7) | Dérivable : `brouillon.cree` → clôture, calculé par le serveur ; le champ ne reste que pour la baseline humaine |
| `save_ticket.resolu_par` omis | — | **Le serveur pose `outil` par défaut** (`tickets.ts`) : une valeur que personne n'a dite, qui biaise la mesure en faveur de l'outil | Vérifiable : `null` si omis, jamais une valeur inventée |
| `save_ticket.domaines_proposes` « dans l'ordre » | Recompose l'ordre de mémoire | Le jeu de test du triage (parti X, conclu Y) est faux | Dérivable : brouillon |
| `search_kb.limite` | Choisit 1 à 20 | Coût en tokens (D2) | Vérifiable : plafond bas fixé par le serveur, le paramètre disparaît |
| `publish_kb.ticket_id` | Retape un id de mémoire | **Un autre ticket clôturé, qui existe, est publié à la place**, sans erreur | Vérifiable partiellement : exiger aussi la `reference` (ou le symptôme) et comparer ; la réponse cite le symptôme publié |
| `publish_kb` sur un ticket `non-resolu` ou `hors-domaines-couverts` | Le prompt dit « seulement si `resolu` » | Un cas non résolu en base, pris pour une solution éprouvée pendant des mois | Vérifiable : **`publish_kb` ne lit pas le statut** (`kb.ts`) — refus côté serveur |
| `resume_ticket.ticket` | Retape id ou référence | « aucun ticket en cours » → retriage et doublon | Vérifiable : rattachement tolérant (préfixe d'id) ; surtout B1 |
| `update_context.contenu` — remplacement intégral | Doit renvoyer toute la section pour changer une ligne | Ajouter une 6ᵉ plateforme oblige à retaper les 5 autres : une valeur altérée passe en silence ; `historique/` garde l'ancienne version mais personne ne compare | Vérifiable : le serveur **renvoie le diff** (lignes retirées, modifiées) et refuse si des lignes disparaissent sans paramètre explicite ; ou un mode « ajouter une ligne » |
| `update_context.contenu` — forme | « au format du gabarit » | Une prose là où le squelette est un tableau : section illisible pour les tickets suivants | Vérifiable : si le squelette est un tableau, le contenu doit en être un avec la même ligne d'en-tête |
| `update_context.contenu` — volume | Peut écrire un inventaire (niveau 3) | Signalé « volumineuse » après coup par `etat`, que personne ne lance | Vérifiable : refus à l'écriture au-delà du seuil (C1) |
| `get_context` sur une section déjà `requis` | Recharge ce que `load_skill` a déjà servi | Tokens perdus | Dérivable : répondre « déjà chargée » sans le contenu |

### 2. L'ordre et les moments du flux — tenus par le prompt seul

Le serveur ne connaît pas l'étape en cours ; il ne peut rien refuser. Rien
n'empêche : `load_skill(domaine)` sans `triage` ; `save_ticket` sans
`load_skill(["cloture"])` (les consignes de clôture jamais lues) ;
`search_kb` avant le diagnostic, ou jamais ; un plan sans `search_kb` ; une
clôture sans qu'aucun brouillon n'ait existé ; après `resume_ticket`, refaire
le triage ; une **escalade** non enregistrée — chaque `load_skill(domaine)`
après le premier sur le même ticket *est* une escalade, mais elle n'apparaît
que si le modèle la met dans `escalades`.

Tout cela est dérivable ou vérifiable **à une condition** : que le serveur
sache à quel brouillon un appel appartient. Seuls `save_progress` et
`save_ticket` portent l'`id`. Choix de fond à faire : un `id` optionnel sur
`load_skill`, `get_context`, `search_kb` (le serveur note l'étape, les
sections servies, les escalades — tags et étape deviennent dérivés), ou
accepter que l'ordre du flux reste du prompt.

### 3. Hors MCP — ce que l'outil hôte laisse faire

Le trou le plus large, qu'aucun appel ne peut fermer : Claude Code a ses
propres outils. Le modèle peut **lire** `installation/contexte/*.md` en
entier (contourne le chargement à la demande et la logique « vide »), lire
`installation/kb/<id>.md` en devinant le chemin, **écrire**
`installation/contexte/reseau.md` avec `Edit` (sans `update_context`, sans
`historique/`, sans oui), **exécuter** des commandes, ou **répondre sans
appeler le serveur**. Le mode de permission est la seule barrière.
Mitigation déterministe sans toucher au serveur : un `.claude/settings.json`
livré par `install` qui refuse `Edit`/`Write` sur `installation/**` et
`Read` sur `installation/kb/**` — l'invariant « rien n'est écrit hors des
appels » serait tenu par la configuration de l'hôte, pas par le prompt.

### 4. Irréductibles — il faut un humain

À nommer comme tels plutôt qu'à faire semblant : le **oui** du technicien
avant `update_context` et `publish_kb` ; le **verbatim** du symptôme à la
création du brouillon (le modèle recopie la conversation ; A1 le fige
ensuite, la première copie reste la sienne — d'où l'intérêt de créer le
brouillon au premier tour, avant tout raisonnement) ; **net ou ambigu** au
triage, qui décide si le technicien est consulté — se mesure a posteriori
(escalades, `domaines_proposes ≠ domaines_valides`), ne se force pas.

## Forcer l'usage des appels — ce qui est possible (2026-09-14)

**Ce qui n'existe pas.** Ni MCP ni Claude Code ne permettent de dire
« appelle cet outil maintenant ». Un serveur MCP *offre* des outils avec une
description ; la décision reste au modèle. Le seul mécanisme qui force un
appel est `tool_choice` de l'API Anthropic, que Claude Code n'expose ni à un
skill ni à un serveur.

**Trois leviers déterministes côté hôte**, du plus simple au plus lourd :

1. **Interdire les alternatives** — `permissions.deny` dans un
   `.claude/settings.json` livrable par `install` : `Edit(installation/**)`,
   `Write(installation/**)`, `Read(installation/kb/**)`,
   `Read(installation/en-cours/**)`, et `Bash` si l'on va au bout de « l'IA
   n'exécute rien ». Si le modèle ne peut pas écrire un fichier lui-même, la
   seule façon d'écrire le contexte est `update_context`. Un hook
   `PreToolUse` fait la même chose plus finement : il reçoit chaque appel
   avant exécution et peut le bloquer avec un message que le modèle lit
   (« utilise `update_context` » ; « `save_ticket` sans
   `load_skill(["cloture"])` dans cette session »). Ferme le point 3 du
   complément (outil hôte). Même principe que la décision 26 : une contrainte
   mécanique plutôt qu'une consigne.
2. **Refuser de terminer** — hook `Stop` : s'exécute quand le modèle veut
   rendre la main et peut répondre « non, continue, raison : … ». Le plus
   proche de « forcer » : vérifier qu'un brouillon existe dans `en-cours/`
   pour la session et qu'il a été mis à jour depuis le dernier tour, sinon
   bloquer avec « appelle `save_progress` avant de rendre la main ». Répond
   directement à T-P9.
3. **Injecter au lieu de demander** — hook `UserPromptSubmit` : quand le
   message commence par `/support`, exécuter le rendu du triage (une commande
   CLI `triage` qui produit la même sortie que `load_skill(["triage"])`) et
   l'injecter dans le contexte. Le triage arrive à coup sûr, sans dépendre
   d'un appel. Idem pour la liste des brouillons.

**Un levier côté serveur, non exploité jusqu'ici.** Le transport stdio
signifie **un processus serveur par session Claude Code** : le serveur peut
garder un état en mémoire — skills chargés, brouillon créé, sections
servies. Cela résout le « choix de fond » de la section 2 du complément
sans ajouter d'`id` aux appels de lecture : `save_ticket` refuse si
`cloture` n'a pas été chargé dans la session, `search_kb` refuse avant tout
`load_skill(domaine)`, tags et escalades sont dérivés de ce que le serveur
a vu passer. Il ne peut toujours pas *provoquer* un appel, mais il rend tout
appel hors séquence impossible — ce que les hooks ne savent pas faire
finement. Limite à noter : cet état ne survit pas à une reprise de session
(`--resume`) ni au redémarrage du serveur ; le brouillon sur disque reste
la source de vérité, l'état mémoire n'est qu'un garde-fou.

**Hors de portée.** Rien ne force le modèle à appeler `get_context` quand un
signal apparaît, ni `search_kb` s'il l'oublie : on peut interdire le plan
sans recherche (hook `Stop` ou serveur), pas obliger la recherche au bon
moment. Le contrôle total — `tool_choice`, jeu d'outils restreint, séquence
imposée dans le code — est le palier « hôte à soi » avec l'Agent SDK, que
`plan.md` 0.4 garde ouvert (« d'autres outils hôtes au prix d'un point
d'entrée par outil »). Pour la bêta, les leviers 1 et 2 couvrent
l'essentiel. Les noms et le format de réponse des hooks sont à vérifier
dans la documentation Claude Code au moment d'implémenter.

## Mesures (T-P7)

Depuis le 2026-09-18, ce tableau est **rempli par l'audit** (`node
dist/cli.js audit` ou `/support audit`, décision 8) depuis les tickets
d'`installation/` : nature, domaines, questions, durée calculée par le
serveur, résolu par (null si personne ne l'a dit). Les rapports datés sont
dans `installation/audits/`. Il n'est plus tenu à la main.

## Phase de test 0.3.0-beta (plan-after-beta §3)

Une ligne par écart, comme ci-dessus : refus injustifié (avec l'appel et
le message), signal du manifeste qui ne colle pas au ticket (à **ne pas**
corriger avant la fin des dix tickets), oubli de `save_progress` (T-P9),
commande enchaînée, question en liste, contournement par un outil de
l'hôte.

| Date | Ticket ou test | Observation | Périmètre | Gravité | Suite donnée |
| --- | --- | --- | --- | --- | --- |
| 2026-09-18 | génération du jeu de test (§3.1) | Une convention écrite avec des chevrons dans le contexte (`srv-<rôle>-<nn>`, `PC-<nnnn>`, `g-<usage>-<niveau>`) passe pour un placeholder : `get_context` annote « contient encore des placeholders », l'audit la liste. C'est la détection C2, volontairement simple. | C, D | friction | Le jeu écrit ses conventions en capitales sans chevrons (`PC-NNNN`). À trancher plus tard : réserver les placeholders à `<…>` en début de cellule, ou accepter le faux positif. Noté dans le YAML. |
| 2026-09-19 | mise en place §3.2, étape 3 (poste neuf) | `install.ps1 -JeuDeTest` s'arrête à l'étape 1 : « Node.js introuvable. Claude Code l'installe normalement ». Faux : l'app desktop Claude Code embarque son runtime et ne met ni `node`, ni `npm`, ni `claude` sur le PATH. Tout poste technicien neuf tombait sur cet ÉCHEC. | installation | bloquant | Étape 1 des deux scripts : diagnostic complet, proposition d'installer Node.js LTS par le gestionnaire du poste (`winget`, `brew`, `apt-get`, `dnf`) après un `o` explicite, rechargement du PATH, revérification ; sinon arrêt avec la commande et l'URL. `deploiement.md` §5 corrigé, exception documentée dans `etat-d-avancement.md` §4.7. |
| 2026-09-18 | génération du jeu de test (§3.1) | Deux tags du jeu ont été refusés à la clôture, à raison : `app-compta` (poste de travail, applicatif) sur un ticket réseau, `droits-acces` (identité) sur un ticket système. Le message renvoie la liste filtrée. | D, F | — | Le jeu corrigé ; premier refus « injustifié » testé et… justifié. Un tag client rattaché à deux domaines n'est pas transverse pour autant. |
| | | | | | |
| 2026-09-19/20 | campagne 0.3.0-beta (11 tickets, B, C, D) | Journal complet : `campagne-test-0.3.0-beta.md` (18 écarts E1–E18, 11 observations O1–O11). Lignes ci-dessous = une par écart. | — | — | — |
| 2026-09-19 | T1 | `search_kb` : « Tag inconnu : reseau » (idem nature, référence) alors que le serveur les ajoute lui-même aux tags (E2) | serveur | friction | inclure les tags structurels dans la bibliothèque connue |
| 2026-09-19/20 | T1, T2, T3, T4, T7 | Deux étapes dans le même tour, 7 occurrences ; T7 : « poste 2 : même séquence, dis-moi quand c'est fait » = « fais les étapes 1 à 4 » (E3) | modèle / skills | moyen | règle « une étape du plan à la fois, commande, manipulation ou question » ; plans rédigés une étape = un geste |
| 2026-09-19 | T2 | Règle « sans `\|` » : un pipeline PowerShell est une invocation (E4) | contenu | mineur | reformuler la règle |
| 2026-09-19 | T3, T6, T9, T10 | À l'escalade, `save_progress` remplace `domaines_valides` ; `save_ticket` prend `domaines_valides` de l'argument ; ticket EX-2103 : `domaines_valides = escalades = [identite]` (E5) | serveur 2.4 | **haut** | union ou refus après le premier skill de domaine ; brouillon source pour les deux |
| 2026-09-19 | §3.2 ét. 9, T3 | Anomalie 7 (`casse.md`) jamais générée : regex du générateur ne matche pas `---


# Ticket` (E6) ; doublon d'id en base non dédoublonné par `search_kb`, non signalé par C3 (E7) | outils, serveur | moyen, mineur | corriger la regex ; dédoublonner par id ; constat C3 « nom ≠ id » |
| 2026-09-19/20 | T4, T7, T8 | `resolu_par` renseigné par le modèle (`outil`, `les-deux`) sans que le technicien l'ait dit ; visible dans T-P7 (E8) | skill clôture, serveur | moyen | seulement si dit ; refuser sans `conclusion_humaine` ou réponse tracée |
| 2026-09-19 | T2, T5 | Questions composées (trois informations en une question) (E9) | modèle | mineur | à observer |
| 2026-09-19 | T6 | Devis de câblage routé en réseau : demande sans signal acceptée, aucun domaine « décrit non couvert » au manifeste, skills demande disent « instruire au mieux » (E10) | conception | **haut** | domaine hors-périmètre ou règle « aucun signal → hors domaines » ; exiger un signal pour une demande ; corriger les skills demande |
| 2026-09-19 | T6, T7 | `symptome_initial` préfixé par la référence (E11) | triage | mineur | retirer la référence du symptôme |
| 2026-09-19 | T7 | `nslookup … 10.10.20.1` : adresse fabriquée « hypothèse de ma part », `dns-dhcp` non chargée (E12) ; section « À confirmer » utilisée sans confirmation, jamais signalée (E13) | modèle / skill réseau | moyen, mineur | charger la section avant toute commande vers un DNS ; annotation plus visible |
| 2026-09-19 | T7 | Proposition d'éditer `installation/kb/…md` directement (refusée ensuite par l'hôte, aucun contournement) (E14) | modèle | moyen | règle mot pour mot « je n'écris jamais dans installation/ autrement que par le serveur » |
| 2026-09-20 | T9 | Baseline court-circuitée : aucun skill de domaine, `save_ticket` résolu accepté (E15) | triage §6, serveur | moyen | « même flux » explicite ; refuser résolu sans skill de domaine |
| 2026-09-20 | T10 | `symptome_initial` enrichi des réponses du tour 2 (E16) | triage | moyen | figer le symptôme au premier message |
| 2026-09-20 | C6 | `jeu-de-test.yaml` l.97 : séparateur à 4 colonnes pour 5 (E17) | outils | mineur | corriger |
| 2026-09-20 | D5 | `install.sh` sur un dossier temporaire réécrit `~/.claude.json` : enregistrement MCP en portée utilisateur, une machine = une installation, sans avertissement (E18) | install | **haut** | portée projet (`.mcp.json`) ou détection d'un enregistrement existant |
| | | | | | |
| 2026-09-21 | campagne sans jeu de données (M0–M9, V0–V6, `859ffec`) | Journal complet : `campagne-test-0.3.0-beta-sans-jeu-de-donnees.md` (3 écarts EA1–EA3, 4 observations OA1–OA4). Le parcours d'un client, contexte vide : le modèle demande, il n'invente pas. Lignes ci-dessous = une par écart. | — | — | — |
| 2026-09-21 | V1, V5 | `search_kb` sur base vide : « Tag inconnu : reseau » (puis `poste-de-travail`, `demande`) — E2 revient parce que les structurels sont déduits des cas publiés, pas du manifeste (EA1) | serveur | mineur | **corrigé le 2026-09-21** : natures et domaines de la bibliothèque toujours connus |
| 2026-09-21 | V1 tour 13–14 | `mises_a_jour_contexte` pour `systeme/serveurs`, jamais servie : colonnes inventées (`Adresse` au lieu de `Site \| Physique / VM \| OS \| Administration`), écrites telles quelles par `update_context` (EA2) ; « interface **web** » non dit par le technicien, relu ensuite comme un fait (V2) | skill clôture, serveur | moyen | **corrigé le 2026-09-21** (décision 45) : en-tête de tableau contrôlé ; clôture : `get_context` d'abord pour une section jamais servie |
| 2026-09-21 | V3 | File des candidats : la mise à jour d'EX-3002 pour `reseau/acces-distant` (section reprise + ajout) écartée parce que les 60 premiers caractères sont dans la section (EA3) | serveur (audit.ts) | moyen | **corrigé le 2026-09-21** (décision 46) : candidat entier |
| 2026-09-21 | V1, V3, V4, V5 | Observations : audit muet sur 45 sections vides (OA1) ; copie `historique/` d'un gabarit vierge et « remplacée » pour « remplie » (OA2) ; `section: systeme/partages` sur une réponse « oui » → bruit dans la file, écarté par le modèle lui-même (OA3) ; « relance `/support EX-3003` jeudi » sur un ticket clôturé non publié — irréalisable (OA4) ; E9 ×5 ; E3 ×2 atténuées ; dates calculées (« vendredi » → 25/09/2026) ; vouvoiement dans l'audit | serveur, skills, modèle | mineur | à trancher / à observer |
| 2026-09-21 | rejeu R-EA1–R-EA3 (EX-3101–3103, clone `cf7f708`) | Les trois corrections tiennent en vrai. Relevé : le modèle range ses **déductions** comme des réponses du technicien — question fabriquée « convention de nommage constatée ? → initiale.nom », candidat `annuaires` « Active Directory / module PowerShell » jamais dit, « interface web » ×3 (OA5) ; `Get-ADUser` proposé « si tu es sur AD » avec `annuaires` vide ; une phrase en anglais ; la pause proposée spontanément pour attendre l'opérateur (OA4 bien joué) | modèle / skills | mineur (invariant « rien d'inventé », prompt seul) | **corrigé le 2026-09-21** (OA3/OA5) : descriptions des champs `questions`, `cloture.md`, `triage.md` ; à observer au prochain rejeu |
| 2026-09-21 | second lot après rejeu | OA1, OA2, OA4, O6, O8 corrigés (`fin-de-projet.md` §12, décisions 47–48) : audit muet sur les vides, gabarit vierge archivé, demande reportée clôturée, rappel `/mcp`, durée calendaire | serveur, scripts, prompt | — | fait ; O1, O2, O3, O7 laissés pour 0.3.0 |

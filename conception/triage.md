# Triage

> Livrable du périmètre E. Décisions héritées : nature avant domaine, porte
> asymétrique, raisonnement montré, escalade = re-triage, correction par
> ajout/retrait. Le texte livré est `produit/contenu/general/triage.md`, servi par
> `load_skill(["triage"])` avec le manifeste ; ce document dit pourquoi il
> est écrit ainsi et tranche les questions du plan.

## 1. Où vit le triage

Dans `produit/contenu/general/triage.md`, chargé par le serveur, **pas** dans le point
d'entrée `/support` (dix lignes, décision 0.4). Le triage reçoit à la suite
le manifeste rendu : c'est lui qui porte les signaux discriminants, donc
la taxonomie de `conception/` n'a pas à être livrée. Conséquence : changer
un signal, c'est éditer le manifeste, et le triage suit.

Le fichier porte aussi **le flux entier** (les dix étapes de 0.3) : le
modèle doit le connaître dès le premier tour, et c'est le seul endroit chargé
à ce moment-là. Il fait ~100 lignes, comme un skill.

## 2. Questions du plan, tranchées

| Question | Décision | Raison |
| --- | --- | --- |
| Qu'est-ce qui définit l'ambiguïté ? | Trois cas, et seulement eux : **deux domaines** ont au moins un signal chacun ; **aucun signal** n'est présent dans le texte ; la **nature** n'est pas décidable. Un domaine avec des signaux nets et l'autre sans → net, on charge. | Une définition par cas observables, pas par « ça me semble flou ». Les dix symptômes de la taxonomie §7 sont tous du premier cas. |
| Correction humaine : rejet ou ajustement ? | Ajustement : « ajoute X », « retire Y ». Appliqué tel quel, puis chargement. | On ne dit jamais « non » à un triage, on le complète (plan E). |
| Combien de domaines au maximum ? | Deux, porté par `max_domaines` du manifeste et refusé par le serveur au-delà. | Au-delà, le triage n'a pas tranché ; le serveur l'empêche structurellement plutôt que par consigne. |
| Une question systématique au lancement ? | **Une seule, et pas de cadrage : la référence du ticket** dans l'outil de ticketing, demandée avant le triage si la description ne la contient pas ; « pas de référence » suffit. L'outil n'y accède pas, il la reporte à la clôture (`save_ticket.reference`), d'où elle devient un tag. | Un technicien part presque toujours d'un ticket existant ; la référence ne dépend pas du contenu et coûte une question courte. Décidé le 2026-09-09. |
| Cadrage systématique au lancement (question ouverte de `plan.md` §4) ? | **Non.** Les trois questions de rattrapage ne sont posées que si aucun signal n'est présent, une à la fois, celle qui discrimine le mieux. | Un formulaire systématique se remplit machinalement au bout de deux semaines et consomme le budget d'attention avant de savoir si le ticket en avait besoin. À revoir sur données réelles si le taux de rattrapage est élevé. |
| Domaine décrit mais hors bêta ? | Le triage le nomme, répond « hors des domaines couverts pour l'instant » et propose de clôturer avec ce constat (`statut: hors-domaines-couverts`). Le serveur refuse de toute façon le chargement. | Un ticket imprimante forcé dans réseau produit un faux diagnostic avec assurance. Et le ticket clôturé compte : c'est la mesure de ce que la bêta ne couvre pas. |

## 3. Format de la proposition

Cas net : deux lignes (triage, signaux) et l'annonce du chargement dans le
même tour, avec l'invitation à corriger. Cas ambigu : les mêmes deux lignes,
puis **une** question, et rien d'autre. Le modèle ne demande pas « valider ? »
sur un cas net : si la validation est demandée sur 100 % des tickets, elle
devient un réflexe en deux semaines (plan E).

## 3 bis. Remplir le contexte n'est pas un ticket

« Remplis le domaine système », « note la topologie » : ni incident ni
demande. Le triage le reconnaît et charge `load_skill(["remplissage"])`
sans triage ni référence ; le skill conduit l'entretien section par
section et n'écrit (`update_context`) qu'après un oui explicite. Pendant
un ticket, même chose sur demande explicite du technicien, puis retour au
skill du ticket. Ajouté le 2026-09-09.

## 3 ter. Points d'étape, pause et reprise — 2026-09-10

Le triage est aussi le moment où le brouillon naît : dès le triage validé,
`save_progress` enregistre référence, symptôme tel quel, nature, domaines,
skill à charger et prochaine étape. Ensuite, chaque acquis qui coûterait à
refaire est un point d'étape. À l'entrée, le triage reçoit du serveur la
liste des tickets en cours : si la référence donnée y figure, ou si le
technicien demande une reprise, `resume_ticket` remplace le triage — on ne
retriage pas un ticket dont le domaine est déjà validé, on recharge le skill
enregistré et on repart à la prochaine étape notée. Une passation d'un
collègue se dit au technicien et s'enregistre au point d'étape suivant.

## 4. L'escalade

Le skill chargé produit des signaux plus fiables que la description
initiale ; le triage les traite avec les mêmes règles. Ce qui change :
`load_skill` est rappelé, et la clôture enregistre `domaines_proposes`,
`domaines_valides` et `escalades` séparément. Un ticket « parti réseau,
conclu système » est la matière du jeu de test (`validation.md` T-A1) et
désigne un signal à corriger dans le manifeste.

## 5. Jeu de test

Celui de `conception/taxonomie.md` §7, joué par T-A1 à T-A3 de
`conception/validation.md`, puis par T-D1 avec l'outil. Il s'enrichit de
chaque ticket réel mal classé et de chaque escalade constatée — le champ
`symptome_initial` conservé tel quel dans chaque ticket sert à ça.

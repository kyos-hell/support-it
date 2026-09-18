# Clôture du ticket

## Ce qu'on fait ici

Le cas est instruit, le plan d'action a été validé et exécuté (ou le ticket
s'arrête : hors domaines couverts, non résolu, escaladé à l'extérieur). Tu
enregistres, puis tu proposes — sans décider — la publication.

## Avant d'appeler `save_ticket`

Vérifier, sans poser de liste de questions : si une information manque pour
un champ obligatoire, **une question, puis tu attends la réponse**, et
seulement pour celui-là.

- Le **symptôme initial** est recopié **tel qu'exprimé au départ**, pas
  reformulé avec ce qu'on sait maintenant. C'est ce qui nourrit le jeu de
  test du triage.
- Le **statut** : `resolu`, `non-resolu`, `hors-domaines-couverts`,
  `escalade-externe`.
- Les **domaines** validés par le technicien. Les domaines proposés et la
  chaîne d'escalade viennent du brouillon et des skills chargés : le
  serveur les a, ne pas les reconstituer de mémoire.
- Les **signaux** : ceux cochés au triage sont déjà dans le brouillon ; n'en
  ajouter (`{ id, preuve }`) que si un signal du manifeste s'est révélé en
  cours de route. Le serveur écrit la section par libellé.
- La **conclusion** : la cause retenue et comment elle a été établie.
- Le **plan d'action** validé, tel que proposé (la séquence numérotée,
  une commande par étape) — obligatoire pour un ticket résolu.
- Chaque **question posée** au technicien, avec sa réponse, et — quand la
  réponse est une information d'entreprise (une passerelle, un serveur, un
  prestataire) — la **section de contexte** qu'elle pourrait remplir. Le
  serveur en fait le journal du ticket (un fichier par ticket) : c'est
  ainsi que les gabarits se complètent.
- Les **mises à jour de contexte** : quand le terrain a contredit ou complété
  le contexte, formuler le contenu **prêt à coller** dans la section visée.
  **Trier avant de proposer** : le contexte reçoit ce que l'entreprise
  possède et comment c'est organisé (une plateforme, un abonnement et ses
  pièges, une convention, un référent, un serveur pivot dont d'autres
  services dépendent) ; il ne reçoit **pas** ce que ce ticket a créé ou
  touché (une VM de projet, une règle, un conteneur) — ça reste dans le
  ticket, `search_kb` le retrouvera. Test : *un autre technicien, sur un
  autre ticket dans six mois, aurait-il besoin de ce fait avant sa première
  question ?* Rien n'est écrit sans le oui du technicien (section suivante).
- Les **tags** : **cocher au plus cinq** dans la liste servie à la fin de
  ce document — ceux qui distinguent ce cas (la cause, pas le domaine). Un
  tag hors liste ou d'un autre domaine est refusé ; on n'en invente pas, le
  référent enrichit `tags.yaml`. Nature, domaines, escalades et référence
  sont ajoutés automatiquement.
- La **référence** du ticket dans l'outil de ticketing, telle que donnée
  par le technicien (au début, ou en cours de route). Si elle n'a jamais été
  donnée, la demander une fois ici ; « pas de référence » suffit. Elle est
  ajoutée aux tags : un cas publié se retrouve par sa référence.
- La **durée** si le technicien peut la donner, et pour un ticket de
  baseline, `conclusion_humaine` et `resolu_par`.

Le serveur fabrique l'identifiant et le chemin : ne jamais en proposer.
**Le brouillon en cours est rattaché par le serveur** : `save_ticket` sans
`id` suffit, le ticket final reprend l'id du brouillon, ce qu'il a
accumulé (symptôme, questions, signaux, plan, durée) est la source, et il
est retiré. Un `id` n'est utile que pour lever une ambiguïté ; un autre
brouillon que le courant est refusé (`resume_ticket` pour basculer).

## Après `save_ticket` : proposer d'écrire le contexte

Si le ticket a produit des **mises à jour de contexte** (sections
candidates, contexte contredit par le terrain), les lister en une ligne
chacune — section, résumé du contenu — et demander : « J'écris ces
sections dans le contexte maintenant ? » Sur un oui explicite, montrer
chaque section en entier et appeler `update_context` une section à la
fois, chacune après son oui. Sur non, elles restent dans le ticket à
destination du référent, rien n'est perdu. Ne jamais écrire une valeur que
le technicien n'a pas donnée ou confirmée.

## Puis proposer la publication

La publication est le troisième point de validation humaine. Proposer
seulement si les trois conditions tiennent, et le dire en une ligne :

1. statut `resolu` ;
2. cause **vérifiée** par le résultat de l'action, pas seulement plausible ;
3. le cas est **générique** — un autre technicien, un autre jour, y
   retrouverait son problème à partir des tags.

Formuler : « Publier en base de connaissances avec les tags [a, b, c] ? »
et n'appeler `publish_kb` qu'après un **oui** explicite. Un « non » ou un
silence n'est pas un oui. Un mauvais diagnostic publié se répète pendant des
mois ; un ticket non publié reste dans `tickets/` et n'est pas perdu.

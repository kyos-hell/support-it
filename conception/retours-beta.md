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
| | | | | | |

## Mesures (T-P7)

| Ticket | Nature | Domaine(s) | Questions posées | Durée (min) | Résolu par |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

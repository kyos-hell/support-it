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
| 2026-09-09 | ITHELP-6354 | Le cloud IaaS n'est dans aucun domaine ; rangé dans système, volet VNet/NSG écarté de réseau par lecture stricte du prérequis d'`ouverture-flux` (« la destination existe »). | A, B | idée | À trancher : demande `creation-vm` côté système et nuance « destination créée par une étape précédente du même plan » dans `ouverture-flux`, ou domaine cloud. Non fait. |
| 2026-09-09 | ITHELP-6354 | Le tout se juge à la clôture : demande absente journalisée ? section candidate proposée par `update_context` ? tags libres (`azure`, `vm`) ? | E, F | idée | À observer sur ce ticket, puis sur les suivants : trois occurrences d'un tag libre = montée au manifeste. |
| | | | | | |

## Mesures (T-P7)

| Ticket | Nature | Domaine(s) | Questions posées | Durée (min) | Résolu par |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

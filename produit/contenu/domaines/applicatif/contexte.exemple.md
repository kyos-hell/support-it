# Contexte entreprise — applicatif

<!-- Gabarit livré. Copiez-le en installation/contexte/applicatif.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## catalogue — Applications métier

<!-- Les applications métier qu'on est susceptible de traiter : nom usuel,
     ce qu'elle fait, éditeur, version en production, où elle est hébergée
     (interne, plateforme cloud, SaaS — renvoyer à general/plateformes),
     criticité, où voir son journal. Le niveau utile : ce qu'un technicien
     demande à un collègue (« l'appli de facturation, c'est quoi et c'est
     où ? »). -->

| Application | Usage | Éditeur | Version en production | Hébergement | Criticité | Où voir le journal |
| --- | --- | --- | --- | --- | --- | --- |
| <nom usuel> | <facturation, RH, production…> | <éditeur> | <version> | <serveur interne, plateforme, SaaS> | <critique, importante, standard> | <console, fichier, outil> |

## responsables — Référents par application

<!-- Pour chaque application : le référent métier (celui qui dit ce qui
     est normal et valide un changement fonctionnel) et le référent
     technique (celui qui met à jour, paramètre, ouvre un ticket éditeur).
     Un rôle, pas un nom : le nom vit dans l'annuaire. -->

| Application | Référent métier (rôle) | Référent technique (rôle) | Comment les joindre |
| --- | --- | --- | --- |
| <nom> | <fonction, service> | <équipe, prestataire> | <canal> |

## editeurs-support — Éditeurs et contrats de support

<!-- Pour chaque éditeur : le contrat de support, comment ouvrir un
     ticket (portail, adresse, téléphone), ce qu'il faut fournir, les
     horaires et délais, la base de connaissances publique s'il y en a
     une, et les versions encore supportées. Section à dater : les
     contrats se renouvellent. -->

| Éditeur | Applications | Contrat | Ouvrir un ticket | À fournir | Délai / horaires | Base de connaissances |
| --- | --- | --- | --- | --- | --- | --- |
| <éditeur> | <applications> | <niveau, échéance> | <portail, canal> | <numéro de client, version, journal> | <délai, plage> | <où> |

Dernière mise à jour : <date>

## integrations — Interfaces entre applications

<!-- Les flux entre applications : source, cible, ce qui passe, comment
     (fichier, API, base partagée, file), à quel rythme, et où voir qu'un
     échange a eu lieu ou a échoué. C'est la section qui explique une
     donnée manquante « de l'autre côté ». -->

| Source → cible | Ce qui passe | Moyen | Rythme | Où voir l'état | Qui relance |
| --- | --- | --- | --- | --- | --- |
| <application A → application B> | <données> | <fichier, API, base, file> | <temps réel, horaire, nuit> | <journal, dossier, console> | <équipe> |

## environnements — Environnements et mises en production

<!-- Pour chaque application qui en a : les environnements (production,
     recette, test), comment on y accède, la chaîne de livraison (qui met
     en recette, qui recette, qui livre en production), et la fenêtre de
     mise en production habituelle. -->

| Application | Environnements | Accès | Chaîne de livraison | Fenêtre habituelle |
| --- | --- | --- | --- | --- |
| <nom> | <production, recette, test> | <adresse, procédure> | <qui livre, qui recette, qui valide> | <jour, heure> |

## acces-applicatifs — Modèle de rôles par application

<!-- Comment les droits se donnent dans chaque application : rôles ou
     profils existants et ce qu'ils permettent, où on les attribue (dans
     l'application, par un groupe d'annuaire), qui a le droit de les
     attribuer, et les règles de séparation des tâches. Pas la liste des
     utilisateurs et de leurs rôles. -->

| Application | Rôle / profil | Permet | Attribué par | Qui peut l'attribuer | Contraintes |
| --- | --- | --- | --- | --- | --- |
| <nom> | <rôle> | <opérations, périmètre> | <écran d'administration, groupe d'annuaire> | <rôle> | <séparation des tâches, approbation> |

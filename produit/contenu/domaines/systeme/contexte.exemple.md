# Contexte entreprise — système

<!-- Gabarit livré. Copiez-le en installation/contexte/systeme.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## serveurs — Inventaire des serveurs

<!-- Les serveurs qu'on est susceptible d'incriminer : nom usuel, rôle,
     site, physique ou virtuel, OS, comment on l'administre. Le niveau de
     détail utile : ce qu'un technicien demanderait à un collègue (« il est
     où, le serveur de fichiers de l'agence ? »), pas un DAT. -->

| Serveur | Rôle | Site | Physique / VM | OS | Administration |
| --- | --- | --- | --- | --- | --- |
| <nom> | <fichiers, annuaire, messagerie, applicatif X…> | <site> | <physique ou hyperviseur porteur> | <OS et version> | <RDP, SSH, console, outil> |

## services — Carte des services

<!-- Pour chaque service partagé : qui le porte et de quoi il dépend. C'est
     la section qui permet de passer d'un symptôme (« le partage compta ne
     répond plus ») au serveur à regarder, puis aux dépendances à tester. -->

| Service | Serveur(s) porteur(s) | Dépend de | Où voir l'état et les journaux |
| --- | --- | --- | --- |
| <nom du service> | <serveur> | <annuaire, DNS, base de données, stockage, certificat…> | <console, journal, outil de supervision> |

## virtualisation — Virtualisation

<!-- La plateforme d'hyperviseurs : produit, hôtes, cluster ou pas, console
     d'administration, où voir l'état et les ressources d'une VM. Chargée
     quand un serveur virtuel est injoignable ou manque de ressources. -->

<produit et version> · <hôtes et site de chacun> · <cluster, haute
disponibilité, stockage partagé ou non> · <console et qui y a accès>

## stockage — Stockage

<!-- Ce qui porte les données : baies, volumes, capacité, seuils d'alerte,
     où voir l'espace libre. Chargée sur les symptômes « disque plein »,
     « volume absent », et pour placer un nouveau partage. -->

| Volume / baie | Serveur(s) | Capacité | Usage | Seuil d'alerte | Où voir l'espace |
| --- | --- | --- | --- | --- | --- |
| <nom> | <qui le monte> | <taille> | <fichiers, VM, bases…> | <seuil> | <outil> |

## partages — Partages de fichiers

<!-- Les partages exposés aux utilisateurs : chemin d'accès, serveur,
     groupes de droits, usage. Et les conventions maison de nommage des
     partages et des groupes. Mise à jour par le plan d'action de chaque
     création de partage. -->

| Partage | Chemin d'accès | Serveur | Usage | Groupe lecture | Groupe modification |
| --- | --- | --- | --- | --- | --- |
| <nom> | <chemin> | <serveur> | <équipe, service…> | <groupe> | <groupe> |

Conventions : <nommage des partages et des groupes de droits, si elles
existent>

Dernière mise à jour : <date>

## sauvegardes — Sauvegardes

<!-- La solution, ce qu'elle couvre, à quel rythme, combien de temps on
     garde, où voir les rapports, et comment on restaure (clichés ou
     versions précédentes d'abord, si disponibles). -->

| Périmètre sauvegardé | Solution | Fréquence | Rétention | Où voir les rapports |
| --- | --- | --- | --- | --- |
| <serveurs, volumes ou partages> | <produit> | <rythme> | <durée> | <console> |

Restauration : <clichés ou versions précédentes disponibles et sur quoi ·
qui peut restaurer · délai habituel>

## messagerie — Messagerie côté serveur

<!-- La plateforme de messagerie vue du serveur : produit, serveurs ou
     service en ligne, relais et passerelles, où voir les files d'attente
     et les quotas. Pas le paramétrage des clients de messagerie. -->

<produit ou service> · <serveurs ou relais et leur rôle> · <où voir les
files, les quotas, les rejets>

## certificats — Certificats

<!-- Les certificats dont l'expiration casse un service : lequel, où il
     est installé, échéance, qui le renouvelle. La PKI interne s'il y en a
     une. Section à dater : les échéances bougent. -->

| Certificat | Service(s) concerné(s) | Émetteur | Échéance | Qui renouvelle |
| --- | --- | --- | --- | --- |
| <nom ou usage> | <service> | <PKI interne, autorité publique> | <date> | <équipe ou prestataire> |

Dernière mise à jour : <date>

## ordonnancement — Tâches planifiées

<!-- Les tâches planifiées dont l'échec a un effet visible : quoi, sur
     quel serveur, quand, ce qui se passe si elle ne tourne pas, où voir
     son résultat. Pas la liste exhaustive des tâches système. -->

| Tâche | Serveur | Horaire | Effet si échec | Où voir le résultat |
| --- | --- | --- | --- | --- |
| <nom> | <serveur> | <planning> | <symptôme visible> | <journal, console> |

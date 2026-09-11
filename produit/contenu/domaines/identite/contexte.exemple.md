# Contexte entreprise — identité et annuaire

<!-- Gabarit livré. Copiez-le en installation/contexte/identite.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## annuaires — Annuaires et autorité

<!-- Les annuaires en service (domaine interne, annuaire cloud, LDAP
     applicatif) et, pour chaque type de compte ou de service, lequel fait
     autorité : c'est la première question d'un diagnostic (« où vit ce
     compte ? »). Conventions de nommage des comptes. Pas la liste des
     comptes. -->

| Annuaire | Type | Fait autorité pour | Conventions de nommage | Administration |
| --- | --- | --- | --- | --- |
| <nom usuel> | <domaine interne, annuaire cloud, LDAP…> | <comptes utilisateurs, messagerie, applications…> | <prenom.nom, initiale+nom…> | <console, outil, qui a les droits> |

## synchronisation — Synchronisation entre annuaires

<!-- Ce qui synchronise un annuaire vers un autre : le connecteur, le
     serveur qui le porte, le sens, la fréquence, ce qui est synchronisé
     (attributs, mot de passe, réécriture), le compte technique utilisé,
     où voir l'état et le journal. Section à dater : un connecteur change
     avec les migrations. -->

| Source → cible | Connecteur | Serveur porteur | Fréquence | Ce qui passe | Où voir l'état |
| --- | --- | --- | --- | --- | --- |
| <annuaire A → annuaire B> | <produit> | <serveur> | <délai> | <attributs, mot de passe, réécriture…> | <console, journal> |

Dernière mise à jour : <date>

## authentification — Authentification, MFA et politiques

<!-- Comment on s'authentifie : SSO ou fédération et sur quoi, méthodes
     MFA autorisées et comment on les enregistre, politique de mot de passe
     (longueur, expiration), politique de verrouillage (seuil, durée), et
     les règles d'accès conditionnel qui refusent selon le lieu, le poste
     ou l'application. Un service de référence pour tester un mot de passe. -->

SSO / fédération : <quoi, pour quelles applications>
MFA : <méthodes, enregistrement, qui est concerné>
Mot de passe : <longueur, expiration, historique>
Verrouillage : <seuil, durée, où voir la source d'un verrouillage>
Accès conditionnel : <règles qui refusent, en une ligne chacune>
Service de référence pour tester une authentification : <lequel>

## groupes-droits — Groupes et modèle de droits

<!-- Comment les droits sont donnés : convention de nommage des groupes,
     modèle (groupe par ressource, par rôle, imbrication), qui approuve
     quoi, et les groupes qui donnent un accès critique. Pas la liste de
     tous les groupes : ce qu'il faut pour trouver le bon et l'étroit. -->

Convention de nommage : <préfixes, structure>
Modèle : <un groupe par ressource et par niveau, groupes de rôle, imbrication…>

| Groupe ou famille | Donne accès à | Niveau | Qui approuve |
| --- | --- | --- | --- |
| <nom ou motif> | <ressource, application> | <lecture, modification, administration> | <propriétaire> |

## cycle-de-vie — Arrivées, mobilités, départs

<!-- Le processus : qui peut demander une arrivée ou un départ, par quel
     canal, les étapes dans l'ordre et qui fait chacune, les délais
     (création avant l'arrivée, désactivation le jour du départ,
     suppression après combien de temps), le sort des données et de la
     boîte. -->

| Événement | Qui demande | Étapes dans l'ordre | Délais |
| --- | --- | --- | --- |
| <arrivée> | <RH, responsable…> | <création, groupes, MFA, remise du mot de passe…> | <J-x, J, J+x> |
| <départ> | <RH, responsable…> | <désactivation, révocation, boîte, données, suppression…> | <J, J+x> |

Données et boîte au départ : <transfert, conservation, durée>

## comptes-service — Comptes de service et techniques

<!-- Les comptes qui portent un service, une tâche, un connecteur : pour
     chacun, ce qu'il porte, où il est utilisé, sa politique de mot de passe
     (expire ou non, qui le change), et qui en est responsable. C'est ce
     qui évite de désactiver un compte « inutilisé » qui fait tourner une
     sauvegarde. -->

| Compte | Porte | Utilisé sur | Mot de passe | Responsable |
| --- | --- | --- | --- | --- |
| <nom> | <service, tâche, connecteur> | <serveur, application> | <expire ou non, rotation> | <équipe> |

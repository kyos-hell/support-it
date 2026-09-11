# Contexte entreprise — poste de travail

<!-- Gabarit livré. Copiez-le en installation/contexte/poste-de-travail.md
     et remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## parc — Familles de postes

<!-- Les familles de postes en service, pas l'inventaire : pour chaque
     famille, le modèle standard, l'OS et sa version, le mode de gestion
     (domaine, MDM, hors gestion), la population qui l'utilise, la
     convention de nommage. C'est ce qui permet de situer un poste en une
     question (« c'est un portable standard ou un poste atelier ? »). -->

| Famille | Modèle standard | OS et version | Gestion | Population | Convention de nommage |
| --- | --- | --- | --- | --- | --- |
| <fixe, portable, virtuel, atelier…> | <modèle> | <OS, version> | <domaine, MDM, aucune> | <qui> | <motif> |

## deploiement — Déploiement et mises à jour

<!-- Comment un poste est installé et maintenu : l'outil de déploiement
     (image, MDM, gestionnaire de parc), la procédure et son délai, le
     portail libre-service s'il existe, le rythme et la fenêtre des mises à
     jour, où voir l'historique de ce qui a été poussé sur un poste. Un
     symptôme sur plusieurs postes se corrèle d'abord à cette section. -->

Outil de déploiement : <produit, console, qui a les droits>
Procédure pour un poste neuf : <étapes en une ligne, délai>
Mises à jour : <rythme, fenêtre, anneaux ou groupes de déploiement>
Où voir ce qui a été poussé sur un poste : <console, journal>

## applications-standard — Socle applicatif

<!-- Les applications installées partout ou disponibles en libre-service,
     avec leur version cible et leur mode d'installation. Et les
     applications interdites ou soumises à validation. Pas la liste des
     applications métier (domaine applicatif). -->

| Application | Version cible | Installée par défaut | Mode d'installation | Remarques |
| --- | --- | --- | --- | --- |
| <nom> | <version> | <oui / non> | <image, déploiement, portail, manuel> | <licence, restriction> |

Applications interdites ou soumises à validation : <lesquelles, qui valide>

## profils — Profils et données utilisateur

<!-- Où vivent le profil et les données de l'utilisateur : profil local ou
     itinérant, redirection de dossiers, synchronisation cloud, ce qui suit
     l'utilisateur d'un poste à l'autre et ce qui reste sur le poste. Ce
     qu'on vérifie quand une session est lente ou un profil temporaire. -->

Type de profil : <local, itinérant, hybride>
Données synchronisées ou redirigées : <dossiers, outil>
Ce qui reste sur le poste : <quoi>
Où voir l'état de la synchronisation : <outil, journal>

## securite-poste — Sécurité du poste

<!-- Les agents de sécurité présents (antivirus, EDR, chiffrement, pare-feu
     local, contrôle applicatif), où voir leurs journaux et leurs blocages,
     et qui décide d'une exception. Un blocage ne se contourne pas : il se
     fait arbitrer. -->

| Agent | Rôle | Où voir les blocages | Qui arbitre une exception |
| --- | --- | --- | --- |
| <produit> | <antivirus, EDR, chiffrement, pare-feu, contrôle applicatif> | <console, journal> | <référent> |

## impression — Impression

<!-- Comment on imprime : serveurs ou service d'impression, méthode de
     déploiement des files (par site, par groupe), où sont les pilotes,
     et les imprimantes par site avec leur file. Chargée quand un poste
     n'imprime plus ou qu'on prépare un poste. -->

Service d'impression : <serveur ou service, méthode de déploiement des files>

| Site | Imprimante ou file | Modèle | Pilote | Remarques |
| --- | --- | --- | --- | --- |
| <site> | <nom de la file> | <modèle> | <pilote, source> | <badge, recto-verso par défaut…> |

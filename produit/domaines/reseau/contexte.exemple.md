# Contexte entreprise — réseau

<!-- Gabarit livré. Copiez-le en installation/contexte/reseau.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## topologie — Topologie du réseau

<!-- Le dessin d'ensemble en texte : les réseaux de chaque site, leurs
     passerelles, comment les sites se joignent. Le niveau de détail
     utile : ce qu'un technicien demanderait à un collègue (« c'est quoi la
     passerelle du site B ? »), pas un DAT. -->

| Site | Réseau | Passerelle | Remarques |
| --- | --- | --- | --- |
| <site> | <plage> | <adresse> | <VLAN voix, invités…> |

Interconnexions : <comment les sites se joignent, par quel lien, quel débit>.

## equipements — Équipements réseau

<!-- Les équipements qu'on est susceptible d'incriminer ou de configurer :
     cœurs, switchs d'étage, bornes, pare-feu, routeurs. Avec leur rôle et
     leur emplacement — l'adresse d'administration si elle aide. -->

| Équipement | Rôle | Site / emplacement | Administration |
| --- | --- | --- | --- |
| <nom> | <cœur, étage, pare-feu, borne…> | <où> | <adresse ou outil> |

## acces-distant — Accès distant (VPN)

<!-- Solution VPN, qui y a droit, comment on s'y connecte, ce qui est
     joignable à travers. Chargée quand un incident ou une demande touche le
     travail à distance. -->

<solution utilisée> · <population autorisée> · <mode d'authentification> ·
<ce qui est accessible via le VPN, ce qui ne l'est pas>

Dernière mise à jour : <date>

## dns-dhcp — DNS et DHCP

<!-- Qui rend ces services (serveurs, équipements), pour quelles plages,
     et les particularités : zones internes, redirecteurs, réservations. -->

DNS : <qui porte le service, zones internes, redirecteurs>
DHCP : <qui porte le service, plages par site, durée de bail>

## proxy-filtrage — Proxy et filtrage

<!-- Ce qui filtre les flux sortants et inter-zones : proxy web, règles de
     pare-feu structurantes, catégories bloquées. Ce que « internet ne
     marche pas » peut vouloir dire ici. -->

<proxy : lequel, pour qui, explicite ou transparent> ·
<filtrage : où, quelle politique par défaut>

## wifi — Wifi

<!-- Les SSID, qui y a droit, comment on s'y authentifie, et ce que chaque
     SSID permet d'atteindre. -->

| SSID | Population | Authentification | Accès |
| --- | --- | --- | --- |
| <nom> | <employés, invités…> | <méthode> | <réseau atteint> |

## flux-existants — Flux ouverts

<!-- Les règles de flux notables déjà en place, pour vérifier qu'une
     demande d'ouverture n'existe pas déjà et comprendre la politique en
     vigueur. Mise à jour par le plan d'action de chaque ouverture. -->

| Source | Destination | Port / protocole | Motif | Depuis |
| --- | --- | --- | --- | --- |
| <origine> | <cible> | <port> | <pourquoi> | <date> |

Dernière mise à jour : <date>

## plan-adressage — Plan d'adressage et VLAN

<!-- Les VLAN existants et les plages réservées : la référence pour créer
     sans chevaucher. Mise à jour par le plan d'action de chaque création. -->

| VLAN | Nom | Plage | Usage | Site(s) |
| --- | --- | --- | --- | --- |
| <numéro> | <nom> | <plage> | <usage> | <où> |

Convention de numérotation : <la règle maison, si elle existe>

Dernière mise à jour : <date>

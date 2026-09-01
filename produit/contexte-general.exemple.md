# Contexte entreprise — transverse

<!-- Gabarit livré. Copiez-le en installation/contexte/general.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## sites — Sites et implantations

<!-- Un tableau par ligne de site : nom usuel, localisation, lien vers les
     autres sites (fibre, VPN, opérateur), nombre approximatif
     d'utilisateurs. C'est la section la plus consultée : elle permet de
     corréler « qui est touché » avec « quel lieu, quel lien ». -->

| Site | Localisation | Liaison | Utilisateurs |
| --- | --- | --- | --- |
| <nom> | <ville / bâtiment> | <type de lien vers les autres sites> | <nombre> |

## criticite-services — Criticité des services

<!-- Les services classés par impact d'une interruption : bloquant pour
     toute l'entreprise, bloquant pour une équipe, gênant. Sert à
     prioriser et à signaler dans un plan d'action qu'on touche à du
     critique. -->

| Service | Criticité | Population concernée |
| --- | --- | --- |
| <nom du service> | <bloquant entreprise / bloquant équipe / gênant> | <qui> |

## contacts-escalade — Contacts d'escalade

<!-- Vers qui escalader quand le support interne ne suffit pas :
     prestataires, opérateurs, éditeurs, avec le canal et les horaires.
     Pas les référents internes (section referents). -->

| Périmètre | Contact | Canal | Disponibilité |
| --- | --- | --- | --- |
| <réseau / opérateur / éditeur X…> | <organisation ou nom> | <téléphone, portail, mail> | <horaires> |

## referents — Référents du contexte

<!-- Un nom par domaine : la personne propriétaire de la fraîcheur du
     fichier de contexte de ce domaine. C'est elle qui applique les mises à
     jour formulées à la clôture des tickets et celles venues du terrain. -->

| Domaine | Référent |
| --- | --- |
| general | <nom> |
| reseau | <nom> |
| systeme | <nom> |

# Taxonomie des domaines

> Livrable du périmètre A de `plan.md`. Décisions héritées de l'étude :
> taxonomie **plate**, **six domaines décrits**, dont **deux implémentés en
> bêta** (réseau et système — les seuls à recevoir un skill et un gabarit),
> et définition par **signaux discriminants**, jamais par composants.
> Premier jet rédigé par l'IA, à corriger sur l'expérience terrain.

---

## 0. Le principe : un domaine se reconnaît, il ne se devine pas

**Un axe orthogonal d'abord : la nature.** Avant le domaine, le triage
détermine si le cas est un **incident** (« ça ne marche plus ») ou une
**demande** (« je veux que ») — voir périmètre E. La taxonomie des domaines
ci-dessous vaut pour les deux natures : une demande d'ouverture de flux est
du domaine réseau au même titre qu'un timeout.

La question qui gouverne toute la taxonomie : **le problème suit quoi ?**

| Le problème suit… | Domaine |
| --- | --- |
| …le chemin d'accès (lien, site, VPN, wifi) | Réseau |
| …un service partagé, quel que soit le chemin | Système |
| …la machine d'un utilisateur, côté logiciel | Poste de travail |
| …un objet physique | Matériel |
| …le compte d'une personne, quel que soit le poste | Identité et annuaire |
| …une fonction d'une application qui reste accessible | Applicatif |

Un signal est un **fait observable dans le texte du ticket**, binaire et
vérifiable. Quand la description ne contient aucun signal discriminant, le
triage ne devine pas : il pose une des trois questions de rattrapage, qui
suffisent à faire apparaître un signal dans la grande majorité des cas :

1. **Qui est touché ?** Une personne, un groupe corrélé à un lieu ou un lien,
   ou tout le monde ?
2. **Est-ce que ça a déjà fonctionné, et depuis quand ça ne fonctionne plus ?**
3. **Est-ce que ça dépend d'où ou de comment on se connecte ?**

---

## 1. Réseau — *implémenté en bêta*

**Ce qu'il couvre.** L'acheminement : liens, équipements d'interconnexion,
wifi, VPN, DNS, DHCP, proxy, pare-feu, accès internet.

**Ce qu'il ne couvre pas.** Le service qu'on cherche à joindre (système), le
poste qui s'y connecte (poste de travail), le droit d'y accéder (identité).
La carte réseau physique d'un poste est du matériel.

**Signaux discriminants.**

- Le problème dépend du **lieu ou du lien** : ça marche au bureau mais pas en
  VPN, ça marche au site A mais pas au site B, ça marche en filaire mais pas
  en wifi.
- **Tous les services** sont touchés en même temps : c'est le tuyau, pas une
  machine au bout.
- La population touchée est **corrélée à un lieu ou un lien** : tout un étage,
  tout un site, tous les gens en télétravail.
- Symptômes de transport : timeout, coupures intermittentes, lenteur sur tout.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Système | « Tout est super lent depuis ce matin » | Un service ou tous ? Un site ou tous ? |
| Système | « J'ai des timeout sur le partage de fichiers » | D'autres services répondent-ils ? D'autres utilisateurs sur d'autres sites ? |
| Identité | « Je n'arrive pas à me connecter au VPN » | Rejeté (identité) ou pas de réponse du tout (réseau) ? |
| Poste de travail | « Je n'ai plus internet » | Les voisins de bureau ont-ils internet ? |
| Matériel | « L'imprimante réseau ne répond plus » | Ping l'imprimante : répond mais n'imprime pas (matériel), injoignable (réseau). |

---

## 2. Système — *implémenté en bêta*

**Ce qu'il couvre.** Les services partagés et ce qui les porte : serveurs
(physiques ou virtuels), OS serveur, stockage, partages de fichiers,
sauvegardes, messagerie côté serveur, virtualisation, certificats,
ordonnancement.

**Ce qu'il ne couvre pas.** L'acheminement vers le service (réseau), la
logique interne d'une application métier (applicatif), le compte qui s'y
connecte (identité), le poste client (poste de travail).

**Signaux discriminants.**

- **Un service précis** est touché, les autres vont bien.
- Le problème est **indépendant du chemin d'accès** : mêmes symptômes en VPN,
  sur site, depuis n'importe quel poste.
- La population touchée est **tous les utilisateurs du service**, peu importe
  où ils sont.
- Symptômes côté serveur : espace disque plein, service arrêté, certificat
  expiré, sauvegarde en échec.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Réseau | « Le partage de fichiers rame pour tout le monde » | Les autres services rament-ils aussi ? Depuis tous les sites ? |
| Réseau | « Impossible d'ouvrir mes documents sur le serveur » | Le serveur répond-il par ailleurs ? D'autres services touchés ? |
| Applicatif | « L'ERP est en erreur pour tout le monde » | Erreur d'accès (système) ou erreur fonctionnelle une fois dedans (applicatif) ? |
| Identité | « Je ne reçois plus mes mails » | Une personne (identité) ou tout le monde (système) ? |

---

## 3. Poste de travail — *implémenté en bêta v2 (2026-09-11)*

**Ce qu'il couvre.** L'environnement logiciel de la machine d'un utilisateur :
OS client, profil, mises à jour, applications installées, configuration
locale, antivirus, périphériques côté pilote.

**Ce qu'il ne couvre pas.** La panne physique de la machine (matériel), le
compte de l'utilisateur (identité), les services distants (système), le
fonctionnement interne d'une application métier (applicatif).

**Signaux discriminants.**

- Le problème **suit la machine** : le même utilisateur sur un autre poste n'a
  pas le problème.
- **Un seul poste** est touché, les services et le réseau vont bien pour les
  autres.
- Le poste démarre et l'OS répond, mais quelque chose s'y comporte mal —
  lenteur locale, plantages, périphérique non reconnu.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Matériel | « Mon PC ne démarre pas » | Rien ne s'allume (matériel) ou ça s'allume mais l'OS ne vient pas (poste) ? |
| Identité | « Je ne peux plus ouvrir ma session » | Sur un autre poste, la session s'ouvre-t-elle ? |
| Réseau | « Le wifi coupe sans arrêt sur mon portable » | Les autres appareils au même endroit coupent-ils aussi ? |
| Applicatif | « L'appli plante au démarrage chez moi » | Plante-t-elle aussi sur le poste du voisin ? |

---

## 4. Matériel — *implémenté en bêta v2 (2026-09-11)*

**Ce qu'il couvre.** L'objet physique : composants (disque, mémoire,
alimentation, écran), périphériques (imprimantes, scanners, docks, casques),
câblage au poste, usure et casse.

**Ce qu'il ne couvre pas.** Ce que l'objet exécute (poste de travail ou
système), son raccordement au-delà de la prise (réseau).

**Signaux discriminants.**

- Symptômes **physiques** : rien ne s'allume, bruit anormal, surchauffe,
  écran noir ou fissuré, odeur.
- Le problème **persiste hors logiciel** : avant le démarrage de l'OS, ou sur
  un environnement sain.
- L'échange de l'objet fait disparaître le problème — et lui seul.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Poste de travail | « Mon écran reste noir » | Noir dès l'allumage (matériel) ou après la mire de démarrage (poste) ? |
| Réseau | « Je n'ai plus de connexion en filaire » | La prise fonctionne-t-elle avec un autre poste ? Le câble avec une autre prise ? |

---

## 5. Identité et annuaire — *implémenté en bêta v2 (2026-09-11)*

**Ce qu'il couvre.** Le compte et ses attributs : authentification, mots de
passe, verrouillages, groupes, droits d'accès, MFA, cycle de vie du compte
(arrivée, mobilité, départ).

**Ce qu'il ne couvre pas.** Le service auquel le compte accède (système),
l'annuaire en tant que serveur — un contrôleur de domaine en panne est un
problème système.

**Signaux discriminants.**

- Le problème **suit la personne** : mêmes symptômes quel que soit le poste.
- Le service **répond mais refuse** : mot de passe rejeté, accès refusé,
  compte verrouillé — un refus est une réponse, pas une absence de réponse.
- Corrélation avec un **événement de compte** : changement de mot de passe
  récent, changement de service, retour de congés.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Réseau | « Le VPN ne veut pas de moi » | Rejet explicite (identité) ou pas de réponse (réseau) ? |
| Système | « Impossible d'accéder au partage du service compta » | Une personne (identité) ou tout le service (système) ? |
| Poste de travail | « Ma session met dix minutes à s'ouvrir » | Sur un autre poste aussi (identité/profil) ou seulement celui-ci (poste) ? |
| Applicatif | « Je n'ai pas accès au module facturation » | Refus d'accès (identité) ou module en erreur (applicatif) ? |

---

## 6. Applicatif — *implémenté en bêta v2 (2026-09-11)*

**Ce qu'il couvre.** Le fonctionnement interne des applications métier :
erreurs fonctionnelles, données incohérentes, comportements inattendus,
paramétrage applicatif, versions.

**Ce qu'il ne couvre pas.** L'infrastructure qui porte l'application
(système), l'accès à l'application (réseau ou identité), son installation sur
un poste (poste de travail).

**Signaux discriminants.**

- **L'accès fonctionne** : on entre dans l'application, et c'est dedans que ça
  se passe mal.
- Le problème est lié à **une action ou une donnée précise** : tel écran,
  tel enregistrement, telle opération — le reste de l'application va bien.
- Reproductible **depuis n'importe quel poste et n'importe quel compte** ayant
  les mêmes droits.

**Voisins et symptômes ambigus.**

| Voisin | Symptôme ambigu (verbatim utilisateur) | Ce qui tranche |
| --- | --- | --- |
| Système | « L'ERP est très lent cet après-midi » | Lent partout (système) ou sur une opération précise (applicatif) ? |
| Identité | « Le module RH me dit accès refusé » | Refus pour cette personne (identité) ou pour tous (applicatif/paramétrage) ? |
| Poste de travail | « Depuis la mise à jour, l'appli affiche n'importe quoi » | Mise à jour de l'appli (applicatif) ou du poste (poste de travail) ? |

---

## 7. Le jeu de test du triage

Les symptômes des tableaux ci-dessus, consolidés. Règle de lecture : pour
chaque ligne, le triage doit soit proposer les domaines candidats listés,
soit poser la question qui tranche — jamais conclure sur un domaine unique
sans signal. Ce jeu s'enrichit à chaque ticket réel mal classé et à chaque
escalade constatée en diagnostic (« parti réseau, conclu système » —
périmètre E), qui sont les seuls verdicts qui comptent.

**Bêta v2 (2026-09-11).** Les six domaines ont un skill : les dix lignes
sont exerçables. La réponse « hors des domaines couverts » reste dans le
triage pour un symptôme qui ne tombe dans aucun des six (téléphonie fixe,
contrôle d'accès physique…) et pour tout domaine futur déclaré `decrit` au
manifeste ; le test de fumée la rejoue sur un domaine décrit synthétique,
puisque le produit livré n'en a plus.

**Le cloud n'est pas un domaine** (tranché le 2026-09-11, `plan.md` A). Le
triage reconnaît ce que le problème *suit* ; « c'est hébergé dans le cloud »
n'est pas un signal du ticket, et un domaine cloud transpercerait les six
autres (Entra est de l'identité, un VNet du réseau, une VM du système). Le
cloud est une **plateforme** : une ligne de `general/plateformes`, au même
rang que la salle serveur, et une colonne dans les sections qui en ont
besoin. Preuve par la bêta : l'incident de réécriture de mot de passe se
voyait dans le portail cloud, sa cause était un service Windows on-prem.

| # | Symptôme brut | Candidats | Question qui tranche |
| --- | --- | --- | --- |
| 1 | « Tout est super lent depuis ce matin » | réseau, système | Un service ou tous ? Un site ou tous ? |
| 2 | « J'ai des timeout sur le partage de fichiers » | réseau, système | D'autres services répondent-ils ? |
| 3 | « Le partage rame pour tout le monde » | réseau, système | Depuis tous les sites ? |
| 4 | « Je n'arrive pas à me connecter au VPN » | réseau, identité | Rejet explicite ou pas de réponse ? |
| 5 | « Je ne reçois plus mes mails » | identité, système | Une personne ou tout le monde ? |
| 6 | « Mon PC ne démarre pas » | matériel, poste de travail | Rien ne s'allume, ou l'OS ne vient pas ? |
| 7 | « L'ERP est en erreur pour tout le monde » | système, applicatif | Erreur d'accès ou erreur fonctionnelle ? |
| 8 | « Je n'ai plus internet » | réseau, poste de travail | Les voisins ont-ils internet ? |
| 9 | « Ma session met dix minutes à s'ouvrir » | identité, poste de travail | Pareil sur un autre poste ? |
| 10 | « L'imprimante réseau ne répond plus » | matériel, réseau | Joignable mais n'imprime pas, ou injoignable ? |

---

## 8. Critère de sortie — état

- Tout symptôme courant tombe dans au moins un domaine : **à éprouver** sur
  les tickets réels des deux premières semaines (protocole de baseline,
  section 3 de `plan.md`).
- Les cas à cheval sont explicitement listés : **fait**, section 7.
- Chaque domaine a ses signaux discriminants : **fait**, à corriger sur le
  terrain.
- Les six domaines ont un skill, des demandes et un gabarit : **fait** le
  2026-09-11 (bêta v2). Les quatre nouveaux sont des hypothèses jusqu'au
  premier ticket réel de chacun.

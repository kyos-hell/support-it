# Contexte entreprise — <domaine>

<!-- Squelette pour écrire le gabarit de contexte d'un nouveau domaine.
     Règles à respecter (conception/format-contexte.md) :

     1. Une section par identifiant déclaré dans l'en-tête YAML du skill et
        des demandes du domaine — dans les deux sens : tout identifiant
        déclaré a sa section ici, toute section ici est déclarée quelque
        part. Le script de validation (périmètre D) vérifie cette
        correspondance.
     2. Titre de section : `## <id> — <titre lisible>`. L'id est en
        kebab-case, sans espace ; c'est lui que les skills référencent
        (`<domaine>/<id>`). L'index est dérivé de ces titres par le
        serveur : il n'y a JAMAIS d'index écrit à la main.
     3. Chaque section commence par une consigne de remplissage en
        commentaire HTML comme celui-ci : quoi mettre, à quel niveau de
        détail. Le serveur retire les commentaires de ce qu'il renvoie —
        ils ne coûtent rien à l'usage, ne demandez pas au client de les
        supprimer.
     4. Niveau de détail : ce qu'un technicien demanderait à un collègue,
        pas une documentation exhaustive. Le contexte est un cache de
        réponses.
     5. Placeholders `<...>` uniquement. Jamais d'exemple ressemblant à du
        vrai (pas de srv-paris-01) : un exemple réaliste finit copié-collé
        et pris pour du vrai par l'IA.
     6. Tableaux pour l'énumérable (équipements, plages, règles), prose
        courte pour le reste.
     7. Les sections volatiles (mises à jour par des plans d'action, ou qui
        périment vite) se terminent par `Dernière mise à jour : <date>`.
     8. Aucune section n'est obligatoire : le gabarit ne le mentionne pas,
        c'est le comportement de l'outil (section vide = question posée au
        bon moment).

     Et le commentaire d'ouverture du gabarit livré est toujours celui
     ci-dessous — il s'adresse au client qui remplit. -->

<!-- Gabarit livré. Copiez-le en installation/contexte/<domaine>.md et
     remplissez sous chaque titre. Ne modifiez pas les identifiants des
     titres (la partie avant le tiret) : les skills les référencent.
     Une section laissée vide n'est pas une erreur : l'outil posera la
     question au technicien au moment utile. -->

## <id-section> — <Titre lisible>

<!-- Consigne : <quoi mettre dans cette section, à quel niveau de détail,
     et à quoi elle sert pendant une instruction>. -->

| <Colonne> | <Colonne> | <Colonne> |
| --- | --- | --- |
| <...> | <...> | <...> |

## <id-section-volatile> — <Titre lisible>

<!-- Consigne : <...>. Section mise à jour par les plans d'action de
     <quelle demande> — d'où la ligne de date. -->

<...>

Dernière mise à jour : <date>

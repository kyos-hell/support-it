---
name: support
description: Assistance au support IT, incidents et demandes. Utiliser dès qu'un technicien décrit un problème (« ça ne marche plus ») ou un besoin (« je veux que », « peux-tu créer »). Porte d'entrée unique, le triage décide du domaine.
---

Ticket décrit par le technicien : $ARGUMENTS

1. Si l'outil `load_skill` du serveur `support-it` n'est pas disponible, dis-le au technicien (Claude Code doit être ouvert dans le dossier support-it, et le serveur du projet accepté) et arrête-toi : ne traite jamais le ticket sans lui.
2. Si le texte ci-dessus est exactement `audit` : appelle l'outil MCP `load_skill` du serveur `support-it` avec `domaines: ["audit"]` et suis ce qu'il renvoie. Sinon, appelle `load_skill` avec `domaines: ["triage"]`, avant toute autre chose.
3. Suis à la lettre ce qu'il renvoie : c'est lui qui conduit le ticket, du triage à la publication.
4. Si le ticket ci-dessus est vide, demande au technicien de décrire le problème, en une seule question.
5. Réponds dans la langue du technicien, dès le premier message.

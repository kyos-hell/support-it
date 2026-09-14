#!/usr/bin/env node
// Serveur MCP « support-it » : huit appels, transport stdio, aucune
// intelligence. L'intelligence est dans les skills, le déterminisme ici.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lireVersion, racines } from "./config.js";
import { ErreurContexte, ecrireSection, obtenirSections, rendreSections } from "./contexte.js";
import { ETAPES, ErreurEnCours, LIMITES, listerBrouillons, rendreListe, rendreReprise, sauverProgression, trouverBrouillon } from "./encours.js";
import { ErreurKb, publier, rechercher, rendreRecherche } from "./kb.js";
import { ErreurSkill, chargerSkills } from "./skills.js";
import { enregistrerTicket } from "./tickets.js";

const r = racines();
const version = lireVersion(r);

const server = new McpServer({ name: "support-it", version });

type Reponse = { content: { type: "text"; text: string }[]; isError?: boolean };
const texte = (t: string): Reponse => ({ content: [{ type: "text", text: t }] });
const erreur = (e: unknown): Reponse => ({
  content: [{ type: "text", text: `Erreur : ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

server.registerTool(
  "load_skill",
  {
    title: "Charger un périmètre de travail",
    description:
      "Renvoie le skill d'un ou deux domaines (au plus deux), avec les sections de contexte requises déjà résolues et la table des sections selon le cas. " +
      "Valeurs réservées : domaines=[\"triage\"] au début de tout ticket (règles de triage + manifeste des domaines) ; domaines=[\"cloture\"] avant save_ticket ; domaines=[\"remplissage\"] pour remplir le contexte hors ticket. " +
      "`nature` (incident ou demande) est obligatoire pour un domaine : elle choisit skill.md ou demandes.md.",
    inputSchema: {
      domaines: z.array(z.string().min(1)).min(1).describe("Identifiants de domaine du manifeste, ou triage, cloture, remplissage"),
      nature: z.enum(["incident", "demande"]).optional().describe("Nature du ticket, décidée par le triage"),
    },
  },
  async ({ domaines, nature }) => {
    try {
      return texte(chargerSkills(r, domaines, nature));
    } catch (e) {
      if (e instanceof ErreurSkill) return erreur(e);
      throw e;
    }
  },
);

server.registerTool(
  "get_context",
  {
    title: "Lire des sections du contexte entreprise",
    description:
      "Renvoie les sections demandées du contexte rempli par l'entreprise, identifiées « domaine/section » (ex. reseau/dns-dhcp, general/sites). " +
      "Appelable plusieurs fois par ticket, dès qu'un signal selon-cas apparaît. Une section vide ou inconnue n'est pas une erreur : c'est une question à poser au technicien.",
    inputSchema: {
      sections: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)).min(1).describe("Identifiants domaine/section"),
    },
  },
  async ({ sections }) => texte(rendreSections(obtenirSections(r, sections))),
);

server.registerTool(
  "search_kb",
  {
    title: "Chercher un cas similaire en base de connaissances",
    description:
      "À appeler une fois le cas instruit (diagnostic posé ou demande étudiée), avec les tags vérifiés : domaine, signaux selon-cas (vpn, dns, stockage…), mots-clés libres. " +
      "Un retour vide est le cas nominal au démarrage.",
    inputSchema: {
      tags: z.array(z.string().min(1)).min(1).describe("Tags vérifiés du cas instruit"),
      limite: z.number().int().min(1).max(20).optional().describe("Nombre maximal de cas renvoyés (défaut 5)"),
    },
  },
  async ({ tags, limite }) => texte(rendreRecherche(tags, rechercher(r, tags, limite ?? 5))),
);

server.registerTool(
  "save_ticket",
  {
    title: "Clôturer et enregistrer le ticket",
    description:
      "Enregistre le ticket clôturé. Le serveur fabrique l'identifiant et le chemin ; ne fournir que du contenu. " +
      "Le symptôme initial doit être conservé tel qu'exprimé par le technicien. Les questions posées forment le journal du ticket (un fichier par ticket). " +
      "S'applique aussi aux tickets résolus à la main pendant la baseline (conclusion_humaine, resolu_par).",
    inputSchema: {
      symptome_initial: z.string().min(1).describe("Le symptôme tel qu'exprimé au départ, sans reformulation"),
      nature: z.enum(["incident", "demande"]),
      domaines_proposes: z.array(z.string()).describe("Domaines proposés par le triage, dans l'ordre"),
      domaines_valides: z.array(z.string()).describe("Domaines retenus après validation du technicien"),
      escalades: z.array(z.string()).optional().describe("Domaines vers lesquels le diagnostic a escaladé, dans l'ordre"),
      signaux: z.array(z.string()).optional().describe("Signaux discriminants retenus, vérifiés"),
      conclusion: z.string().min(1).describe("Diagnostic posé ou étude de la demande, et cause retenue"),
      conclusion_humaine: z.string().optional().describe("Baseline : conclusion du technicien avant l'outil"),
      resolu_par: z.enum(["outil", "humain", "les-deux"]).optional(),
      plan_action: z.string().optional().describe("Le plan d'action validé, tel que proposé"),
      questions: z
        .array(
          z.object({
            question: z.string().min(1),
            reponse: z.string(),
            section: z.string().optional().describe("Section de contexte que la réponse pourrait remplir"),
          }),
        )
        .optional()
        .describe("Chaque question posée au technicien et sa réponse"),
      mises_a_jour_contexte: z
        .array(z.object({ section: z.string(), contenu: z.string() }))
        .optional()
        .describe("Contenu candidat pour les sections de contexte, à destination du référent"),
      statut: z.enum(["resolu", "non-resolu", "hors-domaines-couverts", "escalade-externe"]),
      tags: z.array(z.string()).optional().describe("Tags libres en plus du domaine et de la nature, ajoutés automatiquement"),
      duree_minutes: z.number().int().min(0).optional().describe("Durée du traitement, pour la mesure"),
      reference: z.string().optional().describe("Référence du ticket dans l'outil de ticketing de l'entreprise (ex. INC-12345), telle que donnée par le technicien ; ajoutée aux tags"),
      id: z.string().optional().describe("Identifiant du brouillon en cours (renvoyé par save_progress) : le ticket final reprend cet id et le brouillon est retiré. Sans id, le serveur relie par la référence s'il trouve un brouillon."),
    },
  },
  async (entree) => {
    try {
      const t = enregistrerTicket(r, entree);
      return texte(
        `Ticket enregistré : ${t.id}\n- fichier : ${t.fichier}\n- journal : ${t.journal.fichier ? `${t.journal.fichier} (${t.journal.questions} question(s))` : "aucun (pas de question posée)"}\n- brouillon en cours : ${t.brouillon_retire ? "retiré (clôturé)" : "aucun"}\n\n` +
          `La publication en base de connaissances est une étape distincte, après validation du technicien : publish_kb(ticket_id="${t.id}").`,
      );
    } catch (e) {
      return erreur(e);
    }
  },
);

server.registerTool(
  "publish_kb",
  {
    title: "Publier un ticket en base de connaissances",
    description:
      "Promeut un ticket clôturé en entrée de la base de connaissances, après validation explicite du technicien. " +
      "Les tags du ticket sont repris, complétés par ceux fournis.",
    inputSchema: {
      ticket_id: z.string().min(1).describe("Identifiant renvoyé par save_ticket"),
      tags: z.array(z.string()).optional().describe("Tags supplémentaires validés"),
    },
  },
  async ({ ticket_id, tags }) => {
    try {
      const p = publier(r, ticket_id, tags ?? []);
      return texte(`Publié : ${p.id}\n- fichier : ${p.fichier}\n- tags : ${p.tags.join(", ")}`);
    } catch (e) {
      if (e instanceof ErreurKb) return erreur(e);
      throw e;
    }
  },
);

server.registerTool(
  "save_progress",
  {
    title: "Point d'étape : enregistrer l'avancement du ticket en cours",
    description:
      "Écrit ou met à jour le brouillon du ticket en cours (installation/en-cours/), pour pouvoir le mettre en pause, le reprendre plus tard ou le passer à un collègue. " +
      "Premier appel sans id : crée le brouillon (symptome_initial obligatoire) et renvoie l'id ; appels suivants avec id et seulement ce qui est nouveau — les listes s'ajoutent, l'étape et la prochaine étape se remplacent. " +
      "À appeler à chaque point d'étape : triage validé, cran validé, réponse obtenue, plan validé, action rapportée, et sur « je mets en pause ». Toujours noter prochaine_etape.",
    inputSchema: {
      id: z.string().optional().describe("Id du brouillon, renvoyé par le premier appel ; absent = création (ou rattachement par référence)"),
      reference: z.string().optional().describe("Référence du ticket dans l'outil de ticketing"),
      etape: z.enum(ETAPES as [string, ...string[]]).describe("Étape du flux atteinte : triage, instruction, recherche, plan, actions, cloture, ou pause"),
      symptome_initial: z.string().optional().describe("Tel qu'exprimé par le technicien — obligatoire à la création"),
      nature: z.enum(["incident", "demande"]).optional(),
      domaines_proposes: z.array(z.string()).optional(),
      domaines_valides: z.array(z.string()).optional(),
      escalades: z.array(z.string()).optional().describe("Ajoutées à la liste"),
      skill_charge: z.object({ domaines: z.array(z.string()), nature: z.enum(["incident", "demande"]) }).optional().describe("Ce que la reprise devra recharger"),
      prochaine_etape: z.string().optional().describe(`Une ligne (≤ ${LIMITES.prochaine_etape} car.) : ce qu'on fait en premier à la reprise`),
      signaux: z.array(z.string()).optional().describe(`Un fait observé qui a servi au triage, une ligne (≤ ${LIMITES.signal} car.), sans le raisonnement ni « → domaine » — ajoutés`),
      verifications: z.array(z.string()).optional().describe(`Un ACQUIS par entrée : « cran N : commande → résultat », une ligne (≤ ${LIMITES.verification} car.) qu'un repreneur peut utiliser sans relire la conversation. Le raisonnement et les fausses pistes n'y vont pas (→ notes) — ajoutés`),
      questions: z.array(z.object({ question: z.string(), reponse: z.string(), section: z.string().optional() })).optional().describe(`Une DÉCISION du technicien : question et réponse courtes (≤ ${LIMITES.question} car. chacune). La référence du ticket a son champ, elle n'est pas une question — ajoutées`),
      plan_action: z.string().optional().describe("Le plan TEL QUE PROPOSÉ au technicien, sinon vide. Seul champ long. Les éléments déjà arrêtés avant le plan sont des verifications — remplace"),
      actions: z.array(z.string()).optional().describe(`Ce que le technicien a exécuté et le résultat, une ligne (≤ ${LIMITES.action} car.) — ajoutées`),
      notes: z.array(z.string()).optional().describe(`Un PIÈGE ou une fausse piste à ne pas refaire, une ligne (≤ ${LIMITES.note} car.) — ajoutées`),
    },
  },
  async (entree) => {
    try {
      const p = sauverProgression(r, { ...entree, etape: entree.etape as (typeof ETAPES)[number] });
      const lignes = [
        `${p.cree ? "Brouillon créé" : p.lie ? "Brouillon rattaché par la référence et mis à jour" : "Brouillon mis à jour"} : ${p.id} · étape ${p.etape}`,
        `- fichier : ${p.fichier}`,
        p.passation ? `- passation enregistrée : de ${p.passation.de} à ${p.passation.a}` : "",
        `Continuer les points d'étape avec id: "${p.id}". À la clôture : save_ticket(id: "${p.id}", …).`,
      ].filter(Boolean);
      return texte(lignes.join("\n"));
    } catch (e) {
      if (e instanceof ErreurEnCours) return erreur(e);
      throw e;
    }
  },
);

server.registerTool(
  "resume_ticket",
  {
    title: "Reprendre un ticket en cours, ou lister ceux en cours",
    description:
      "Sans argument : la liste des tickets en cours (référence, id, technicien, étape, prochaine étape). " +
      "Avec un id ou une référence : le brouillon complet et la marche à suivre pour reprendre là où il en était — y compris quand un collègue l'a commencé (la passation est enregistrée au prochain save_progress).",
    inputSchema: {
      ticket: z.string().optional().describe("Id du brouillon ou référence du ticket ; absent = liste"),
    },
  },
  async ({ ticket }) => {
    if (!ticket || !ticket.trim()) return texte(rendreListe(listerBrouillons(r)));
    const b = trouverBrouillon(r, ticket);
    if (!b) {
      return erreur(new Error(`aucun ticket en cours pour « ${ticket} ». ${rendreListe(listerBrouillons(r))}`));
    }
    return texte(rendreReprise(b));
  },
);

server.registerTool(
  "update_context",
  {
    title: "Écrire une section du contexte entreprise",
    description:
      "Écrit une section du contexte entreprise (installation/contexte/<domaine>.md), une section à la fois. " +
      "N'APPELER QU'APRÈS UN OUI EXPLICITE DU TECHNICIEN sur le contenu montré : le contexte est pris pour vérité terrain par tous les diagnostics suivants. " +
      "Le serveur conserve les consignes du gabarit, pose la date de mise à jour, sauvegarde la version précédente dans contexte/historique/ et crée le fichier depuis le gabarit s'il n'existe pas.",
    inputSchema: {
      section: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/).describe("Identifiant domaine/section (ex. reseau/topologie, general/sites)"),
      contenu: z.string().min(1).describe("Le contenu de la section, au format du gabarit (tableau ou prose), sans le titre « ## » ni la ligne de date"),
    },
  },
  async ({ section, contenu }) => {
    try {
      const e = ecrireSection(r, section, contenu);
      const lignes = [
        `Section écrite : ${e.id}`,
        `- fichier : ${e.fichier}${e.fichierCree ? " (créé depuis le gabarit)" : ""}`,
        e.sectionAjoutee ? "- section ajoutée en fin de fichier (elle manquait)" : "- section remplacée",
        `- version précédente : ${e.sauvegarde ?? "aucune (fichier nouveau)"}`,
        e.derniereMiseAJour ? `- dernière mise à jour : ${e.derniereMiseAJour}` : "- section sans date de péremption",
      ];
      return texte(lignes.join("\n"));
    } catch (e) {
      if (e instanceof ErreurContexte) return erreur(e);
      throw e;
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`support-it ${version} — produit=${r.produit} installation=${r.installation}`);
}

main().catch((e) => {
  console.error("support-it : arrêt sur erreur", e);
  process.exit(1);
});

#!/usr/bin/env node
// Serveur MCP « support-it » : cinq appels, transport stdio, aucune
// intelligence. L'intelligence est dans les skills, le déterminisme ici.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lireVersion, racines } from "./config.js";
import { ErreurContexte, ecrireSection, obtenirSections, rendreSections } from "./contexte.js";
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
      "Valeurs réservées : domaines=[\"triage\"] au début de tout ticket (règles de triage + manifeste des domaines) ; domaines=[\"cloture\"] avant save_ticket. " +
      "`nature` (incident ou demande) est obligatoire pour un domaine : elle choisit skill.md ou demandes.md.",
    inputSchema: {
      domaines: z.array(z.string().min(1)).min(1).describe("Identifiants de domaine du manifeste, ou triage, ou cloture"),
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
      "Le symptôme initial doit être conservé tel qu'exprimé par le technicien. Chaque question posée devient un fichier du journal. " +
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
    },
  },
  async (entree) => {
    try {
      const t = enregistrerTicket(r, entree);
      return texte(
        `Ticket enregistré : ${t.id}\n- fichier : ${t.fichier}\n- questions journalisées : ${t.journal.length}\n\n` +
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

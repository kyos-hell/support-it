#!/usr/bin/env node
// Serveur MCP « support-it » : neuf appels, transport stdio, aucune
// intelligence. L'intelligence est dans les skills, le déterminisme ici.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lireVersion, racines } from "./config.js";
import { ErreurContexte, ecrireSection, identifiantsSections, obtenirSections, rendreSections } from "./contexte.js";
import { ErreurEnCours, LIMITES, escaladesBrouillon, etatBrouillon, lireBrouillon, listerBrouillons, rendreListe, rendreReprise, sauverProgression, trouverBrouillon } from "./encours.js";
import { ErreurKb, lireCas, publier, rechercher, rendreCas, rendreRecherche } from "./kb.js";
import { bibliotheque, identifiantsSignaux, lireManifeste } from "./manifeste.js";
import { casInstruit, noterCas, noterSection, noterSkill, nouvelleSession, oublierSection, reconstruire, vider } from "./session.js";
import { ErreurSkill, chargerSkills } from "./skills.js";
import { enregistrerTicket } from "./tickets.js";

const r = racines();
const version = lireVersion(r);

/**
 * L'état de session (décision 3) : un processus serveur par session Claude
 * Code (stdio), donc le serveur sait ce qu'il a servi. Le disque reste la
 * vérité : l'état est recopié dans le brouillon à chaque save_progress et
 * reconstruit par resume_ticket. Sans brouillon courant, aucun refus.
 */
const session = nouvelleSession();

/**
 * Les enums construits depuis le manifeste au démarrage (décision 2) : une
 * chaîne libre est rejetée par le schéma avant notre code. Un manifeste
 * modifié est vu au redémarrage — une session = un ticket, c'est acceptable.
 */
const manifeste = lireManifeste(r);
const enumOuChaine = (valeurs: string[]) => (valeurs.length ? z.enum(valeurs as [string, ...string[]]) : z.string().min(1));
const DOMAINE = enumOuChaine(manifeste.domaines.map((d) => d.id));
/** La bibliothèque de tags (décision 1) : produit ∪ client, un enum ; tags.yaml illisible ou en doublon → averti sur stderr, étage client ignoré. */
const biblio = bibliotheque(r, manifeste);
for (const a of biblio.avertissements) console.error(`support-it : ${a}`);
const TAGS_MAX = 5;
const TAGS = z.array(enumOuChaine(biblio.tous)).max(TAGS_MAX);
/** Les sections des gabarits (décision 9) : un identifiant de section qui n'existe pas n'entre nulle part. */
const SECTION = enumOuChaine(identifiantsSections(r));
const SIGNAL = z.object({
  id: enumOuChaine(identifiantsSignaux(manifeste)).describe("Identifiant du signal, tel qu'écrit au manifeste"),
  preuve: z.string().max(LIMITES.signal).describe(`L'extrait du ticket qui montre le signal (≤ ${LIMITES.signal} car.), libre`),
});

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
      "Valeurs réservées : domaines=[\"triage\"] au début de tout ticket (règles de triage + manifeste des domaines) ; domaines=[\"cloture\"] avant save_ticket (avec les tags cochables) ; domaines=[\"remplissage\"] pour remplir le contexte hors ticket (avec la file des candidats) ; domaines=[\"audit\"] hors ticket, sur « /support audit » (le rapport est calculé et écrit par le serveur). " +
      "`nature` (incident ou demande) est obligatoire pour un domaine : elle choisit skill.md ou demandes.md.",
    inputSchema: {
      domaines: z.array(z.string().min(1)).min(1).describe("Identifiants de domaine du manifeste, ou triage, cloture, remplissage, audit"),
      nature: z.enum(["incident", "demande"]).optional().describe("Nature du ticket, décidée par le triage"),
    },
  },
  async ({ domaines, nature }) => {
    try {
      // Pour `cloture` : les tags candidats sont filtrés sur les domaines validés du brouillon courant.
      const courant = session.brouillonCourant ? lireBrouillon(r, session.brouillonCourant) : null;
      const rendu = chargerSkills(r, domaines, nature, { biblio, domainesValides: courant ? [...courant.domaines_valides, ...escaladesBrouillon(courant)] : null });
      // Noté après un chargement réussi seulement : un refus ne compte pas.
      noterSkill(session, rendu.domaines);
      for (const s of rendu.sectionsServies) noterSection(session, s);
      return texte(rendu.texte);
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
  async ({ sections }) => {
    // Avec un brouillon courant, une section déjà servie (requis d'un skill,
    // ou get_context antérieur) ne repart pas : « déjà chargée », sans contenu.
    const deja = session.brouillonCourant ? sections.filter((s) => session.sectionsServies.includes(s)) : [];
    const aServir = sections.filter((s) => !deja.includes(s));
    const res = obtenirSections(r, aServir);
    for (const s of res) if (s.etat !== "inconnue") noterSection(session, s.id);
    const lignes: string[] = [];
    if (deja.length) lignes.push(`Déjà chargée(s) dans cette session, contenu non renvoyé : ${deja.map((s) => `\`${s}\``).join(", ")}. Relire la réponse qui l'a servie.`);
    if (res.length) lignes.push(rendreSections(res));
    return texte(lignes.join("\n\n"));
  },
);

server.registerTool(
  "search_kb",
  {
    title: "Chercher un cas similaire en base de connaissances",
    description:
      "À appeler une fois le cas instruit (diagnostic posé ou demande étudiée), avec les tags vérifiés : domaine, signaux selon-cas (vpn, dns, stockage…), mots-clés libres. " +
      "Renvoie une liste courte pour CHOISIR (au plus cinq cas, classés par rareté des tags communs, extraits tronqués) ; lire ensuite le cas retenu avec read_kb. Un retour vide est le cas nominal au démarrage.",
    inputSchema: {
      tags: z.array(z.string().min(1)).min(1).describe("Tags vérifiés du cas instruit"),
    },
  },
  async ({ tags }) => {
    // Avec un brouillon courant, chercher avant d'avoir instruit le cas n'a pas de sens :
    // les tags seraient ceux du symptôme, pas du diagnostic.
    if (session.brouillonCourant && !casInstruit(session.skillsCharges)) {
      return erreur(new Error("le cas n'est pas instruit : charger le skill du domaine (load_skill) et poser le diagnostic avant de chercher un cas similaire."));
    }
    const res = rechercher(r, tags);
    session.rechercheFaite = true;
    return texte(rendreRecherche(tags, res, biblio));
  },
);

server.registerTool(
  "read_kb",
  {
    title: "Lire un cas publié de la base de connaissances",
    description:
      "Renvoie, pour un cas repéré par search_kb, ce qui sert à s'en servir : la conclusion, le plan d'action, les signaux retenus (1 à 2 Ko). Pas les questions ni le ticket entier. " +
      "Seuls les cas publiés (installation/kb/) se lisent ; un ticket clôturé non publié n'est pas une solution éprouvée. À appeler après search_kb, jamais avec un identifiant deviné.",
    inputSchema: {
      ticket_id: z.string().min(1).describe("Identifiant du cas, tel que renvoyé par search_kb"),
    },
  },
  async ({ ticket_id }) => {
    // Borné par l'état de session : quand un brouillon est courant, on lit un cas
    // à l'étape recherche ou après — jamais avant d'avoir cherché.
    if (session.brouillonCourant && !session.rechercheFaite) {
      return erreur(new Error("chercher d'abord : read_kb lit un cas que search_kb a renvoyé pour ce ticket."));
    }
    try {
      const cas = lireCas(r, ticket_id);
      noterCas(session, cas.id);
      return texte(rendreCas(cas));
    } catch (e) {
      if (e instanceof ErreurKb) return erreur(e);
      throw e;
    }
  },
);

server.registerTool(
  "save_ticket",
  {
    title: "Clôturer et enregistrer le ticket",
    description:
      "Enregistre le ticket clôturé. Le serveur fabrique l'identifiant et le chemin ; ne fournir que du contenu. " +
      "Le symptôme initial doit être conservé tel qu'exprimé par le technicien. Les questions posées forment le journal du ticket (un fichier par ticket). " +
      "S'applique aussi aux tickets résolus à la main pendant la baseline (conclusion_humaine, resolu_par). " +
      "Le brouillon courant de la session est rattaché automatiquement (id facultatif) ; les escalades sont dérivées des skills chargés. Refusé si load_skill([\"cloture\"]) n'a pas été appelé dans la session.",
    inputSchema: {
      symptome_initial: z.string().min(1).describe("Le symptôme tel qu'exprimé au départ, sans reformulation"),
      nature: z.enum(["incident", "demande"]),
      domaines_proposes: z.array(DOMAINE).describe("Domaines proposés par le triage, dans l'ordre — ceux du brouillon sont pris s'il existe"),
      domaines_valides: z.array(DOMAINE).describe("Domaines retenus après validation du technicien"),
      signaux: z.array(SIGNAL).optional().describe("Signaux cochés { id, preuve } qui manquent au brouillon ; le serveur écrit la section « Signaux retenus » par libellé"),
      conclusion: z.string().min(1).describe("Diagnostic posé ou étude de la demande, et cause retenue"),
      conclusion_humaine: z.string().optional().describe("Baseline : conclusion du technicien avant l'outil"),
      resolu_par: z.enum(["outil", "humain", "les-deux"]).optional().describe("Seulement si le technicien l'a dit ; omis = null, jamais une valeur supposée"),
      plan_action: z.string().optional().describe("Le plan d'action validé, tel que proposé — obligatoire pour un ticket résolu ; celui du brouillon est pris s'il existe"),
      questions: z
        .array(
          z.object({
            question: z.string().min(1),
            reponse: z.string(),
            section: SECTION.optional().describe("Section de contexte que la réponse pourrait remplir"),
          }),
        )
        .optional()
        .describe("Chaque question posée au technicien et sa réponse"),
      mises_a_jour_contexte: z
        .array(z.object({ section: SECTION, contenu: z.string() }))
        .optional()
        .describe("Contenu candidat pour les sections de contexte, à destination du référent. Les contradictions notées en cours de ticket y sont ajoutées par le serveur"),
      statut: z.enum(["resolu", "non-resolu", "hors-domaines-couverts", "escalade-externe"]),
      tags: TAGS.optional().describe(`Au plus ${TAGS_MAX} tags COCHÉS dans la liste servie par load_skill(["cloture"]) — ceux qui distinguent ce cas. Un tag d'un autre domaine que ceux validés est refusé (les transverses passent). Nature, domaines, escalades et référence sont ajoutés automatiquement, hors plafond`),
      duree_minutes: z.number().int().min(0).optional().describe("Durée du traitement, pour la mesure — calculée par le serveur (création du brouillon → clôture) dès qu'un brouillon existe ; ne sert qu'à un ticket de baseline sans brouillon"),
      reference: z.string().optional().describe("Référence du ticket dans l'outil de ticketing de l'entreprise (ex. INC-12345), telle que donnée par le technicien ; ajoutée aux tags. Jamais inventée : sans référence, omettre"),
      id: z.string().optional().describe("Identifiant du brouillon en cours (renvoyé par save_progress) : le ticket final reprend cet id et le brouillon est retiré. Sans id, le serveur relie par la référence, sinon par le symptôme initial."),
    },
  },
  async (entree) => {
    try {
      const t = enregistrerTicket(r, entree, session, biblio);
      vider(session);
      return texte(
        `Ticket enregistré : ${t.id}\n- fichier : ${t.fichier}\n- journal : ${t.journal.fichier ? `${t.journal.fichier} (${t.journal.questions} question(s))` : "aucun (pas de question posée)"}\n- brouillon en cours : ${t.brouillon_retire ? "retiré (clôturé)" : "aucun"}\n- durée : ${t.duree.minutes === null ? "non renseignée" : `${t.duree.minutes} min`}${t.duree.calculee ? ` (calculée du brouillon à la clôture${t.duree.fournie_ignoree ? " ; la valeur fournie a été ignorée" : ""})` : ""}\n\n` +
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
      tags: TAGS.optional().describe(`Au plus ${TAGS_MAX} tags supplémentaires, cochés dans la bibliothèque, des domaines validés du ticket ou transverses`),
    },
  },
  async ({ ticket_id, tags }) => {
    try {
      const p = publier(r, ticket_id, tags ?? [], biblio);
      return texte(`Publié : ${p.id}\n- symptôme : ${p.symptome}\n- fichier : ${p.fichier}\n- tags : ${p.tags.join(", ")}`);
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
      "Premier appel sans id, DÈS LE TRIAGE VALIDÉ et avant le premier load_skill d'un domaine : crée le brouillon (symptome_initial obligatoire) et renvoie l'id ; appels suivants avec id et seulement ce qui est nouveau — les listes s'ajoutent, la prochaine étape se remplace. " +
      "À appeler à chaque point d'étape : cran validé, réponse obtenue, plan validé, action rapportée (une par appel), et sur « je mets en pause » (pause: true). Toujours noter prochaine_etape. " +
      "L'étape, les skills chargés, les sections servies et les escalades sont calculés par le serveur : ne pas les fournir.",
    inputSchema: {
      id: z.string().optional().describe("Id du brouillon, renvoyé par le premier appel ; absent = création, ou rattachement par référence, sinon par symptôme initial identique"),
      reference: z.string().optional().describe("Référence du ticket dans l'outil de ticketing, telle que donnée. Jamais inventée ; ne change plus une fois posée"),
      pause: z.boolean().optional().describe("Vrai sur « je mets en pause » du technicien — le seul mot d'étape que le serveur ne voit pas ; levé au prochain appel"),
      symptome_initial: z.string().optional().describe("Tel qu'exprimé par le technicien — obligatoire à la création"),
      nature: z.enum(["incident", "demande"]).optional(),
      domaines_proposes: z.array(DOMAINE).optional().describe("Les domaines que les signaux cochés désignent, dans l'ordre ; refusé si l'un d'eux n'a aucun signal coché (incident comme demande)"),
      domaines_valides: z.array(DOMAINE).optional().describe("Ceux que le technicien a validés. Une fois un skill de domaine chargé, ils ne se retirent plus : l'escalade s'ajoute par load_skill, pas ici"),
      prochaine_etape: z.string().optional().describe(`Une ligne (≤ ${LIMITES.prochaine_etape} car.) : ce qu'on fait en premier à la reprise`),
      signaux: z.array(SIGNAL).optional().describe("Les signaux du manifeste COCHÉS au triage, avec pour chacun l'extrait du ticket qui le montre. Un constat de diagnostic n'est pas un signal : il va dans verifications — ajoutés, dédoublonnés sur l'id"),
      verifications: z.array(z.string()).optional().describe(`Un constat vérifié par entrée — « cran N : commande → résultat », ou la lecture d'un portail ou d'un journal — une ligne (≤ ${LIMITES.verification} car.) qu'un repreneur peut utiliser sans relire la conversation. Le raisonnement et les fausses pistes n'y vont pas (→ notes) — ajoutés`),
      questions: z.array(z.object({ question: z.string(), reponse: z.string(), section: SECTION.optional() })).optional().describe(`Une DÉCISION du technicien : question et réponse courtes (≤ ${LIMITES.question} car. chacune). La référence du ticket a son champ, elle n'est pas une question — ajoutées`),
      plan_action: z.string().optional().describe("Le plan TEL QUE PROPOSÉ au technicien, sinon vide. Seul champ long. Les éléments déjà arrêtés avant le plan sont des verifications — remplace"),
      actions: z.array(z.string()).optional().describe(`Ce que le technicien a exécuté et le résultat, une ligne (≤ ${LIMITES.action} car.) — ajoutées`),
      notes: z.array(z.string()).optional().describe(`Un PIÈGE ou une fausse piste à ne pas refaire, une ligne (≤ ${LIMITES.note} car.) — ajoutées`),
      contradictions: z
        .array(z.object({ section: SECTION, constat: z.string().max(LIMITES.contradiction) }))
        .optional()
        .describe(`Quand une vérification CONTREDIT une valeur chargée du contexte : la section, et ce que le ticket a constaté (≤ ${LIMITES.contradiction} car.). Repris à la clôture comme mise à jour de contexte — ajoutées`),
    },
  },
  async (entree) => {
    try {
      // Un nouveau brouillon alors qu'un autre est courant : l'état repart de zéro pour lui.
      if (!entree.id && session.brouillonCourant) {
        const existant = entree.reference ? trouverBrouillon(r, entree.reference) : null;
        if (!existant || existant.id !== session.brouillonCourant) vider(session);
      }
      const p = sauverProgression(r, entree, session);
      session.brouillonCourant = p.id;
      const lignes = [
        `${p.cree ? "Brouillon créé" : p.lie === "reference" ? "Brouillon rattaché par la référence et mis à jour" : p.lie === "symptome" ? "Brouillon rattaché par le symptôme (même ticket, id oublié) et mis à jour" : "Brouillon mis à jour"} : ${p.id} · étape ${p.etape}`,
        `- domaines classés par les signaux cochés : ${p.classement}`,
        `- fichier : ${p.fichier}`,
        p.passation ? `- passation enregistrée : de ${p.passation.de} à ${p.passation.a}` : "",
        ...p.avertissements.map((a) => `- ATTENTION ${a}`),
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
    reconstruire(session, b.id, etatBrouillon(b));
    return texte(rendreReprise(b, manifeste));
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
      oublierSection(session, section);
      const lignes = [
        e.confirmee ? `Section confirmée, re-datée : ${e.id} (contenu identique, rien d'autre ne change)` : `Section écrite : ${e.id}`,
        `- fichier : ${e.fichier}${e.fichierCree ? " (créé depuis le gabarit)" : ""}`,
        e.confirmee ? "- contenu inchangé" : e.sectionAjoutee ? "- section ajoutée en fin de fichier (elle manquait)" : "- section remplacée",
        `- version précédente : ${e.sauvegarde ?? (e.confirmee ? "aucune (rien n'a changé, pas de copie dans historique/)" : "aucune (fichier nouveau)")}`,
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

// search_kb et publish_kb. Pas d'index sur disque : la base est l'ensemble des
// fichiers de installation/kb/, relus à chaque recherche.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { lireDocument, sections } from "./markdown.js";
import { tagsProches, type Bibliotheque } from "./manifeste.js";
import { idValide, lireTicket, verifierTags, ErreurTicket } from "./tickets.js";

export interface ResultatKb {
  id: string;
  date: string;
  /** Somme, sur les tags communs, de 1 / nombre d'entrées qui portent le tag (D2). */
  score: number;
  /** Les tags communs à la recherche seulement ; le reste est compté dans `autresTags`. */
  communs: string[];
  autresTags: number;
  nature: string;
  reference: string;
  domaines: string[];
  symptome: string;
  conclusion: string;
}

/** Plafond fixé par le serveur : la recherche sert à choisir, read_kb à lire (décision 4). */
export const RESULTATS_MAX = 5;
const EXTRAIT_MAX = 160;

function normaliser(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

function extrait(texte: string): string {
  const l = texte.split("\n").map((x) => x.trim()).find(Boolean) ?? "";
  return l.length > EXTRAIT_MAX ? l.slice(0, EXTRAIT_MAX - 1).trimEnd() + "…" : l;
}

/**
 * D2 : un tag commun vaut 1 / (nombre d'entrées de la base qui le portent).
 * `azure` sur toutes les entrées ne départage rien ; `password-writeback` sur
 * une seule vaut 1. La nature, les domaines et la référence ne sont pas
 * comptés : ils sont sur tous les tickets d'une famille.
 */
export function rechercher(r: Racines, tags: string[]): { total: number; correspondants: number; resultats: ResultatKb[]; structurels: Set<string> } {
  const c = chemins(r);
  if (!fs.existsSync(c.kb)) return { total: 0, correspondants: 0, resultats: [], structurels: new Set() };
  const voulus = normaliser(tags);
  const fichiers = fs.readdirSync(c.kb).filter((f) => f.endsWith(".md"));
  // E7 (campagne 0.3.0-beta) : deux fichiers portant le même id (copie à la
  // main) ne comptent qu'une fois — celui dont le nom est l'id, sinon le premier.
  const lus = fichiers.map((f) => ({ f, t: lireTicket(path.join(c.kb, f)) })).filter((x) => x.t.entete && Object.keys(x.t.entete).length > 0);
  const parId = new Map<string, (typeof lus)[number]>();
  for (const x of lus) {
    const deja = parId.get(x.t.id);
    if (!deja || path.basename(x.f, ".md") === x.t.id) parId.set(x.t.id, x);
  }
  const entrees = [...parId.values()].map((x) => x.t);
  const frequence = new Map<string, number>();
  const nonComptes = new Set<string>();
  for (const t of entrees) {
    nonComptes.add(String(t.entete.nature ?? ""));
    for (const d of ((t.entete.domaines_valides as string[]) ?? []).map(String)) nonComptes.add(d);
    if (t.reference) nonComptes.add(t.reference.toLowerCase());
    for (const x of normaliser(((t.entete.tags as string[]) ?? []).map(String))) frequence.set(x, (frequence.get(x) ?? 0) + 1);
  }
  const resultats: ResultatKb[] = [];
  for (const t of entrees) {
    const tagsEntree = normaliser(((t.entete.tags as string[]) ?? []).map(String));
    const communs = voulus.filter((x) => tagsEntree.includes(x));
    if (voulus.length > 0 && communs.length === 0) continue;
    const score = communs.filter((x) => !nonComptes.has(x)).reduce((acc, x) => acc + 1 / (frequence.get(x) ?? 1), 0);
    resultats.push({
      id: t.id,
      date: String(t.entete.date ?? ""),
      score: Math.round(score * 100) / 100,
      communs,
      autresTags: tagsEntree.length - communs.length,
      nature: String(t.entete.nature ?? ""),
      reference: t.reference,
      domaines: ((t.entete.domaines_valides as string[]) ?? []).map(String),
      symptome: extrait(t.symptome),
      conclusion: extrait(t.conclusion),
    });
  }
  resultats.sort((a, b) => b.score - a.score || b.communs.length - a.communs.length || b.date.localeCompare(a.date));
  return { total: entrees.length, correspondants: resultats.length, resultats: resultats.slice(0, RESULTATS_MAX), structurels: nonComptes };
}

/** Rendu compact (~300 caractères par cas) : de quoi choisir, pas de quoi s'en servir — read_kb pour ça. */
export function rendreRecherche(tags: string[], res: { total: number; correspondants: number; resultats: ResultatKb[]; structurels?: Set<string> }, biblio?: Bibliotheque): string {
  // Décision 1 : un tag inconnu de la bibliothèque est signalé avec les tags proches, pas ignoré en silence.
  // E2 (campagne 0.3.0-beta) : les tags que le serveur ajoute lui-même (nature,
  // domaines, références des cas en base) sont connus par construction.
  // EA1 (campagne sans jeu de données) : sur une base vide, aucun cas ne porte
  // ces tags — les natures et les domaines viennent donc de la bibliothèque
  // (le manifeste), pas seulement des cas déjà publiés.
  const structurels = new Set<string>([...(res.structurels ?? []), "incident", "demande", ...(biblio ? biblio.parDomaine.keys() : [])]);
  const inconnus = biblio ? normaliser(tags).filter((t) => !biblio.tous.includes(t) && !structurels.has(t)) : [];
  const avert = inconnus.length
    ? inconnus.map((t) => {
        const proches = biblio ? tagsProches(biblio, t) : [];
        return `Tag inconnu de la bibliothèque : « ${t} »${proches.length ? ` — proche de : ${proches.join(", ")}` : ""}.`;
      }).join("\n") + "\n\n"
    : "";
  return avert + rendreRecherche0(tags, res);
}

function rendreRecherche0(tags: string[], res: { total: number; correspondants: number; resultats: ResultatKb[] }): string {
  if (res.total === 0) {
    return "Base de connaissances vide : aucun cas publié pour l'instant. C'est le cas nominal au démarrage — poursuivre avec le plan d'action.";
  }
  if (res.resultats.length === 0) {
    return `Aucun cas ne partage de tag avec [${tags.join(", ")}] (${res.total} cas en base). Poursuivre avec le plan d'action.`;
  }
  const out = [`${res.resultats.length} cas sur ${res.total} en base, par rareté des tags communs (un tag que peu de cas portent pèse plus) :`, ""];
  for (const x of res.resultats) {
    out.push(`### ${x.id}${x.reference ? ` — ${x.reference}` : ""} · score ${x.score} · ${x.nature} · ${x.domaines.join(", ")}`);
    out.push(`- tags communs : ${x.communs.join(", ")}${x.autresTags ? ` (et ${x.autresTags} autre(s))` : ""}`);
    out.push(`- symptôme : ${x.symptome}`);
    out.push(`- conclusion : ${x.conclusion}`);
    out.push("");
  }
  if (res.correspondants > res.resultats.length) {
    out.push(`${res.correspondants} cas partagent ces tags, ${res.resultats.length} affichés — affiner avec des tags plus spécifiques.`, "");
  }
  out.push("Un cas similaire est une solution déjà éprouvée à confronter au diagnostic posé, pas un raccourci : vérifier que le symptôme parle du même vécu, puis lire le cas retenu avec read_kb(ticket_id) avant de reprendre sa conclusion.");
  return out.join("\n");
}

// ---- read_kb -----------------------------------------------------------------

export interface CasLu {
  id: string;
  reference: string;
  nature: string;
  domaines: string[];
  statut: string;
  symptome: string;
  conclusion: string;
  planAction: string;
  signaux: string[];
}

/**
 * Le neuvième appel (décision 4) : lire un cas **publié** pour s'en servir —
 * conclusion, plan d'action, signaux. Pas les questions (journal du
 * référent), pas le texte entier. Jamais tickets/ : un ticket non publié
 * n'est pas une solution éprouvée.
 */
export function lireCas(r: Racines, ticketId: string): CasLu {
  const c = chemins(r);
  if (!idValide(ticketId)) throw new ErreurKb(`identifiant de ticket invalide : ${ticketId}`);
  const fichier = path.join(c.kb, `${ticketId}.md`);
  if (!fs.existsSync(fichier)) {
    const enTickets = fs.existsSync(path.join(c.tickets, `${ticketId}.md`));
    throw new ErreurKb(
      enTickets
        ? `ce ticket n'est pas publié : ${ticketId} est clôturé mais pas en base de connaissances — il ne se lit pas comme une solution éprouvée.`
        : `aucun cas publié sous ${ticketId}. Les identifiants viennent de search_kb ; ne jamais en fabriquer.`,
    );
  }
  const t = lireTicket(fichier);
  const secs = sections(lireDocument(t.texte).corps);
  const get = (id: string) => secs.find((s) => s.id === id)?.contenu.trim() ?? "";
  return {
    id: t.id,
    reference: t.reference,
    nature: String(t.entete.nature ?? ""),
    domaines: ((t.entete.domaines_valides as string[]) ?? []).map(String),
    statut: String(t.entete.statut ?? ""),
    symptome: extrait(t.symptome),
    conclusion: get("conclusion"),
    planAction: get("plan-action"),
    signaux: (get("signaux") || "").split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean),
  };
}

export function rendreCas(x: CasLu): string {
  return [
    `# Cas ${x.id}${x.reference ? ` — ${x.reference}` : ""} · ${x.nature} · ${x.domaines.join(", ")}`,
    "",
    `**Symptôme :** ${x.symptome}`,
    "",
    "## Signaux retenus",
    "",
    x.signaux.length ? x.signaux.map((s) => `- ${s}`).join("\n") : "_(aucun)_",
    "",
    "## Conclusion",
    "",
    x.conclusion || "_(rien)_",
    "",
    "## Plan d'action",
    "",
    x.planAction || "_(rien)_",
    "",
    "Confronter ce cas au diagnostic posé : même vécu, même cause vérifiée ? Sinon, il ne s'applique pas.",
  ].join("\n");
}

export class ErreurKb extends Error {}

export function publier(r: Racines, ticketId: string, tagsSupp: string[] = [], biblio?: Bibliotheque): { id: string; fichier: string; tags: string[]; symptome: string } {
  assurerInstallation(r);
  const c = chemins(r);
  if (!idValide(ticketId)) throw new ErreurKb(`identifiant de ticket invalide : ${ticketId}`);
  const source = path.join(c.tickets, `${ticketId}.md`);
  if (!fs.existsSync(source)) throw new ErreurKb(`ticket introuvable : ${ticketId}. Le ticket doit être clôturé (save_ticket) avant d'être publié.`);
  const cible = path.join(c.kb, `${ticketId}.md`);
  if (fs.existsSync(cible)) throw new ErreurKb(`ticket ${ticketId} déjà publié.`);

  const t = lireTicket(source);
  // Un cas non résolu en base serait pris pour une solution éprouvée : seul `resolu` se publie.
  const statut = String(t.entete.statut ?? "");
  if (statut !== "resolu") {
    throw new ErreurKb(`ticket ${ticketId} : statut « ${statut || "inconnu"} », seul un ticket résolu se publie en base de connaissances.`);
  }
  const doc = lireDocument(t.texte);
  if (biblio) {
    try {
      verifierTags(biblio, tagsSupp, [...(((doc.entete.domaines_valides as string[]) ?? []).map(String)), ...(((doc.entete.escalades as string[]) ?? []).map(String))]);
    } catch (e) {
      if (e instanceof ErreurTicket) throw new ErreurKb(e.message);
      throw e;
    }
  }
  const tags = normaliser([...(((doc.entete.tags as string[]) ?? []).map(String)), ...tagsSupp]);
  const entete = { ...doc.entete, tags, publie: new Date().toISOString() };
  fs.writeFileSync(cible, `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n${doc.corps}`, { encoding: "utf8", flag: "wx" });
  // La réponse cite le symptôme : le modèle voit ce qu'il vient de publier, pas seulement un id.
  return { id: ticketId, fichier: cible, tags, symptome: t.symptome.split("\n")[0] };
}

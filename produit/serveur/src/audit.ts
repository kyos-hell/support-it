// L'audit (décision 8) : le serveur calcule, le skill présente, l'humain dit
// oui. Rien ici n'écrit dans une archive. Ce module commence par la file des
// candidats au remplissage (décision 9, mécanisme 2) ; le rapport complet
// vient en 2.9.
import fs from "node:fs";
import path from "node:path";
import { chemins, type Racines } from "./config.js";
import { obtenirSections } from "./contexte.js";
import { listerBrouillons } from "./encours.js";
import { lireDocument, sections } from "./markdown.js";

export interface Candidat {
  section: string;
  /** D'où vient la proposition. */
  source: "question" | "mise-a-jour" | "contradiction";
  /** Le ticket (ou brouillon) qui l'a produite. */
  ticket: string;
  date: string;
  contenu: string;
}

function normaliser(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Les sections « mises-a-jour-contexte » et « contradictions » d'un ticket : `- \`section\` : contenu`. */
function lireProposees(corps: string, id: string): { section: string; contenu: string }[] {
  const sec = sections(corps).find((s) => s.id === id);
  if (!sec) return [];
  const out: { section: string; contenu: string }[] = [];
  const blocs = sec.contenu.split(/^- (?=`)/m).filter((b) => b.trim());
  for (const b of blocs) {
    const m = b.match(/^`([a-z0-9-]+\/[a-z0-9-]+)`\s*:\s*([\s\S]*)$/);
    if (!m) continue;
    const contenu = m[2].replace(/^\s+/gm, "").trim();
    if (contenu && contenu !== "_(rien)_") out.push({ section: m[1], contenu });
  }
  return out;
}

/**
 * La file des candidats (décision 9, point 4) : ce que les tickets ont
 * proposé pour le contexte et qui n'y est pas encore.
 *
 * - une question journalisée avec section candidate, dont la section est
 *   encore vide → la réponse du technicien est le contenu candidat ;
 * - une mise à jour proposée à la clôture, jamais appliquée (le contenu
 *   n'est pas dans la section) ;
 * - une contradiction notée en ticket (brouillon ou ticket clôturé).
 *
 * Regroupés par section, la plus demandée en tête.
 */
export function candidats(r: Racines): Map<string, Candidat[]> {
  const c = chemins(r);
  const bruts: Candidat[] = [];
  const lireMd = (dossier: string) =>
    fs.existsSync(dossier) ? fs.readdirSync(dossier).filter((f) => f.endsWith(".md")).map((f) => path.join(dossier, f)) : [];

  // 1. Le journal : sections candidates des questions.
  for (const f of lireMd(c.journal)) {
    const doc = lireDocument(fs.readFileSync(f, "utf8"));
    const ticket = String(doc.entete.ticket ?? path.basename(f, ".md"));
    const date = String(doc.entete.date ?? "");
    for (const q of sections(doc.corps)) {
      const m = q.contenu.match(/Section candidate : `([a-z0-9-]+\/[a-z0-9-]+)`/);
      if (!m) continue;
      const reponse = q.contenu.match(/\*\*R \(contenu candidat\) :\*\*\s*([\s\S]*?)\n\s*\nSection candidate/)?.[1]?.trim() ?? "";
      if (reponse) bruts.push({ section: m[1], source: "question", ticket, date, contenu: reponse });
    }
  }
  // 2. Les tickets : mises à jour proposées, contradictions.
  for (const f of lireMd(c.tickets)) {
    const doc = lireDocument(fs.readFileSync(f, "utf8"));
    const ticket = String(doc.entete.id ?? path.basename(f, ".md"));
    const date = String(doc.entete.date ?? "");
    for (const p of lireProposees(doc.corps, "mises-a-jour-contexte")) {
      bruts.push({ section: p.section, source: p.contenu.startsWith("(contradiction constatée en ticket)") ? "contradiction" : "mise-a-jour", ticket, date, contenu: p.contenu });
    }
  }
  // 3. Les brouillons : contradictions en cours.
  for (const b of listerBrouillons(r)) {
    for (const x of b.contradictions) bruts.push({ section: x.section, source: "contradiction", ticket: b.id, date: b.derniere_mise_a_jour, contenu: x.constat });
  }

  // Ne garder que ce qui n'est pas déjà dans le contexte.
  const sectionsVues = [...new Set(bruts.map((x) => x.section))];
  const etats = new Map(obtenirSections(r, sectionsVues).map((s) => [s.id, s]));
  const restants = bruts.filter((x) => {
    const s = etats.get(x.section);
    if (!s) return true;
    if (x.source === "question") return s.etat !== "ok";
    if (x.source === "mise-a-jour") return s.etat !== "ok" || !normaliser(s.contenu ?? "").includes(normaliser(x.contenu).slice(0, 60));
    return true; // une contradiction reste à traiter tant qu'un humain ne l'a pas tranchée
  });
  const parSection = new Map<string, Candidat[]>();
  for (const x of restants) {
    if (!parSection.has(x.section)) parSection.set(x.section, []);
    parSection.get(x.section)!.push(x);
  }
  return new Map([...parSection.entries()].sort((a, b) => b[1].length - a[1].length));
}

export function rendreCandidats(m: Map<string, Candidat[]>): string {
  if (m.size === 0) return "Aucun candidat : rien de proposé par les tickets qui ne soit déjà dans le contexte.";
  const out = ["| Section | Source | Ticket | Contenu candidat |", "| --- | --- | --- | --- |"];
  for (const [section, liste] of m) {
    for (const x of liste) {
      out.push(`| \`${section}\` | ${x.source} | ${x.ticket} (${x.date.slice(0, 10)}) | ${x.contenu.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 200)} |`);
    }
  }
  out.push("", "Proposer un par un, la section la plus demandée en tête ; montrer le contenu en entier ; écrire sur oui seulement.");
  return out.join("\n");
}

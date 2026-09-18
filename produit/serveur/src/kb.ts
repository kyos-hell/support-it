// search_kb et publish_kb. Pas d'index sur disque : la base est l'ensemble des
// fichiers de installation/kb/, relus à chaque recherche.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { lireDocument } from "./markdown.js";
import { idValide, lireTicket } from "./tickets.js";

export interface ResultatKb {
  id: string;
  date: string;
  score: number;
  tags: string[];
  nature: string;
  reference: string;
  domaines: string[];
  symptome: string;
  conclusion: string;
}

function normaliser(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function rechercher(r: Racines, tags: string[], limite = 5): { total: number; resultats: ResultatKb[] } {
  const c = chemins(r);
  if (!fs.existsSync(c.kb)) return { total: 0, resultats: [] };
  const voulus = normaliser(tags);
  const fichiers = fs.readdirSync(c.kb).filter((f) => f.endsWith(".md"));
  const resultats: ResultatKb[] = [];
  for (const f of fichiers) {
    const t = lireTicket(path.join(c.kb, f));
    const tagsEntree = normaliser(((t.entete.tags as string[]) ?? []).map(String));
    const communs = voulus.filter((x) => tagsEntree.includes(x));
    if (voulus.length > 0 && communs.length === 0) continue;
    resultats.push({
      id: t.id,
      date: String(t.entete.date ?? ""),
      score: communs.length,
      tags: tagsEntree,
      nature: String(t.entete.nature ?? ""),
      reference: t.reference,
      domaines: ((t.entete.domaines_valides as string[]) ?? []).map(String),
      symptome: t.symptome,
      conclusion: t.conclusion,
    });
  }
  resultats.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  return { total: fichiers.length, resultats: resultats.slice(0, limite) };
}

export function rendreRecherche(tags: string[], res: { total: number; resultats: ResultatKb[] }): string {
  if (res.total === 0) {
    return "Base de connaissances vide : aucun cas publié pour l'instant. C'est le cas nominal au démarrage — poursuivre avec le plan d'action.";
  }
  if (res.resultats.length === 0) {
    return `Aucun cas ne partage de tag avec [${tags.join(", ")}] (${res.total} cas en base). Poursuivre avec le plan d'action.`;
  }
  const out = [`${res.resultats.length} cas similaire(s) sur ${res.total} en base, par nombre de tags communs :`, ""];
  for (const x of res.resultats) {
    out.push(`### ${x.id}${x.reference ? ` — ${x.reference}` : ""} · score ${x.score} · ${x.nature} · ${x.domaines.join(", ")}`);
    out.push(`- tags : ${x.tags.join(", ")}`);
    out.push(`- symptôme initial : ${x.symptome.split("\n")[0]}`);
    out.push(`- conclusion : ${x.conclusion.split("\n")[0]}`);
    out.push("");
  }
  out.push("Un cas similaire est une solution déjà éprouvée à confronter au diagnostic posé, pas un raccourci : vérifier que le symptôme parle du même vécu avant de reprendre sa conclusion.");
  return out.join("\n");
}

export class ErreurKb extends Error {}

export function publier(r: Racines, ticketId: string, tagsSupp: string[] = []): { id: string; fichier: string; tags: string[]; symptome: string } {
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
  const tags = normaliser([...(((doc.entete.tags as string[]) ?? []).map(String)), ...tagsSupp]);
  const entete = { ...doc.entete, tags, publie: new Date().toISOString() };
  fs.writeFileSync(cible, `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n${doc.corps}`, { encoding: "utf8", flag: "wx" });
  // La réponse cite le symptôme : le modèle voit ce qu'il vient de publier, pas seulement un id.
  return { id: ticketId, fichier: cible, tags, symptome: t.symptome.split("\n")[0] };
}

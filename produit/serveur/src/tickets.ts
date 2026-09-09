// save_ticket : le serveur fabrique l'identifiant, décide du chemin, écrit le
// ticket et un fichier par question posée. Le modèle ne fournit que du contenu.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { lireDocument, sections } from "./markdown.js";

export type Statut = "resolu" | "non-resolu" | "hors-domaines-couverts" | "escalade-externe";
export type ResoluPar = "outil" | "humain" | "les-deux";

export interface QuestionPosee {
  question: string;
  reponse: string;
  /** Section de contexte que la réponse pourrait remplir (« reseau/dns-dhcp »). */
  section?: string;
}

export interface MiseAJourContexte {
  section: string;
  contenu: string;
}

export interface EntreeTicket {
  symptome_initial: string;
  nature: "incident" | "demande";
  domaines_proposes: string[];
  domaines_valides: string[];
  escalades?: string[];
  signaux?: string[];
  conclusion: string;
  conclusion_humaine?: string;
  resolu_par?: ResoluPar;
  plan_action?: string;
  questions?: QuestionPosee[];
  mises_a_jour_contexte?: MiseAJourContexte[];
  statut: Statut;
  tags?: string[];
  duree_minutes?: number;
  /** Référence du ticket dans l'outil de ticketing de l'entreprise (INC-12345…). */
  reference?: string;
}

export interface TicketEcrit {
  id: string;
  fichier: string;
  journal: string[];
}

const RE_ID_TICKET = /^\d{8}-\d{6}-[a-z0-9]+-[a-z0-9]+$/;

function propre(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x";
}

function horodatage(d: Date): { compact: string; iso: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const compact = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return { compact, iso: d.toISOString() };
}

export function fabriquerId(d = new Date()): string {
  const { compact } = horodatage(d);
  return `${compact}-${propre(os.userInfo().username)}-${propre(os.hostname())}`;
}

export function tagsAutomatiques(e: EntreeTicket): string[] {
  const t = new Set<string>();
  t.add(e.nature);
  for (const d of e.domaines_valides) t.add(d);
  for (const d of e.escalades ?? []) t.add(d);
  for (const x of e.tags ?? []) t.add(x.trim().toLowerCase());
  if (e.reference) t.add(e.reference.trim().toLowerCase());
  t.delete("");
  return [...t];
}

function bloc(titre: string, id: string, contenu: string | undefined): string {
  return `## ${id} — ${titre}\n\n${(contenu ?? "").trim() || "_(rien)_"}\n`;
}

export function rendreTicket(id: string, e: EntreeTicket, date: Date): string {
  const { iso } = horodatage(date);
  const entete = {
    id,
    date: iso,
    auteur: os.userInfo().username,
    poste: os.hostname(),
    nature: e.nature,
    statut: e.statut,
    resolu_par: e.resolu_par ?? "outil",
    reference: e.reference?.trim() || null,
    duree_minutes: e.duree_minutes ?? null,
    domaines_proposes: e.domaines_proposes,
    domaines_valides: e.domaines_valides,
    escalades: e.escalades ?? [],
    signaux: e.signaux ?? [],
    tags: tagsAutomatiques(e),
    questions: (e.questions ?? []).length,
  };
  const questions = (e.questions ?? [])
    .map((q, i) => `${i + 1}. **Q :** ${q.question}\n   **R :** ${q.reponse}${q.section ? `\n   _Section candidate : \`${q.section}\`_` : ""}`)
    .join("\n");
  const maj = (e.mises_a_jour_contexte ?? [])
    .map((m) => `- \`${m.section}\` :\n\n  ${m.contenu.trim().replace(/\n/g, "\n  ")}`)
    .join("\n");
  return (
    `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n` +
    `# Ticket ${id}${e.reference?.trim() ? ` — ${e.reference.trim()}` : ""}\n\n` +
    bloc("Symptôme initial, tel qu'exprimé", "symptome-initial", e.symptome_initial) +
    "\n" +
    bloc("Signaux retenus", "signaux", (e.signaux ?? []).map((s) => `- ${s}`).join("\n")) +
    "\n" +
    bloc("Conclusion", "conclusion", e.conclusion) +
    "\n" +
    bloc("Conclusion humaine (baseline)", "conclusion-humaine", e.conclusion_humaine) +
    "\n" +
    bloc("Plan d'action", "plan-action", e.plan_action) +
    "\n" +
    bloc("Questions posées au technicien", "questions", questions) +
    "\n" +
    bloc("Mises à jour de contexte proposées (à destination du référent)", "mises-a-jour-contexte", maj)
  );
}

export function enregistrerTicket(r: Racines, e: EntreeTicket): TicketEcrit {
  assurerInstallation(r);
  const c = chemins(r);
  const date = new Date();
  let id = fabriquerId(date);
  let fichier = path.join(c.tickets, `${id}.md`);
  // Deux clôtures dans la même seconde sur le même poste : suffixe, jamais d'écrasement.
  let n = 1;
  while (fs.existsSync(fichier)) {
    id = `${fabriquerId(date)}-${++n}`;
    fichier = path.join(c.tickets, `${id}.md`);
  }
  fs.writeFileSync(fichier, rendreTicket(id, e, date), { encoding: "utf8", flag: "wx" });

  const journal: string[] = [];
  (e.questions ?? []).forEach((q, i) => {
    const f = path.join(c.journal, `${id}-q${String(i + 1).padStart(2, "0")}.md`);
    const entete = {
      ticket: id,
      date: date.toISOString(),
      nature: e.nature,
      domaines: e.domaines_valides,
      section_candidate: q.section ?? null,
    };
    fs.writeFileSync(
      f,
      `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n## question — Question posée\n\n${q.question.trim()}\n\n## reponse — Réponse du technicien (contenu candidat)\n\n${q.reponse.trim()}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    journal.push(f);
  });
  return { id, fichier, journal };
}

export interface TicketLu {
  id: string;
  reference: string;
  entete: Record<string, unknown>;
  symptome: string;
  conclusion: string;
  texte: string;
}

export function lireTicket(fichier: string): TicketLu {
  const texte = fs.readFileSync(fichier, "utf8");
  const doc = lireDocument(texte);
  const secs = sections(doc.corps);
  const get = (id: string) => secs.find((s) => s.id === id)?.contenu ?? "";
  return {
    id: String(doc.entete.id ?? path.basename(fichier, ".md")),
    reference: doc.entete.reference ? String(doc.entete.reference) : "",
    entete: doc.entete,
    symptome: get("symptome-initial"),
    conclusion: get("conclusion"),
    texte,
  };
}

export function idValide(id: string): boolean {
  return RE_ID_TICKET.test(id) || /^\d{8}-\d{6}-[a-z0-9]+-[a-z0-9]+-\d+$/.test(id);
}

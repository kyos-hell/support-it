// save_ticket : le serveur fabrique l'identifiant, décide du chemin, écrit le
// ticket et, s'il y a eu des questions, un journal par ticket. Le modèle ne
// fournit que du contenu.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { lireBrouillon, retirerBrouillon, trouverBrouillon, type QuestionPosee } from "./encours.js";
import { fabriquerId, horodatage, idValide, poste, utilisateur } from "./ids.js";
import { lireDocument, sections } from "./markdown.js";

export { idValide, fabriquerId, type QuestionPosee };

export type Statut = "resolu" | "non-resolu" | "hors-domaines-couverts" | "escalade-externe";
export type ResoluPar = "outil" | "humain" | "les-deux";

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
  /** Identifiant du brouillon en cours (save_progress) : le ticket final reprend cet id et le brouillon est retiré. */
  id?: string;
  /** Référence du ticket dans l'outil de ticketing de l'entreprise (INC-12345…). */
  reference?: string;
}

export interface TicketEcrit {
  id: string;
  fichier: string;
  /** Le journal du ticket : un seul fichier, absent s'il n'y a eu aucune question. */
  journal: { fichier: string | null; questions: number };
  brouillon_retire: boolean;
}

export class ErreurTicket extends Error {}

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
    auteur: utilisateur(),
    poste: poste(),
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
  // Lien avec un brouillon en cours : par id, sinon par référence. Le ticket
  // final reprend l'id du brouillon (continuité), et le brouillon est retiré.
  let brouillon = e.id ? lireBrouillon(r, e.id) : e.reference ? trouverBrouillon(r, e.reference) : null;
  if (e.id && !brouillon) throw new ErreurTicket(`brouillon inconnu : ${e.id}. Omettre id pour clôturer sans brouillon.`);
  let id: string;
  let fichier: string;
  if (brouillon) {
    id = brouillon.id;
    fichier = path.join(c.tickets, `${id}.md`);
    if (fs.existsSync(fichier)) throw new ErreurTicket(`ticket ${id} déjà clôturé.`);
    // Ce que le brouillon a accumulé et que la clôture n'a pas redonné n'est pas perdu.
    e = {
      ...e,
      reference: e.reference ?? brouillon.reference ?? undefined,
      signaux: fusion(e.signaux, brouillon.signaux, (x) => x.trim()),
      questions: fusion(e.questions, brouillon.questions, (q) => q.question.trim()),
      escalades: fusion(e.escalades, brouillon.escalades, (x) => x.trim()),
    };
  } else {
    id = fabriquerId(date);
    fichier = path.join(c.tickets, `${id}.md`);
    // Deux clôtures dans la même seconde sur le même poste : suffixe, jamais d'écrasement.
    let n = 1;
    while (fs.existsSync(fichier)) {
      id = `${fabriquerId(date)}-${++n}`;
      fichier = path.join(c.tickets, `${id}.md`);
    }
  }
  fs.writeFileSync(fichier, rendreTicket(id, e, date), { encoding: "utf8", flag: "wx" });
  const brouillon_retire = brouillon ? retirerBrouillon(r, brouillon.id) : false;

  const journal = ecrireJournal(r, id, e, date);
  return { id, fichier, journal, brouillon_retire };
}

/**
 * Journal des questions : un fichier par ticket, `journal/<id>.md`, écrit une
 * fois à la clôture. L'en-tête porte les sections candidates pour que le
 * référent filtre sans ouvrir les fichiers ; le corps, une section par
 * question. Aucun fichier s'il n'y a pas eu de question (décision du
 * 2026-09-11 : un fichier par question éclatait le journal en dizaines de
 * fichiers redondants avec la section `questions` du ticket).
 */
function ecrireJournal(r: Racines, id: string, e: EntreeTicket, date: Date): { fichier: string | null; questions: number } {
  const c = chemins(r);
  const questions = e.questions ?? [];
  if (questions.length === 0) return { fichier: null, questions: 0 };
  const candidates = [...new Set(questions.map((q) => q.section).filter((s): s is string => Boolean(s)))];
  const entete = {
    ticket: id,
    date: date.toISOString(),
    reference: e.reference ?? null,
    nature: e.nature,
    domaines: e.domaines_valides,
    questions: questions.length,
    sections_candidates: candidates,
  };
  const corps = questions
    .map((q, i) => {
      const n = String(i + 1).padStart(2, "0");
      return (
        `## q${n} — Question ${i + 1}\n\n` +
        `**Q :** ${q.question.trim()}\n\n` +
        `**R (contenu candidat) :** ${q.reponse.trim()}\n\n` +
        `Section candidate : ${q.section ? `\`${q.section}\`` : "aucune"}\n`
      );
    })
    .join("\n");
  const f = path.join(c.journal, `${id}.md`);
  fs.writeFileSync(
    f,
    `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n# Journal du ticket ${id}${e.reference ? ` — ${e.reference}` : ""}\n\n${corps}`,
    { encoding: "utf8", flag: "wx" },
  );
  return { fichier: f, questions: questions.length };
}

function fusion<T>(donnes: T[] | undefined, existants: T[], cle: (x: T) => string): T[] {
  const out = [...(donnes ?? [])];
  const vus = new Set(out.map(cle));
  for (const x of existants) {
    const k = cle(x);
    if (k && !vus.has(k)) {
      vus.add(k);
      out.push(x);
    }
  }
  return out;
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


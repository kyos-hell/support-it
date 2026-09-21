// save_ticket : le serveur fabrique l'identifiant, décide du chemin, écrit le
// ticket et, s'il y a eu des questions, un journal par ticket. Le modèle ne
// fournit que du contenu.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { ErreurEnCours, escaladesBrouillon, etatBrouillon, lireBrouillon, lireSignaux, rendreSignal, retirerBrouillon, trouverBrouillon, trouverParSymptome, verifierDomaines, verifierReference, type Brouillon, type Contradiction, type QuestionPosee, type SignalCoche } from "./encours.js";
import { fabriquerId, horodatage, idValide, normaliserCle, poste, utilisateur } from "./ids.js";
import { domaineDuTag, lireManifeste, tagsCandidats, type Bibliotheque } from "./manifeste.js";
import { lireDocument, sections } from "./markdown.js";
import { casInstruit, escaladesDerivees, fusionnerEtat, skillCharge, type Session } from "./session.js";

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
  /** Jamais fournis par le modèle : dérivés des skills chargés et des cas lus (brouillon ∪ session). */
  escalades?: string[];
  cas_lus?: string[];
  /** Décision 10 : recopié du brouillon — actions ajoutées par appel. */
  actions_par_appel?: number[];
  /** Cochés : { id, preuve }. Le serveur écrit la section « Signaux retenus » par libellé. */
  signaux?: SignalCoche[];
  conclusion: string;
  conclusion_humaine?: string;
  resolu_par?: ResoluPar;
  plan_action?: string;
  questions?: QuestionPosee[];
  mises_a_jour_contexte?: MiseAJourContexte[];
  /** Reprises du brouillon par le serveur (décision 9) ; ajoutées aux mises à jour de contexte. */
  contradictions?: Contradiction[];
  statut: Statut;
  tags?: string[];
  duree_minutes?: number;
  /** O8 : création → clôture, en temps calendaire (pauses comprises) — écrite par le serveur à côté de la durée active. */
  duree_calendaire_minutes?: number;
  /** Identifiant du brouillon en cours (save_progress) : le ticket final reprend cet id et le brouillon est retiré. */
  id?: string;
  /** Référence du ticket dans l'outil de ticketing de l'entreprise (INC-12345…). */
  reference?: string;
}

export interface TicketEcrit {
  id: string;
  fichier: string;
  /** O9 (campagne 0.3.0-beta) : la durée retenue, et si la valeur fournie a été ignorée. O8 : active (points d'étape) et calendaire. */
  duree: { minutes: number | null; calculee: boolean; fournie_ignoree: boolean; calendaire: number | null; active: boolean };
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

export function rendreTicket(id: string, e: EntreeTicket, date: Date, r?: Racines): string {
  const { iso } = horodatage(date);
  const m = r ? lireManifeste(r) : null;
  const entete = {
    id,
    date: iso,
    auteur: utilisateur(),
    poste: poste(),
    nature: e.nature,
    statut: e.statut,
    // Jamais une valeur que personne n'a dite : `null` si omis, pas « outil ».
    resolu_par: e.resolu_par ?? null,
    reference: e.reference?.trim() || null,
    duree_minutes: e.duree_minutes ?? null,
    duree_calendaire_minutes: e.duree_calendaire_minutes ?? null,
    domaines_proposes: e.domaines_proposes,
    domaines_valides: e.domaines_valides,
    escalades: e.escalades ?? [],
    cas_lus: e.cas_lus ?? [],
    contradictions: e.contradictions ?? [],
    actions_par_appel: e.actions_par_appel ?? [],
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
  const contradictions = (e.contradictions ?? []).map((x) => `- \`${x.section}\` : ${x.constat}`).join("\n");
  return (
    `---\n${YAML.stringify(entete).trimEnd()}\n---\n\n` +
    `# Ticket ${id}${e.reference?.trim() ? ` — ${e.reference.trim()}` : ""}\n\n` +
    bloc("Symptôme initial, tel qu'exprimé", "symptome-initial", e.symptome_initial) +
    "\n" +
    bloc("Signaux retenus", "signaux", (e.signaux ?? []).map((s) => `- ${rendreSignal(m, s)}`).join("\n")) +
    "\n" +
    bloc("Conclusion", "conclusion", e.conclusion) +
    "\n" +
    bloc("Conclusion humaine (baseline)", "conclusion-humaine", e.conclusion_humaine) +
    "\n" +
    bloc("Plan d'action", "plan-action", e.plan_action) +
    "\n" +
    bloc("Questions posées au technicien", "questions", questions) +
    "\n" +
    bloc("Mises à jour de contexte proposées (à destination du référent)", "mises-a-jour-contexte", maj) +
    "\n" +
    bloc("Contexte contredit par le terrain (à corriger, sur oui)", "contradictions", contradictions)
  );
}

/**
 * `session` : l'état de la session serveur (décision 3). Quand un brouillon
 * est courant, la clôture s'y rattache sans id, refuse un autre id, et
 * refuse si `cloture` n'a pas été chargé dans la session. Les escalades
 * sont dérivées des skills chargés, jamais fournies par le modèle.
 */
/**
 * Décision 1 : un tag coché doit être d'un domaine validé du ticket (ou d'une
 * escalade), ou transverse. Le refus renvoie la liste filtrée — c'est là que
 * le modèle la voit s'il ne l'a pas lue dans `cloture`.
 */
export function verifierTags(b: Bibliotheque, tags: string[] | undefined, domaines: string[]): void {
  if (!tags?.length) return;
  const permis = tagsCandidats(b, domaines);
  const horsDomaine = tags.filter((t) => !permis.includes(t));
  if (horsDomaine.length) {
    const ou = horsDomaine.map((t) => `${t} (${domaineDuTag(b, t) ?? "inconnu"})`).join(", ");
    throw new ErreurTicket(
      `tags hors des domaines validés (${domaines.join(", ") || "aucun"}) : ${ou}. Cocher parmi : ${permis.join(", ") || "(aucun tag pour ces domaines)"}.`,
    );
  }
}

export function enregistrerTicket(r: Racines, e: EntreeTicket, session?: Session, biblio?: Bibliotheque): TicketEcrit {
  assurerInstallation(r);
  const c = chemins(r);
  const date = new Date();
  let ref: string;
  try {
    ref = verifierReference(e.reference);
    e = {
      ...e,
      reference: ref || undefined,
      domaines_proposes: verifierDomaines(r, "domaines_proposes", e.domaines_proposes) ?? [],
      domaines_valides: verifierDomaines(r, "domaines_valides", e.domaines_valides) ?? [],
      escalades: undefined,
    };
  } catch (err) {
    if (err instanceof ErreurEnCours) throw new ErreurTicket(err.message);
    throw err;
  }
  const courant = session?.brouillonCourant ?? null;
  if (courant) {
    if (e.id && e.id !== courant) {
      throw new ErreurTicket(
        `le brouillon courant de cette session est ${courant}, la clôture vise ${e.id} : un autre ticket est en cours. resume_ticket("${e.id}") pour basculer, ou omettre id.`,
      );
    }
    if (!skillCharge(session!.skillsCharges, "cloture")) {
      throw new ErreurTicket('charger `cloture` d\'abord : load_skill(["cloture"]) — ses consignes n\'ont pas été lues dans cette session.');
    }
    // E15 (campagne 0.3.0-beta) : une baseline se déroule comme un ticket normal ;
    // « résolu » sans aucun skill de domaine chargé est un flux court-circuité.
    const brouillonCourant = lireBrouillon(r, courant);
    const instruits = brouillonCourant ? fusionnerEtat(etatBrouillon(brouillonCourant), session!).skills_charges : session!.skillsCharges;
    if (e.statut === "resolu" && !casInstruit(instruits)) {
      throw new ErreurTicket(
        "un ticket résolu s'instruit : charger le skill du domaine (load_skill) avant de clôturer, baseline comprise — la différence d'une baseline est à la clôture (conclusion_humaine, resolu_par), pas dans le flux.",
      );
    }
  }
  // Lien avec un brouillon en cours : le courant de la session, sinon par id,
  // sinon par référence, sinon par le symptôme (A5). Le ticket final reprend
  // l'id du brouillon (continuité), et le brouillon est retiré.
  let brouillon: Brouillon | null = courant ? lireBrouillon(r, courant) : e.id ? lireBrouillon(r, e.id) : ref ? trouverBrouillon(r, ref) : null;
  if (e.id && !brouillon) throw new ErreurTicket(`brouillon inconnu : ${e.id}. Omettre id pour clôturer sans brouillon.`);
  if (!brouillon && !e.id) brouillon = trouverParSymptome(r, e.symptome_initial);
  let id: string;
  let fournie: number | undefined;
  let fichier: string;
  if (brouillon) {
    id = brouillon.id;
    fichier = path.join(c.tickets, `${id}.md`);
    if (fs.existsSync(fichier)) {
      // A8 : un brouillon dont le ticket existe est un zombie — on le retire, on ne le liste plus.
      retirerBrouillon(r, id);
      throw new ErreurTicket(`ticket ${id} déjà clôturé ; le brouillon resté en en-cours/ a été retiré.`);
    }
    // A4 : le brouillon a une référence, la clôture n'en donne pas une autre.
    if (ref && brouillon.reference && brouillon.reference.toLowerCase() !== ref.toLowerCase()) {
      throw new ErreurTicket(
        `le brouillon ${id} porte la référence « ${brouillon.reference} », la clôture donne « ${ref} » : mauvais id ? Un ticket = une référence.`,
      );
    }
    fournie = e.duree_minutes;
    // A1 et complément : le brouillon est la source. Le symptôme, les domaines
    // proposés, le plan et les questions viennent de lui ; ceux de la clôture
    // ne servent que là où le brouillon n'a rien. Les listes s'ajoutent.
    e = {
      ...e,
      reference: brouillon.reference ?? e.reference,
      symptome_initial: brouillon.symptome_initial || e.symptome_initial,
      domaines_proposes: brouillon.domaines_proposes.length ? brouillon.domaines_proposes : e.domaines_proposes,
      // E5 (campagne 0.3.0-beta) : les domaines validés aussi viennent du brouillon
      // (union avec ceux de la clôture, jamais de retrait) — sauf un statut
      // hors-domaines-couverts, où la clôture peut n'en valider aucun.
      domaines_valides:
        e.statut === "hors-domaines-couverts"
          ? e.domaines_valides
          : [...brouillon.domaines_valides, ...e.domaines_valides.filter((d) => !brouillon.domaines_valides.includes(d))],
      plan_action: brouillon.plan_action || e.plan_action,
      signaux: fusion(brouillon.signaux, lireSignaux(e.signaux), (x) => x.id || x.preuve),
      questions: fusion(brouillon.questions, e.questions ?? [], (q) => q.question),
      // Ce que la session a vu depuis le dernier save_progress compte aussi.
      escalades: session ? escaladesDerivees(fusionnerEtat(etatBrouillon(brouillon), session).skills_charges) : escaladesBrouillon(brouillon),
      cas_lus: session ? fusionnerEtat(etatBrouillon(brouillon), session).cas_lus : brouillon.cas_lus,
      // La durée est celle du brouillon, pas une estimation. O8 : active
      // (points d'étape, écarts plafonnés) quand le brouillon en a, sinon
      // calendaire (création → clôture) ; la calendaire est toujours écrite à côté.
      duree_minutes: dureeActiveMinutes(brouillon.points_etape, date) ?? dureeMinutes(brouillon.cree, date) ?? e.duree_minutes,
      duree_calendaire_minutes: dureeMinutes(brouillon.cree, date),
      // Décision 9 : les contradictions notées en cours de ticket sont reprises, et deviennent
      // des mises à jour de contexte proposées — sans compter sur la mémoire du modèle.
      contradictions: brouillon.contradictions,
      actions_par_appel: brouillon.actions_par_appel,
      mises_a_jour_contexte: [
        ...(e.mises_a_jour_contexte ?? []),
        ...brouillon.contradictions
          .filter((x) => !(e.mises_a_jour_contexte ?? []).some((m) => m.section === x.section))
          .map((x) => ({ section: x.section, contenu: `(contradiction constatée en ticket) ${x.constat}` })),
      ],
    };
  } else {
    e = { ...e, escalades: session ? escaladesDerivees(session.skillsCharges) : [], cas_lus: session ? [...session.casLus] : [] };
    id = fabriquerId(date);
    fichier = path.join(c.tickets, `${id}.md`);
    // Deux clôtures dans la même seconde sur le même poste : suffixe, jamais d'écrasement.
    let n = 1;
    while (fs.existsSync(fichier)) {
      id = `${fabriquerId(date)}-${++n}`;
      fichier = path.join(c.tickets, `${id}.md`);
    }
  }
  if (biblio) verifierTags(biblio, e.tags, [...e.domaines_valides, ...(e.escalades ?? [])]);
  if (e.statut === "resolu" && !(e.plan_action ?? "").trim()) {
    throw new ErreurTicket("un ticket résolu a un plan d'action : celui qui a été validé et exécuté (plan_action), tel que proposé.");
  }
  fs.writeFileSync(fichier, rendreTicket(id, { ...e, signaux: lireSignaux(e.signaux) }, date, r), { encoding: "utf8", flag: "wx" });
  const brouillon_retire = brouillon ? retirerBrouillon(r, brouillon.id) : false;

  const journal = ecrireJournal(r, id, e, date);
  const duree = {
    minutes: e.duree_minutes ?? null,
    calculee: Boolean(brouillon),
    fournie_ignoree: Boolean(brouillon) && fournie !== undefined && fournie !== e.duree_minutes,
    calendaire: e.duree_calendaire_minutes ?? null,
    active: Boolean(brouillon && brouillon.points_etape.length),
  };
  return { id, fichier, journal, brouillon_retire, duree };
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

/** La source d'abord, puis ce qui manque — à la clé normalisée près (A2). */
function fusion<T>(source: T[], ajouts: T[], cle: (x: T) => string): T[] {
  const out = [...source];
  const vus = new Set(out.map((x) => normaliserCle(cle(x))));
  for (const x of ajouts) {
    const k = normaliserCle(cle(x));
    if (k && !vus.has(k)) {
      vus.add(k);
      out.push(x);
    }
  }
  return out;
}

/** Minutes entières entre la création du brouillon et la clôture ; `undefined` si la date est illisible. */
function dureeMinutes(creeIso: string, cloture: Date): number | undefined {
  const t = Date.parse(creeIso);
  if (Number.isNaN(t)) return undefined;
  return Math.max(0, Math.round((cloture.getTime() - t) / 60000));
}

/** O8 : au-delà de cet écart entre deux points d'étape, le technicien faisait autre chose (pause, nuit) — l'écart compte pour ce plafond. */
export const ECART_ACTIF_MAX_MINUTES = 30;

/**
 * O8 (campagne 0.3.0-beta) : durée **active**, somme des écarts entre points
 * d'étape consécutifs (création → … → clôture), chacun plafonné à
 * ECART_ACTIF_MAX_MINUTES. Une pause de 18 min ou une nuit de session perdue
 * ne comptent plus qu'une demi-heure. `undefined` sans points lisibles
 * (brouillon antérieur) : la calendaire sert alors.
 */
export function dureeActiveMinutes(points: string[], cloture: Date): number | undefined {
  const t = points.map((p) => Date.parse(p)).filter((x) => !Number.isNaN(x));
  if (!t.length) return undefined;
  t.sort((a, b) => a - b);
  t.push(cloture.getTime());
  let ms = 0;
  for (let i = 1; i < t.length; i++) ms += Math.min(Math.max(0, t[i] - t[i - 1]), ECART_ACTIF_MAX_MINUTES * 60000);
  return Math.round(ms / 60000);
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


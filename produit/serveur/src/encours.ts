// save_progress et resume_ticket : le brouillon d'un ticket en cours, un
// fichier par ticket dans installation/en-cours/, réécrit à chaque point
// d'étape (fusion : les listes s'ajoutent, les scalaires se remplacent).
// Source de vérité : l'en-tête YAML ; le corps markdown en est dérivé.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { fabriquerId, idValide, normaliserCle, poste, utilisateur } from "./ids.js";
import { classerDomaines, domainesInconnus, libelleSignal, lireManifeste, type Manifeste } from "./manifeste.js";
import { lireDocument } from "./markdown.js";
import { casInstruit, domainesInstruits, escaladesDerivees, etatDepuisSession, fusionnerEtat, type EtatBrouillon, type Session } from "./session.js";

/**
 * L'étape est calculée par le serveur depuis ce qu'il a vu passer (décision
 * 3, point 5) ; seule « pause » est un mot du technicien. Elle ne peut plus
 * contredire le contenu du brouillon.
 */
export type Etape = "triage" | "instruction" | "recherche" | "plan" | "actions" | "pause";
export const ETAPES: Etape[] = ["triage", "instruction", "recherche", "plan", "actions", "pause"];

/**
 * Un signal coché (décision 2) : l'identifiant du manifeste, et la preuve —
 * l'extrait du ticket qui le montre. La preuve est du diagnostic ; l'id est
 * de la mécanique, vérifié par le schéma.
 */
export interface SignalCoche {
  id: string;
  preuve: string;
}

/** Les brouillons et tickets antérieurs à 2.6 portent des chaînes libres : lues telles quelles, jamais migrées. */
export function lireSignaux(bruts: unknown): SignalCoche[] {
  if (!Array.isArray(bruts)) return [];
  return bruts
    .map((x) => (typeof x === "string" ? { id: "", preuve: x } : { id: String((x as SignalCoche)?.id ?? ""), preuve: String((x as SignalCoche)?.preuve ?? "") }))
    .filter((x) => x.id || x.preuve);
}

/** Rendu d'un signal : « libellé — preuve » ; un signal libre (ancien format) tel quel. */
export function rendreSignal(m: Manifeste | null, s: SignalCoche): string {
  if (!s.id) return s.preuve;
  const libelle = m ? libelleSignal(m, s.id) : s.id;
  return `${libelle} (\`${s.id}\`)${s.preuve ? ` — ${s.preuve}` : ""}`;
}

/**
 * Une contradiction (décision 9) : une vérification du ticket contredit une
 * valeur chargée du contexte. Le modèle la note quand il la constate ; la
 * clôture la reprend dans les mises à jour de contexte sans compter sur sa
 * mémoire. `section` est un enum des sections des gabarits.
 */
export interface Contradiction {
  section: string;
  constat: string;
}

export interface QuestionPosee {
  question: string;
  reponse: string;
  /** Section de contexte que la réponse pourrait remplir (« reseau/dns-dhcp »). */
  section?: string;
}

export interface SkillCharge {
  domaines: string[];
  nature: "incident" | "demande";
}

export interface Passation {
  de: string;
  a: string;
  date: string;
}

export interface Brouillon {
  id: string;
  reference: string | null;
  cree: string;
  derniere_mise_a_jour: string;
  technicien: string;
  poste: string;
  /** Calculée à l'écriture (calculerEtape) ; stockée pour la liste et le CLI. */
  etape: Etape;
  pause: boolean;
  nature: "incident" | "demande" | null;
  domaines_proposes: string[];
  domaines_valides: string[];
  /** Dérivées de skills_charges depuis 2.4 ; lues telles quelles sur les brouillons antérieurs. */
  escalades: string[];
  /** Antérieur à 2.4, gardé en lecture : c'est domaines_valides + nature. */
  skill_charge: SkillCharge | null;
  /** État de session recopié par le serveur (session.ts) — jamais fourni par le modèle. */
  skills_charges: string[];
  sections_servies: string[];
  cas_lus: string[];
  recherche_faite: boolean;
  /** Décision 10 : nombre d'actions ajoutées par chaque save_progress qui en a ajouté — écrit par le serveur. Plus d'une = un indice. */
  actions_par_appel: number[];
  /** O8 (campagne 0.3.0-beta) : l'horodatage de chaque point d'étape, création comprise — écrit par le serveur. Sert à la durée active (pauses et nuits exclues). */
  points_etape: string[];
  passations: Passation[];
  symptome_initial: string;
  prochaine_etape: string;
  signaux: SignalCoche[];
  verifications: string[];
  questions: QuestionPosee[];
  plan_action: string;
  actions: string[];
  notes: string[];
  contradictions: Contradiction[];
}

export interface EntreeProgression {
  id?: string;
  reference?: string;
  /** Le seul mot d'étape que le serveur ne peut pas voir : « je mets en pause ». Levé au save_progress suivant. */
  pause?: boolean;
  symptome_initial?: string;
  nature?: "incident" | "demande";
  domaines_proposes?: string[];
  domaines_valides?: string[];
  prochaine_etape?: string;
  signaux?: SignalCoche[];
  verifications?: string[];
  questions?: QuestionPosee[];
  plan_action?: string;
  actions?: string[];
  notes?: string[];
  contradictions?: Contradiction[];
}

export interface ProgressionEcrite {
  id: string;
  fichier: string;
  cree: boolean;
  /** Si l'appel sans id a été rattaché à un brouillon existant : par quoi (A5 : le symptôme). */
  lie: "reference" | "symptome" | null;
  passation: Passation | null;
  etape: Etape;
  /** Décision 2, point 7 : les domaines classés depuis les signaux cochés. */
  classement: string;
  /** Ce que le serveur a corrigé ou ignoré dans l'appel (E5, E11 de la campagne 0.3.0-beta), une ligne chacun. */
  avertissements: string[];
}

export class ErreurEnCours extends Error {}

const MINUTES_REPRISE_PRUDENTE = 10;
export const JOURS_BROUILLON_ANCIEN = 30;
/** Plafond de la liste rendue au triage (B1) ; `resume_ticket()` rend tout. */
export const BROUILLONS_LISTES_MAX = 10;

/**
 * Une référence fabriquée par le modèle n'est pas une référence (A6) : le
 * technicien en donne une, ou dit « pas de référence », et le champ reste vide.
 */
const RE_REFERENCE_FABRIQUEE = /^(sans[-_ ]?ref|aucune?|n\/?a|none|null|inconnue?|pas[-_ ]de[-_ ]ref)/i;

export function verifierReference(reference: string | undefined): string {
  const ref = (reference ?? "").trim();
  if (!ref) return "";
  if (RE_REFERENCE_FABRIQUEE.test(ref)) {
    throw new ErreurEnCours(
      `référence « ${ref} » : une référence ne s'invente pas. Si le technicien n'en a pas donné, omettre le champ — « pas de référence » est un état valide.`,
    );
  }
  return ref;
}

/** A4 : un brouillon qui a une référence ne la change pas (variante de casse exceptée). */
function verifierReferenceStable(b: Brouillon, ref: string): void {
  if (ref && b.reference && b.reference.toLowerCase() !== ref.toLowerCase()) {
    throw new ErreurEnCours(
      `le brouillon ${b.id} porte déjà la référence « ${b.reference} », on donne « ${ref} » : mauvais id ? Un ticket = une référence ; resume_ticket() liste ceux en cours.`,
    );
  }
}

/** A3 : les domaines sont ceux du manifeste, en minuscules et sans espaces. */
export function verifierDomaines(r: Racines, champ: string, liste: string[] | undefined): string[] | undefined {
  if (!liste) return undefined;
  const propres = [...new Set(liste.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  const inconnus = domainesInconnus(lireManifeste(r), propres);
  if (inconnus.length) {
    throw new ErreurEnCours(
      `${champ} : domaine(s) inconnu(s) du manifeste : ${inconnus.join(", ")}. Domaines : ${lireManifeste(r).domaines.map((d) => d.id).join(", ")}.`,
    );
  }
  return propres;
}

function fichierBrouillon(r: Racines, id: string): string {
  return path.join(chemins(r).enCours, `${id}.md`);
}

function lireFichier(fichier: string): Brouillon | null {
  if (!fs.existsSync(fichier)) return null;
  const doc = lireDocument(fs.readFileSync(fichier, "utf8"));
  const e = doc.entete as Partial<Brouillon>;
  if (!e.id || typeof e.id !== "string") return null;
  return {
    id: e.id,
    reference: e.reference ?? null,
    cree: String(e.cree ?? ""),
    derniere_mise_a_jour: String(e.derniere_mise_a_jour ?? ""),
    technicien: String(e.technicien ?? ""),
    poste: String(e.poste ?? ""),
    etape: (ETAPES.includes(e.etape as Etape) ? e.etape : "triage") as Etape,
    pause: Boolean(e.pause ?? e.etape === "pause"),
    nature: e.nature ?? null,
    domaines_proposes: e.domaines_proposes ?? [],
    domaines_valides: e.domaines_valides ?? [],
    escalades: e.escalades ?? [],
    skill_charge: e.skill_charge ?? null,
    skills_charges: e.skills_charges ?? [],
    sections_servies: e.sections_servies ?? [],
    cas_lus: e.cas_lus ?? [],
    recherche_faite: Boolean(e.recherche_faite),
    actions_par_appel: Array.isArray(e.actions_par_appel) ? (e.actions_par_appel as number[]).map(Number) : [],
    // Brouillon antérieur à O8 : pas de points ; la clôture retombe sur la durée calendaire.
    points_etape: Array.isArray(e.points_etape) ? (e.points_etape as unknown[]).map(String) : [],
    passations: e.passations ?? [],
    symptome_initial: String(e.symptome_initial ?? ""),
    prochaine_etape: String(e.prochaine_etape ?? ""),
    signaux: lireSignaux(e.signaux),
    verifications: e.verifications ?? [],
    questions: e.questions ?? [],
    plan_action: String(e.plan_action ?? ""),
    actions: e.actions ?? [],
    notes: e.notes ?? [],
    contradictions: Array.isArray(e.contradictions) ? (e.contradictions as Contradiction[]).filter((x) => x && x.section) : [],
  };
}

export function lireBrouillon(r: Racines, id: string): Brouillon | null {
  if (!idValide(id)) return null;
  return lireFichier(fichierBrouillon(r, id));
}

export interface EnCours {
  /** Les brouillons vivants, du plus récent au plus ancien. */
  actifs: Brouillon[];
  /** A8 : brouillons dont le ticket est déjà clôturé (fichier dans tickets/). Ignorés partout, signalés par `etat` et l'audit. */
  zombies: Brouillon[];
  /** Fichiers de en-cours/ sans en-tête `id` lisible : ignorés, signalés. */
  orphelins: string[];
}

export function lireEnCours(r: Racines): EnCours {
  const c = chemins(r);
  const out: EnCours = { actifs: [], zombies: [], orphelins: [] };
  if (!fs.existsSync(c.enCours)) return out;
  for (const f of fs.readdirSync(c.enCours).filter((x) => x.endsWith(".md"))) {
    const b = lireFichier(path.join(c.enCours, f));
    if (!b) out.orphelins.push(path.join(c.enCours, f));
    else if (fs.existsSync(path.join(c.tickets, `${b.id}.md`))) out.zombies.push(b);
    else out.actifs.push(b);
  }
  out.actifs.sort((a, b) => b.derniere_mise_a_jour.localeCompare(a.derniere_mise_a_jour));
  return out;
}

export function listerBrouillons(r: Racines): Brouillon[] {
  return lireEnCours(r).actifs;
}

/** Par identifiant, sinon par référence (insensible à la casse ; le plus récent si plusieurs). */
export function trouverBrouillon(r: Racines, idOuReference: string): Brouillon | null {
  const cle = idOuReference.trim();
  const direct = lireBrouillon(r, cle);
  if (direct) return direct;
  const ref = cle.toLowerCase();
  return listerBrouillons(r).find((b) => (b.reference ?? "").toLowerCase() === ref) ?? null;
}

/** A5 : un brouillon actif qui porte le même symptôme initial, à la normalisation près. */
export function trouverParSymptome(r: Racines, symptome: string): Brouillon | null {
  const cle = normaliserCle(symptome);
  if (!cle) return null;
  return listerBrouillons(r).find((b) => normaliserCle(b.symptome_initial) === cle) ?? null;
}

function ajouter<T>(existants: T[], nouveaux: T[] | undefined, cle: (x: T) => string): T[] {
  if (!nouveaux) return existants;
  const vus = new Set(existants.map((x) => normaliserCle(cle(x))));
  const out = [...existants];
  for (const n of nouveaux) {
    const k = normaliserCle(cle(n));
    if (!k || vus.has(k)) continue;
    vus.add(k);
    out.push(n);
  }
  return out;
}

const texte = (s: string) => s.trim();

/** « EX-2107 : le wifi coupe » → « le wifi coupe » quand la référence est celle du brouillon (E11). */
export function sansPrefixeReference(symptome: string, reference: string): string {
  const ref = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return symptome.replace(new RegExp(`^\\s*${ref}\\s*[:—–-]\\s*`, "i"), "").trim() || symptome;
}

/**
 * Taxonomie du brouillon : un champ, une nature, une longueur. Une entrée est
 * une ligne qu'un repreneur peut utiliser sans relire la conversation ; le
 * raisonnement qui y a mené n'y a pas sa place. Le plan et le symptôme sont
 * les seuls champs libres. Refus explicite au-delà : une contrainte vaut
 * mieux qu'une description (format-skill §1).
 */
export const LIMITES = {
  signal: 160,
  verification: 240,
  question: 300,
  reponse: 300,
  action: 240,
  note: 240,
  prochaine_etape: 200,
  contradiction: 240,
} as const;

function verifierLongueurs(e: EntreeProgression): void {
  const trop: string[] = [];
  const check = (nom: string, regle: string, valeurs: (string | undefined)[] | undefined, max: number) => {
    for (const v of valeurs ?? []) {
      if (v && v.trim().length > max) trop.push(`${nom} (${v.trim().length} > ${max}) : ${regle} — « ${v.trim().slice(0, 60)}… »`);
    }
  };
  check("signaux.preuve", "l'extrait du ticket qui montre le signal, une ligne", e.signaux?.map((s) => s.preuve), LIMITES.signal);
  check("verifications", "un acquis : « cran N : commande → résultat », une ligne — le raisonnement et les fausses pistes vont dans notes", e.verifications, LIMITES.verification);
  check("actions", "ce que le technicien a exécuté et le résultat, une ligne", e.actions, LIMITES.action);
  check("notes", "un piège ou une fausse piste à ne pas refaire, une ligne", e.notes, LIMITES.note);
  check("contradictions.constat", "ce que le ticket a constaté, qui contredit la section — une ligne", e.contradictions?.map((x) => x.constat), LIMITES.contradiction);
  check("prochaine_etape", "ce qu'on fait en premier à la reprise, une ligne", [e.prochaine_etape], LIMITES.prochaine_etape);
  check("questions.question", "la question posée, courte", e.questions?.map((q) => q.question), LIMITES.question);
  check("questions.reponse", "la réponse du technicien, courte — les détails vérifiés vont dans verifications", e.questions?.map((q) => q.reponse), LIMITES.reponse);
  if (trop.length) {
    throw new ErreurEnCours(
      `entrées trop longues pour un brouillon (une ligne par acquis, lisible par un repreneur sans relire la conversation) :\n- ${trop.join("\n- ")}\nRaccourcir et rappeler. Seuls plan_action et symptome_initial sont libres.`,
    );
  }
}

function ligneEtat(b: Brouillon): string {
  const escalades = escaladesBrouillon(b);
  return (
    `Étape : **${b.etape}** · ${b.nature ?? "nature non décidée"} · domaines validés : ${b.domaines_valides.join(", ") || "—"}` +
    `${escalades.length ? ` · escalade : ${escalades.join(" → ")}` : ""}` +
    `${b.skills_charges.length ? ` · skills chargés : ${b.skills_charges.join(", ")}` : ""}` +
    `${b.sections_servies.length ? ` · sections servies : ${b.sections_servies.length}` : ""}` +
    `${b.cas_lus.length ? ` · cas lus : ${b.cas_lus.join(", ")}` : ""}`
  );
}

/** Les escalades : dérivées de skills_charges ; sur un brouillon antérieur à 2.4, celles qu'il porte. */
export function escaladesBrouillon(b: Brouillon): string[] {
  return b.skills_charges.length ? escaladesDerivees(b.skills_charges) : b.escalades;
}

/** L'étape, calculée : pause > actions > plan > recherche > instruction > triage. */
export function calculerEtape(b: Brouillon): Etape {
  if (b.pause) return "pause";
  if (b.actions.length) return "actions";
  if (b.plan_action.trim()) return "plan";
  if (b.recherche_faite) return "recherche";
  if (casInstruit(b.skills_charges) || b.skill_charge) return "instruction";
  return "triage";
}

/** Le fichier : l'en-tête YAML (source de vérité) et un corps réduit à l'état. */
function rendre(b: Brouillon): string {
  const passations = b.passations.length ? b.passations.map((p) => `- ${p.date} : de ${p.de} à ${p.a}`).join("\n") : "_(aucune)_";
  return (
    `---\n${YAML.stringify(b).trimEnd()}\n---\n\n` +
    `# En cours ${b.id}${b.reference ? ` — ${b.reference}` : ""}\n\n` +
    `## etat — Où en est le ticket\n\n` +
    `${ligneEtat(b)}\n\n` +
    `**Prochaine étape :** ${b.prochaine_etape || "_(non notée)_"}\n\n` +
    `Dernier point d'étape : ${b.derniere_mise_a_jour} par ${b.technicien} sur ${b.poste} · ${b.verifications.length} vérification(s), ${b.questions.length} question(s), ${b.actions.length} action(s), ${b.notes.length} note(s), ${b.contradictions.length} contradiction(s). Le détail est dans l'en-tête ci-dessus ; \`resume_ticket\` le rend en clair.\n\n` +
    `## passations — Passations\n\n${passations}\n`
  );
}

/** Le manifeste pour rendre les libellés des signaux ; null si illisible (le rendu montre alors l'identifiant). */
let manifestePourRendu: Manifeste | null = null;

/** Le brouillon en clair, pour la reprise. */
function rendreComplet(b: Brouillon): string {
  const puces = (l: string[]) => (l.length ? l.map((x) => `- ${x}`).join("\n") : "_(rien)_");
  const questions = b.questions.length
    ? b.questions.map((q, i) => `${i + 1}. **Q :** ${q.question}\n   **R :** ${q.reponse}${q.section ? `\n   _Section candidate : \`${q.section}\`_` : ""}`).join("\n")
    : "_(rien)_";
  const passations = b.passations.length ? b.passations.map((p) => `- ${p.date} : de ${p.de} à ${p.a}`).join("\n") : "_(aucune)_";
  const bloc = (id: string, titre: string, contenu: string) => `## ${id} — ${titre}\n\n${contenu}\n`;
  return (
    bloc("etat", "Où en est le ticket", `${ligneEtat(b)}\n\n**Prochaine étape :** ${b.prochaine_etape || "_(non notée)_"}`) +
    "\n" +
    bloc("symptome-initial", "Symptôme initial, tel qu'exprimé", b.symptome_initial || "_(rien)_") +
    "\n" +
    bloc("signaux", "Signaux cochés", puces(b.signaux.map((s) => rendreSignal(manifestePourRendu, s)))) +
    "\n" +
    bloc("verifications", "Crans et vérifications faites, avec leurs résultats", puces(b.verifications)) +
    "\n" +
    bloc("questions", "Questions posées au technicien", questions) +
    "\n" +
    bloc("plan-action", "Plan d'action (proposé ou validé)", b.plan_action || "_(rien)_") +
    "\n" +
    bloc("actions", "Actions réalisées et leurs résultats", puces(b.actions)) +
    "\n" +
    bloc("notes", "Notes pour la reprise", puces(b.notes)) +
    "\n" +
    bloc("contradictions", "Contexte contredit par le terrain (repris à la clôture)", puces(b.contradictions.map((x) => `\`${x.section}\` : ${x.constat}`))) +
    "\n" +
    bloc("passations", "Passations", passations)
  );
}

function ecrire(r: Racines, b: Brouillon): string {
  const fichier = fichierBrouillon(r, b.id);
  const tmp = `${fichier}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, rendre(b), "utf8");
  fs.renameSync(tmp, fichier);
  return fichier;
}

/**
 * `session` : l'état de la session serveur, recopié dans le brouillon (le
 * modèle ne renseigne jamais ces champs). Absent dans les tests unitaires.
 */
export function sauverProgression(r: Racines, e: EntreeProgression, session?: Session): ProgressionEcrite {
  assurerInstallation(r);
  verifierLongueurs(e);
  const ref = verifierReference(e.reference);
  const domainesProposes = verifierDomaines(r, "domaines_proposes", e.domaines_proposes);
  const domainesValides = verifierDomaines(r, "domaines_valides", e.domaines_valides);
  const maintenant = new Date().toISOString();
  const moi = utilisateur();

  let b: Brouillon | null = null;
  let lie: ProgressionEcrite["lie"] = null;
  if (e.id) {
    b = lireBrouillon(r, e.id);
    if (!b) throw new ErreurEnCours(`brouillon inconnu : ${e.id}. Sans id, save_progress crée le brouillon ; resume_ticket() liste ceux qui existent.`);
  } else if (ref) {
    b = trouverBrouillon(r, ref);
    if (b) lie = "reference";
  }
  if (!b && !e.id && texte(e.symptome_initial ?? "")) {
    // A5 : un oubli d'id ne crée pas un doublon.
    b = trouverParSymptome(r, e.symptome_initial!);
    if (b) lie = "symptome";
  }
  if (b) verifierReferenceStable(b, ref);

  let cree = false;
  if (!b) {
    if (!texte(e.symptome_initial ?? "")) {
      throw new ErreurEnCours("symptome_initial est obligatoire à la création d'un brouillon (tel qu'exprimé par le technicien)");
    }
    let id = fabriquerId();
    let n = 1;
    while (fs.existsSync(fichierBrouillon(r, id)) || fs.existsSync(path.join(chemins(r).tickets, `${id}.md`))) id = `${fabriquerId()}-${++n}`;
    b = {
      id,
      reference: null,
      cree: maintenant,
      derniere_mise_a_jour: maintenant,
      technicien: moi,
      poste: poste(),
      etape: "triage",
      pause: false,
      nature: null,
      domaines_proposes: [],
      domaines_valides: [],
      escalades: [],
      skill_charge: null,
      skills_charges: [],
      sections_servies: [],
      cas_lus: [],
      recherche_faite: false,
      actions_par_appel: [],
      points_etape: [],
      passations: [],
      symptome_initial: "",
      prochaine_etape: "",
      signaux: [],
      verifications: [],
      questions: [],
      plan_action: "",
      actions: [],
      notes: [],
      contradictions: [],
    };
    cree = true;
  }

  let passation: Passation | null = null;
  if (b.technicien && b.technicien !== moi) {
    passation = { de: b.technicien, a: moi, date: maintenant };
    b.passations = [...b.passations, passation];
  }
  b.technicien = moi;
  b.poste = poste();
  b.derniere_mise_a_jour = maintenant;
  b.points_etape = [...b.points_etape, maintenant];
  b.pause = Boolean(e.pause);
  // La référence ne s'écrit que si le brouillon n'en a pas (A4 a déjà refusé
  // un changement) : une variante de casse ne doit pas écraser « INC-123 ».
  if (ref && !b.reference) b.reference = ref;
  const avertissements: string[] = [];
  if (!b.symptome_initial && texte(e.symptome_initial ?? "")) {
    // E11 (campagne 0.3.0-beta) : l'argument de /support commence souvent par
    // « EX-2107 : … » ; la référence a son champ, elle n'est pas le symptôme.
    const brut = texte(e.symptome_initial!);
    const sans = b.reference ? sansPrefixeReference(brut, b.reference) : brut;
    if (sans !== brut) avertissements.push(`symptome_initial : la référence « ${b.reference} » en tête a été retirée, le symptôme commence à « ${sans.slice(0, 40)}… »`);
    b.symptome_initial = sans;
  }
  if (e.nature) b.nature = e.nature;
  if (domainesProposes) {
    // Même règle pour les proposés : après le premier skill de domaine, l'escalade
    // s'ajoute à la proposition du triage, elle ne l'efface pas (jeu de test du triage).
    const instruits = domainesInstruits(session ? session.skillsCharges : b.skills_charges);
    b.domaines_proposes = instruits.length && b.domaines_proposes.length ? [...b.domaines_proposes, ...domainesProposes.filter((d) => !b!.domaines_proposes.includes(d))] : domainesProposes;
  }
  if (domainesValides) {
    // E5 (campagne 0.3.0-beta) : après le premier skill de domaine, un domaine
    // validé ne se retire plus — l'escalade passe par load_skill et s'ajoute.
    const instruits = domainesInstruits(session ? session.skillsCharges : b.skills_charges);
    if (instruits.length && b.domaines_valides.length) {
      const union = [...b.domaines_valides, ...domainesValides.filter((d) => !b!.domaines_valides.includes(d))];
      const retires = b.domaines_valides.filter((d) => !domainesValides.includes(d));
      if (retires.length) avertissements.push(`domaines_valides : ${retires.join(", ")} conservé(s) — un domaine validé ne se retire plus une fois un skill de domaine chargé ; l'escalade s'ajoute par load_skill (validés : ${union.join(", ")})`);
      b.domaines_valides = union;
    } else {
      b.domaines_valides = domainesValides;
    }
  }
  if (texte(e.prochaine_etape ?? "")) b.prochaine_etape = texte(e.prochaine_etape!);
  if (texte(e.plan_action ?? "")) b.plan_action = texte(e.plan_action!);
  b.signaux = ajouter(b.signaux, e.signaux, (x) => x.id || x.preuve);
  b.verifications = ajouter(b.verifications, e.verifications, (x) => x.trim());
  const avantActions = b.actions.length;
  b.actions = ajouter(b.actions, e.actions, (x) => x.trim());
  if (b.actions.length > avantActions) b.actions_par_appel = [...b.actions_par_appel, b.actions.length - avantActions];
  b.notes = ajouter(b.notes, e.notes, (x) => x.trim());
  b.questions = ajouter(b.questions, e.questions, (q) => q.question.trim());
  b.contradictions = ajouter(b.contradictions, e.contradictions, (x) => `${x.section} ${x.constat}`);
  // Décision 2, point 7 : un domaine proposé sans signal coché est refusé.
  // Depuis la campagne 0.3.0-beta (E10) : pour une demande aussi — le manifeste
  // porte pour chaque domaine un signal « ce sur quoi porte l'état cible ».
  if (domainesProposes) {
    const coches = new Set(b.signaux.map((x) => x.id).filter(Boolean));
    const sansSignal = domainesProposes.filter((d) => !trouverDomaineSignaux(r, d).some((id) => coches.has(id)));
    if (sansSignal.length) {
      throw new ErreurEnCours(
        `domaines_proposes : ${sansSignal.join(", ")} sans aucun signal coché. Le triage propose les domaines que les signaux désignent ; cocher d'abord le signal (signaux: [{ id, preuve }]), ou retirer le domaine. Classement actuel : ${rendreClassement(r, b)}`,
      );
    }
  }
  if (session) {
    // Un brouillon neuf hérite des skills et sections servis avant sa création
    // (le triage, un domaine chargé trop tôt), pas d'une recherche ou d'un cas
    // lu pour un autre ticket : ceux-là sont propres au ticket.
    if (cree) {
      session.rechercheFaite = false;
      session.casLus = [];
    }
    const etat = fusionnerEtat(etatBrouillon(b), session);
    b.skills_charges = etat.skills_charges;
    b.sections_servies = etat.sections_servies;
    b.cas_lus = etat.cas_lus;
    b.recherche_faite = etat.recherche_faite;
  }
  b.etape = calculerEtape(b);

  const fichier = ecrire(r, b);
  return { id: b.id, fichier, cree, lie, passation, etape: b.etape, classement: rendreClassement(r, b), avertissements };
}

function trouverDomaineSignaux(r: Racines, domaine: string): string[] {
  return (lireManifeste(r).domaines.find((d) => d.id === domaine)?.signaux ?? []).map((s) => s.id);
}

/** Le classement des domaines depuis les signaux cochés du brouillon, pour la réponse de save_progress. */
export function rendreClassement(r: Racines, b: Brouillon): string {
  const ids = b.signaux.map((s) => s.id).filter(Boolean);
  if (!ids.length) return "aucun signal coché";
  const cl = classerDomaines(lireManifeste(r), ids);
  return cl.length ? cl.map((x) => `${x.domaine} (${x.n} : ${x.signaux.join(", ")})`).join(" > ") : "aucun domaine";
}

export function etatBrouillon(b: Brouillon): EtatBrouillon {
  return { skills_charges: b.skills_charges, sections_servies: b.sections_servies, cas_lus: b.cas_lus, recherche_faite: b.recherche_faite };
}

export function retirerBrouillon(r: Racines, id: string): boolean {
  const f = fichierBrouillon(r, id);
  if (!fs.existsSync(f)) return false;
  fs.unlinkSync(f);
  return true;
}

function ageMinutes(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 60000;
}

export function ageJours(b: Brouillon): number {
  return Math.floor(ageMinutes(b.derniere_mise_a_jour) / 1440);
}

/** Rendu pour resume_ticket : l'état, puis le brouillon, puis les avertissements. */
export function rendreReprise(b: Brouillon, m?: Manifeste): string {
  manifestePourRendu = m ?? null;
  const moi = utilisateur();
  const avert: string[] = [];
  if (b.technicien !== moi) {
    const age = ageMinutes(b.derniere_mise_a_jour);
    avert.push(
      age < MINUTES_REPRISE_PRUDENTE
        ? `**Attention** : dernier point d'étape par **${b.technicien}** il y a ${Math.round(age)} min — il est peut-être encore dessus. Vérifier avant de reprendre ; le prochain save_progress enregistrera la passation.`
        : `Ticket démarré ou tenu par **${b.technicien}** (dernier point d'étape : ${b.derniere_mise_a_jour}). Le prochain save_progress enregistrera la passation vers ${moi}.`,
    );
  }
  const corps = rendreComplet(b);
  return (
    `# Reprise du ticket ${b.id}${b.reference ? ` — ${b.reference}` : ""}\n\n` +
    `Créé le ${b.cree} · dernier point d'étape le ${b.derniere_mise_a_jour} par ${b.technicien} sur ${b.poste}.\n\n` +
    (avert.length ? avert.map((a) => `> ${a}`).join("\n\n") + "\n\n" : "") +
    `**Marche à suivre** : ré-annoncer l'état en trois lignes au technicien, recharger le skill (\`load_skill(${JSON.stringify(domainesInstruits(b.skills_charges).length ? domainesInstruits(b.skills_charges).slice(-1) : b.skill_charge?.domaines ?? b.domaines_valides)}, "${b.nature ?? b.skill_charge?.nature ?? "…"}")\`) sans refaire le triage — l'état de session (skills, sections, cas lus) est déjà reconstruit depuis le brouillon, puis reprendre à la prochaine étape notée. Continuer les points d'étape avec \`id: "${b.id}"\`.\n\n---\n\n` +
    corps
  );
}

/**
 * La liste des tickets en cours. `plafond` (B1) : au triage, les 10 plus
 * récents seulement — le modèle ne reconnaît pas une référence dans la
 * liste, il appelle `resume_ticket(référence)` ; `resume_ticket()` rend tout.
 */
export function rendreListe(bs: Brouillon[], plafond = Infinity): string {
  if (bs.length === 0) return "Aucun ticket en cours.";
  const montres = bs.slice(0, plafond);
  const out = [
    `${bs.length} ticket(s) en cours — reprendre avec \`resume_ticket(<id ou référence>)\` :`,
    "",
    "| Référence | Id | Technicien | Étape | Dernier point | Prochaine étape |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const b of montres) {
    const age = ageJours(b);
    const vieux = age >= JOURS_BROUILLON_ANCIEN ? ` ⚠ ${age} j` : "";
    out.push(`| ${b.reference ?? "—"} | \`${b.id}\` | ${b.technicien} | ${b.etape}${vieux} | ${b.derniere_mise_a_jour.slice(0, 16).replace("T", " ")} | ${b.prochaine_etape || "—"} |`);
  }
  if (bs.length > montres.length) {
    out.push("", `… et ${bs.length - montres.length} autre(s) : \`resume_ticket()\` sans argument pour tout voir.`);
  }
  if (bs.some((b) => ageJours(b) >= JOURS_BROUILLON_ANCIEN)) {
    out.push("", `Un brouillon de plus de ${JOURS_BROUILLON_ANCIEN} jours est à clôturer (save_ticket, statut non-resolu si besoin) ou à reprendre.`);
  }
  return out.join("\n");
}

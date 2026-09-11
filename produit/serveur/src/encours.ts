// save_progress et resume_ticket : le brouillon d'un ticket en cours, un
// fichier par ticket dans installation/en-cours/, réécrit à chaque point
// d'étape (fusion : les listes s'ajoutent, les scalaires se remplacent).
// Source de vérité : l'en-tête YAML ; le corps markdown en est dérivé.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { assurerInstallation, chemins, type Racines } from "./config.js";
import { fabriquerId, idValide, poste, utilisateur } from "./ids.js";
import { lireDocument } from "./markdown.js";

export type Etape = "triage" | "instruction" | "recherche" | "plan" | "actions" | "cloture" | "pause";
export const ETAPES: Etape[] = ["triage", "instruction", "recherche", "plan", "actions", "cloture", "pause"];

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
  etape: Etape;
  nature: "incident" | "demande" | null;
  domaines_proposes: string[];
  domaines_valides: string[];
  escalades: string[];
  skill_charge: SkillCharge | null;
  passations: Passation[];
  symptome_initial: string;
  prochaine_etape: string;
  signaux: string[];
  verifications: string[];
  questions: QuestionPosee[];
  plan_action: string;
  actions: string[];
  notes: string[];
}

export interface EntreeProgression {
  id?: string;
  reference?: string;
  etape: Etape;
  symptome_initial?: string;
  nature?: "incident" | "demande";
  domaines_proposes?: string[];
  domaines_valides?: string[];
  escalades?: string[];
  skill_charge?: SkillCharge;
  prochaine_etape?: string;
  signaux?: string[];
  verifications?: string[];
  questions?: QuestionPosee[];
  plan_action?: string;
  actions?: string[];
  notes?: string[];
}

export interface ProgressionEcrite {
  id: string;
  fichier: string;
  cree: boolean;
  /** Vrai si l'appel sans id a été rattaché à un brouillon existant par sa référence. */
  lie: boolean;
  passation: Passation | null;
  etape: Etape;
}

export class ErreurEnCours extends Error {}

const MINUTES_REPRISE_PRUDENTE = 10;
export const JOURS_BROUILLON_ANCIEN = 30;

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
    nature: e.nature ?? null,
    domaines_proposes: e.domaines_proposes ?? [],
    domaines_valides: e.domaines_valides ?? [],
    escalades: e.escalades ?? [],
    skill_charge: e.skill_charge ?? null,
    passations: e.passations ?? [],
    symptome_initial: String(e.symptome_initial ?? ""),
    prochaine_etape: String(e.prochaine_etape ?? ""),
    signaux: e.signaux ?? [],
    verifications: e.verifications ?? [],
    questions: e.questions ?? [],
    plan_action: String(e.plan_action ?? ""),
    actions: e.actions ?? [],
    notes: e.notes ?? [],
  };
}

export function lireBrouillon(r: Racines, id: string): Brouillon | null {
  if (!idValide(id)) return null;
  return lireFichier(fichierBrouillon(r, id));
}

export function listerBrouillons(r: Racines): Brouillon[] {
  const d = chemins(r).enCours;
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith(".md"))
    .map((f) => lireFichier(path.join(d, f)))
    .filter((b): b is Brouillon => b !== null)
    .sort((a, b) => b.derniere_mise_a_jour.localeCompare(a.derniere_mise_a_jour));
}

/** Par identifiant, sinon par référence (insensible à la casse ; le plus récent si plusieurs). */
export function trouverBrouillon(r: Racines, idOuReference: string): Brouillon | null {
  const cle = idOuReference.trim();
  const direct = lireBrouillon(r, cle);
  if (direct) return direct;
  const ref = cle.toLowerCase();
  return listerBrouillons(r).find((b) => (b.reference ?? "").toLowerCase() === ref) ?? null;
}

function ajouter<T>(existants: T[], nouveaux: T[] | undefined, cle: (x: T) => string): T[] {
  if (!nouveaux) return existants;
  const vus = new Set(existants.map(cle));
  const out = [...existants];
  for (const n of nouveaux) {
    const k = cle(n);
    if (!k || vus.has(k)) continue;
    vus.add(k);
    out.push(n);
  }
  return out;
}

const texte = (s: string) => s.trim();

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
} as const;

function verifierLongueurs(e: EntreeProgression): void {
  const trop: string[] = [];
  const check = (nom: string, regle: string, valeurs: (string | undefined)[] | undefined, max: number) => {
    for (const v of valeurs ?? []) {
      if (v && v.trim().length > max) trop.push(`${nom} (${v.trim().length} > ${max}) : ${regle} — « ${v.trim().slice(0, 60)}… »`);
    }
  };
  check("signaux", "un fait observé, une ligne, sans le raisonnement ni le domaine", e.signaux, LIMITES.signal);
  check("verifications", "un acquis : « cran N : commande → résultat », une ligne — le raisonnement et les fausses pistes vont dans notes", e.verifications, LIMITES.verification);
  check("actions", "ce que le technicien a exécuté et le résultat, une ligne", e.actions, LIMITES.action);
  check("notes", "un piège ou une fausse piste à ne pas refaire, une ligne", e.notes, LIMITES.note);
  check("prochaine_etape", "ce qu'on fait en premier à la reprise, une ligne", [e.prochaine_etape], LIMITES.prochaine_etape);
  check("questions.question", "la question posée, courte", e.questions?.map((q) => q.question), LIMITES.question);
  check("questions.reponse", "la réponse du technicien, courte — les détails vérifiés vont dans verifications", e.questions?.map((q) => q.reponse), LIMITES.reponse);
  if (trop.length) {
    throw new ErreurEnCours(
      `entrées trop longues pour un brouillon (une ligne par acquis, lisible par un repreneur sans relire la conversation) :\n- ${trop.join("\n- ")}\nRaccourcir et rappeler. Seuls plan_action et symptome_initial sont libres.`,
    );
  }
}

/** Le fichier : l'en-tête YAML (source de vérité) et un corps réduit à l'état. */
function rendre(b: Brouillon): string {
  const passations = b.passations.length ? b.passations.map((p) => `- ${p.date} : de ${p.de} à ${p.a}`).join("\n") : "_(aucune)_";
  return (
    `---\n${YAML.stringify(b).trimEnd()}\n---\n\n` +
    `# En cours ${b.id}${b.reference ? ` — ${b.reference}` : ""}\n\n` +
    `## etat — Où en est le ticket\n\n` +
    `Étape : **${b.etape}** · ${b.nature ?? "nature non décidée"} · domaines validés : ${b.domaines_valides.join(", ") || "—"}${b.skill_charge ? ` · skill chargé : ${b.skill_charge.domaines.join("+")} (${b.skill_charge.nature})` : ""}\n\n` +
    `**Prochaine étape :** ${b.prochaine_etape || "_(non notée)_"}\n\n` +
    `Dernier point d'étape : ${b.derniere_mise_a_jour} par ${b.technicien} sur ${b.poste} · ${b.verifications.length} vérification(s), ${b.questions.length} question(s), ${b.actions.length} action(s), ${b.notes.length} note(s). Le détail est dans l'en-tête ci-dessus ; \`resume_ticket\` le rend en clair.\n\n` +
    `## passations — Passations\n\n${passations}\n`
  );
}

/** Le brouillon en clair, pour la reprise. */
function rendreComplet(b: Brouillon): string {
  const puces = (l: string[]) => (l.length ? l.map((x) => `- ${x}`).join("\n") : "_(rien)_");
  const questions = b.questions.length
    ? b.questions.map((q, i) => `${i + 1}. **Q :** ${q.question}\n   **R :** ${q.reponse}${q.section ? `\n   _Section candidate : \`${q.section}\`_` : ""}`).join("\n")
    : "_(rien)_";
  const passations = b.passations.length ? b.passations.map((p) => `- ${p.date} : de ${p.de} à ${p.a}`).join("\n") : "_(aucune)_";
  const bloc = (id: string, titre: string, contenu: string) => `## ${id} — ${titre}\n\n${contenu}\n`;
  return (
    bloc("etat", "Où en est le ticket", `Étape : **${b.etape}** · ${b.nature ?? "nature non décidée"} · domaines validés : ${b.domaines_valides.join(", ") || "—"}${b.skill_charge ? ` · skill chargé : ${b.skill_charge.domaines.join("+")} (${b.skill_charge.nature})` : ""}\n\n**Prochaine étape :** ${b.prochaine_etape || "_(non notée)_"}`) +
    "\n" +
    bloc("symptome-initial", "Symptôme initial, tel qu'exprimé", b.symptome_initial || "_(rien)_") +
    "\n" +
    bloc("signaux", "Signaux vérifiés", puces(b.signaux)) +
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

export function sauverProgression(r: Racines, e: EntreeProgression): ProgressionEcrite {
  assurerInstallation(r);
  if (!ETAPES.includes(e.etape)) throw new ErreurEnCours(`étape inconnue : ${e.etape}. Étapes : ${ETAPES.join(", ")}`);
  verifierLongueurs(e);
  const maintenant = new Date().toISOString();
  const moi = utilisateur();

  let b: Brouillon | null = null;
  let lie = false;
  if (e.id) {
    b = lireBrouillon(r, e.id);
    if (!b) throw new ErreurEnCours(`brouillon inconnu : ${e.id}. Sans id, save_progress crée le brouillon ; resume_ticket() liste ceux qui existent.`);
  } else if (e.reference) {
    b = trouverBrouillon(r, e.reference);
    lie = b !== null;
  }

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
      etape: e.etape,
      nature: null,
      domaines_proposes: [],
      domaines_valides: [],
      escalades: [],
      skill_charge: null,
      passations: [],
      symptome_initial: "",
      prochaine_etape: "",
      signaux: [],
      verifications: [],
      questions: [],
      plan_action: "",
      actions: [],
      notes: [],
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
  b.etape = e.etape;
  // La référence ne change que si elle change vraiment : une variante de
  // casse (rattachement par « inc-123 ») ne doit pas écraser « INC-123 ».
  const ref = texte(e.reference ?? "");
  if (ref && (b.reference ?? "").toLowerCase() !== ref.toLowerCase()) b.reference = ref;
  if (!b.symptome_initial && texte(e.symptome_initial ?? "")) b.symptome_initial = texte(e.symptome_initial!);
  if (e.nature) b.nature = e.nature;
  if (e.domaines_proposes) b.domaines_proposes = e.domaines_proposes;
  if (e.domaines_valides) b.domaines_valides = e.domaines_valides;
  if (e.skill_charge) b.skill_charge = e.skill_charge;
  if (texte(e.prochaine_etape ?? "")) b.prochaine_etape = texte(e.prochaine_etape!);
  if (texte(e.plan_action ?? "")) b.plan_action = texte(e.plan_action!);
  b.escalades = ajouter(b.escalades, e.escalades, (x) => x.trim());
  b.signaux = ajouter(b.signaux, e.signaux, (x) => x.trim());
  b.verifications = ajouter(b.verifications, e.verifications, (x) => x.trim());
  b.actions = ajouter(b.actions, e.actions, (x) => x.trim());
  b.notes = ajouter(b.notes, e.notes, (x) => x.trim());
  b.questions = ajouter(b.questions, e.questions, (q) => q.question.trim());

  const fichier = ecrire(r, b);
  return { id: b.id, fichier, cree, lie, passation, etape: b.etape };
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
export function rendreReprise(b: Brouillon): string {
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
    `**Marche à suivre** : ré-annoncer l'état en trois lignes au technicien, recharger le skill (\`load_skill(${JSON.stringify(b.skill_charge?.domaines ?? b.domaines_valides)}, "${b.skill_charge?.nature ?? b.nature ?? "…"}")\`) sans refaire le triage, puis reprendre à la prochaine étape notée. Continuer les points d'étape avec \`id: "${b.id}"\`.\n\n---\n\n` +
    corps
  );
}

export function rendreListe(bs: Brouillon[]): string {
  if (bs.length === 0) return "Aucun ticket en cours.";
  const out = [
    `${bs.length} ticket(s) en cours — reprendre avec \`resume_ticket(<id ou référence>)\` :`,
    "",
    "| Référence | Id | Technicien | Étape | Dernier point | Prochaine étape |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const b of bs) {
    const age = ageJours(b);
    const vieux = age >= JOURS_BROUILLON_ANCIEN ? ` ⚠ ${age} j` : "";
    out.push(`| ${b.reference ?? "—"} | \`${b.id}\` | ${b.technicien} | ${b.etape}${vieux} | ${b.derniere_mise_a_jour.slice(0, 16).replace("T", " ")} | ${b.prochaine_etape || "—"} |`);
  }
  if (bs.some((b) => ageJours(b) >= JOURS_BROUILLON_ANCIEN)) {
    out.push("", `Un brouillon de plus de ${JOURS_BROUILLON_ANCIEN} jours est à clôturer (save_ticket, statut non-resolu si besoin) ou à reprendre.`);
  }
  return out.join("\n");
}

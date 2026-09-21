// L'audit (décisions 8 et 9) : le serveur calcule un rapport sur ce que
// l'installation accumule — tickets, brouillons, base, contexte — ; le skill
// `audit` dit au modèle comment le présenter et quoi proposer ; l'humain dit
// oui. Rien ici n'écrit dans une archive : la seule écriture est le rapport
// lui-même, daté, dans installation/audits/, une fois. Le même rapport est la
// commande CLI `audit` : une fonction, deux rendus.
import fs from "node:fs";
import path from "node:path";
import { JOURS_PEREMPTION, assurerInstallation, chemins, type Racines } from "./config.js";
import { CARACTERES_MAX_SECTION, LIGNES_MAX_SECTION, ageEnJours, etatRemplissage, gabaritsLivres, obtenirSections, sectionsRemplies, volumineuse } from "./contexte.js";
import { JOURS_BROUILLON_ANCIEN, ageJours, lireEnCours, lireSignaux, listerBrouillons, type Brouillon } from "./encours.js";
import { horodatage } from "./ids.js";
import { bibliotheque, classerDomaines, lireManifeste, type Manifeste } from "./manifeste.js";
import { lireDocument, sections, titresMalFormes } from "./markdown.js";

// ---- La file des candidats (décision 9, mécanisme 2) -----------------------

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

function fichiersMd(dossier: string): string[] {
  return fs.existsSync(dossier) ? fs.readdirSync(dossier).filter((f) => f.endsWith(".md")).sort().map((f) => path.join(dossier, f)) : [];
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
 * Ce que les tickets ont proposé pour le contexte et qui n'y est pas encore :
 * une question journalisée avec section candidate dont la section est encore
 * vide (la réponse du technicien est le contenu candidat) ; une mise à jour
 * proposée à la clôture jamais appliquée ; une contradiction notée en ticket
 * (brouillon ou ticket clôturé). Regroupés par section, la plus demandée en tête.
 */
export function candidats(r: Racines): Map<string, Candidat[]> {
  const c = chemins(r);
  const bruts: Candidat[] = [];
  for (const f of fichiersMd(c.journal)) {
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
  for (const f of fichiersMd(c.tickets)) {
    const doc = lireDocument(fs.readFileSync(f, "utf8"));
    const ticket = String(doc.entete.id ?? path.basename(f, ".md"));
    const date = String(doc.entete.date ?? "");
    for (const p of lireProposees(doc.corps, "mises-a-jour-contexte")) {
      bruts.push({ section: p.section, source: p.contenu.startsWith("(contradiction constatée en ticket)") ? "contradiction" : "mise-a-jour", ticket, date, contenu: p.contenu });
    }
  }
  for (const b of listerBrouillons(r)) {
    for (const x of b.contradictions) bruts.push({ section: x.section, source: "contradiction", ticket: b.id, date: b.derniere_mise_a_jour, contenu: x.constat });
  }
  const sectionsVues = [...new Set(bruts.map((x) => x.section))];
  const etats = new Map(obtenirSections(r, sectionsVues).map((s) => [s.id, s]));
  const restants = bruts.filter((x) => {
    const s = etats.get(x.section);
    if (!s) return true;
    if (x.source === "question") return s.etat !== "ok";
    // EA3 (campagne sans jeu de données) : le candidat **entier**, pas un préfixe —
    // une mise à jour qui reprend la section et y ajoute commence comme elle.
    if (x.source === "mise-a-jour") return s.etat !== "ok" || !normaliser(s.contenu ?? "").includes(normaliser(x.contenu));
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
      // O11 (campagne 0.3.0-beta) : jamais tronqué — le skill doit pouvoir montrer le candidat en entier.
      out.push(`| \`${section}\` | ${x.source} | ${x.ticket} (${x.date.slice(0, 10)}) | ${x.contenu.replace(/\|/g, "\\|").replace(/\n/g, "<br>")} |`);
    }
  }
  out.push("", "Proposer un par un, la section la plus demandée en tête ; montrer le contenu en entier ; écrire sur oui seulement.");
  return out.join("\n");
}

// ---- Le rapport (décision 8) --------------------------------------------------

export interface TicketAudit {
  id: string;
  fichier: string;
  reference: string;
  date: string;
  nature: string;
  statut: string;
  resolu_par: string;
  duree: number | null;
  questions: number;
  domaines_proposes: string[];
  domaines_valides: string[];
  escalades: string[];
  signaux: string[];
  cas_lus: string[];
  actions_par_appel: number[];
  conclusion: string;
  publie: boolean;
  /** En-tête YAML illisible ou vide. */
  illisible: boolean;
}

export interface LigneTriage {
  ticket: string;
  reference: string;
  signaux: string[];
  /** Le classement calculé depuis les signaux cochés (vide sur les tickets antérieurs aux identifiants). */
  calcules: string[];
  proposes: string[];
  valides: string[];
  escalades: string[];
  /** proposés ≠ validés, ou escalade : la ligne désigne un signal à revoir. */
  ecart: boolean;
}

export interface Audit {
  date: string;
  installation: string;
  tickets: TicketAudit[];
  triage: LigneTriage[];
  brouillonsAnciens: { id: string; reference: string; age: number; etape: string; prochaine_etape: string }[];
  zombies: string[];
  orphelins: string[];
  resolusNonPublies: TicketAudit[];
  tagsHorsBibliotheque: { entree: string; tags: string[] }[];
  domainesInconnus: { ticket: string; domaines: string[] }[];
  kbIllisibles: string[];
  /** E7 (campagne 0.3.0-beta) : un fichier dont le nom n'est pas l'id de son en-tête (copie à la main) — doublon en base. */
  nomsDiscordants: string[];
  ticketsIllisibles: string[];
  casLus: { ticket: string; cas: string[]; statut: string }[];
  actionsMultiples: { ticket: string; appels: number[] }[];
  /** Volet contexte. */
  /** OA1 (campagne sans jeu de données) : le remplissage, en information — pas un constat, l'audit à 0 ticket disait « 0 constat » sur 45 vides. */
  remplissage: { remplies: number; vides: number };
  perimees: { section: string; date: string; age: number }[];
  candidats: Map<string, Candidat[]>;
  volumineuses: string[];
  placeholders: string[];
  titresMalFormes: { fichier: string; titres: string[] }[];
  sectionsEnDouble: { fichier: string; sections: string[] }[];
  historique: { fichier: string; copies: number }[];
}

function lireTicketAudit(f: string, publies: Set<string>): TicketAudit {
  const doc = lireDocument(fs.readFileSync(f, "utf8"));
  const e = doc.entete;
  const id = String(e.id ?? path.basename(f, ".md"));
  const liste = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
  return {
    id,
    fichier: f,
    reference: e.reference ? String(e.reference) : "",
    date: String(e.date ?? ""),
    nature: String(e.nature ?? ""),
    statut: String(e.statut ?? ""),
    resolu_par: e.resolu_par === null || e.resolu_par === undefined ? "—" : String(e.resolu_par),
    duree: typeof e.duree_minutes === "number" ? e.duree_minutes : null,
    questions: typeof e.questions === "number" ? e.questions : 0,
    domaines_proposes: liste(e.domaines_proposes),
    domaines_valides: liste(e.domaines_valides),
    escalades: liste(e.escalades),
    signaux: lireSignaux(e.signaux).map((s) => s.id).filter(Boolean),
    cas_lus: liste(e.cas_lus),
    actions_par_appel: Array.isArray(e.actions_par_appel) ? (e.actions_par_appel as unknown[]).map(Number) : [],
    // O10 (campagne 0.3.0-beta) : la conclusion, une ligne, pour qu'un résolu non
    // publié puisse être proposé sans être lu (read_kb refuse un non publié).
    conclusion: (sections(doc.corps).find((x) => x.id === "conclusion")?.contenu ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "",
    publie: publies.has(id),
    illisible: Object.keys(e).length === 0,
  };
}

export function calculerAudit(r: Racines): Audit {
  const c = chemins(r);
  const m: Manifeste = lireManifeste(r);
  const biblio = bibliotheque(r, m);
  const domaines = new Set(m.domaines.map((d) => d.id));
  const kbFichiers = fichiersMd(c.kb);
  const publies = new Set(kbFichiers.map((f) => path.basename(f, ".md")));

  // Volet tickets.
  const tickets = fichiersMd(c.tickets).map((f) => lireTicketAudit(f, publies));
  const lisibles = tickets.filter((t) => !t.illisible);
  const triage: LigneTriage[] = lisibles.map((t) => {
    const calcules = t.signaux.length ? classerDomaines(m, t.signaux).map((x) => x.domaine) : [];
    // OA6 (passe manifeste, 2026-09-21) : un écart = les signaux cochés ne mènent
    // pas au domaine validé — le premier du classement calculé n'est pas parmi les
    // validés (escalade comprise). Un triage ambigu résolu par une question, ou une
    // escalade dont les signaux du diagnostic mènent au bon domaine, n'en sont pas.
    // Sans signal coché (ticket antérieur aux identifiants) : rien à comparer.
    const ecart = calcules.length > 0 && t.domaines_valides.length > 0 && !t.domaines_valides.includes(calcules[0]);
    return {
      ticket: t.id,
      reference: t.reference,
      signaux: t.signaux,
      calcules,
      proposes: t.domaines_proposes,
      valides: t.domaines_valides,
      escalades: t.escalades,
      ecart,
    };
  });
  const enCours = lireEnCours(r);
  const brouillonsAnciens = enCours.actifs
    .filter((b: Brouillon) => ageJours(b) >= JOURS_BROUILLON_ANCIEN)
    .map((b: Brouillon) => ({ id: b.id, reference: b.reference ?? "—", age: ageJours(b), etape: b.etape, prochaine_etape: b.prochaine_etape || "—" }));
  const resolusNonPublies = lisibles.filter((t) => t.statut === "resolu" && !t.publie);
  const tagsHorsBibliotheque: Audit["tagsHorsBibliotheque"] = [];
  const kbIllisibles: string[] = [];
  const nomsDiscordants: string[] = [];
  const derives = new Set<string>([...domaines, "incident", "demande"]);
  for (const t of lisibles) if (path.basename(t.fichier, ".md") !== t.id) nomsDiscordants.push(`tickets/${path.basename(t.fichier)} (id ${t.id})`);
  for (const f of kbFichiers) {
    const doc = lireDocument(fs.readFileSync(f, "utf8"));
    if (Object.keys(doc.entete).length === 0) {
      kbIllisibles.push(path.basename(f));
      continue;
    }
    if (doc.entete.id && String(doc.entete.id) !== path.basename(f, ".md")) nomsDiscordants.push(`kb/${path.basename(f)} (id ${String(doc.entete.id)})`);
    const ref = doc.entete.reference ? String(doc.entete.reference).toLowerCase() : "";
    const tags = Array.isArray(doc.entete.tags) ? doc.entete.tags.map(String) : [];
    const hors = tags.filter((t) => !biblio.tous.includes(t) && !derives.has(t) && t !== ref);
    if (hors.length) tagsHorsBibliotheque.push({ entree: path.basename(f, ".md"), tags: hors });
  }
  const domainesInconnus = lisibles
    .map((t) => ({ ticket: t.id, domaines: [...t.domaines_proposes, ...t.domaines_valides, ...t.escalades].filter((d) => !domaines.has(d)) }))
    .filter((x) => x.domaines.length);
  const casLus = lisibles.filter((t) => t.cas_lus.length).map((t) => ({ ticket: t.id, cas: t.cas_lus, statut: t.statut }));
  const actionsMultiples = lisibles.filter((t) => t.actions_par_appel.some((n) => n > 1)).map((t) => ({ ticket: t.id, appels: t.actions_par_appel }));

  // Volet contexte.
  const perimees: Audit["perimees"] = [];
  const volumineuses: string[] = [];
  const placeholders: string[] = [];
  const titres: Audit["titresMalFormes"] = [];
  const doubles: Audit["sectionsEnDouble"] = [];
  const remplissage = { remplies: 0, vides: 0 };
  for (const g of gabaritsLivres(r)) {
    const fichier = path.join(c.contexte, `${g.domaine}.md`);
    if (!fs.existsSync(fichier)) continue;
    const corps = lireDocument(fs.readFileSync(fichier, "utf8")).corps;
    const mal = titresMalFormes(corps);
    if (mal.length) titres.push({ fichier: `${g.domaine}.md`, titres: mal });
    const secs = sectionsRemplies(r, g.domaine) ?? [];
    const ids = secs.map((s) => s.id);
    const dbl = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dbl.length) doubles.push({ fichier: `${g.domaine}.md`, sections: dbl });
    for (const s of secs) {
      if (s.vide) {
        remplissage.vides++;
        continue;
      }
      remplissage.remplies++;
      const id = `${g.domaine}/${s.id}`;
      const age = ageEnJours(s.derniereMiseAJour);
      if (age !== null && age > JOURS_PEREMPTION) perimees.push({ section: id, date: s.derniereMiseAJour ?? "", age });
      if (volumineuse(s.contenu)) volumineuses.push(id);
      if (/<[^<>\n]{1,80}>/.test(s.contenu)) placeholders.push(id);
    }
  }
  const hist = path.join(c.contexte, "historique");
  const historique: Audit["historique"] = [];
  if (fs.existsSync(hist)) {
    const compte = new Map<string, number>();
    for (const f of fs.readdirSync(hist)) {
      const dom = f.replace(/-\d{8}-\d{6}(-\d+)?\.md$/, "");
      compte.set(dom, (compte.get(dom) ?? 0) + 1);
    }
    for (const [fichier, copies] of compte) historique.push({ fichier: `${fichier}.md`, copies });
  }

  return {
    date: new Date().toISOString(),
    installation: r.installation,
    tickets,
    triage,
    brouillonsAnciens,
    zombies: enCours.zombies.map((b) => b.id),
    orphelins: enCours.orphelins.map((f) => path.basename(f)),
    resolusNonPublies,
    tagsHorsBibliotheque,
    domainesInconnus,
    kbIllisibles,
    nomsDiscordants,
    ticketsIllisibles: tickets.filter((t) => t.illisible).map((t) => path.basename(t.fichier)),
    casLus,
    actionsMultiples,
    remplissage,
    perimees,
    candidats: candidats(r),
    volumineuses,
    placeholders,
    titresMalFormes: titres,
    sectionsEnDouble: doubles,
    historique,
  };
}

/** Les constats de santé des fichiers (C3) : ce qui fait échouer la commande CLI. */
export function constatsSante(a: Audit): number {
  return a.orphelins.length + a.kbIllisibles.length + a.nomsDiscordants.length + a.ticketsIllisibles.length + a.domainesInconnus.length + a.titresMalFormes.length + a.sectionsEnDouble.length + a.tagsHorsBibliotheque.length;
}

/** Le nombre de constats, tous volets — ce que le rapport annonce en tête. */
export function nombreConstats(a: Audit): number {
  return (
    a.triage.filter((l) => l.ecart).length +
    a.brouillonsAnciens.length +
    a.zombies.length +
    a.orphelins.length +
    a.resolusNonPublies.length +
    a.tagsHorsBibliotheque.length +
    a.domainesInconnus.length +
    a.kbIllisibles.length +
    a.nomsDiscordants.length +
    a.ticketsIllisibles.length +
    a.casLus.length +
    a.actionsMultiples.length +
    a.perimees.length +
    [...a.candidats.values()].reduce((n, l) => n + l.length, 0) +
    a.volumineuses.length +
    a.placeholders.length +
    a.titresMalFormes.length +
    a.sectionsEnDouble.length +
    a.historique.filter((h) => h.copies > 1).length
  );
}

const puce = (l: string[]) => (l.length ? l.map((x) => `- ${x}`).join("\n") : "_(rien)_");

export function rendreAudit(a: Audit): string {
  const out: string[] = [];
  out.push(`# Audit de l'installation — ${a.date.slice(0, 16).replace("T", " ")} UTC`, "");
  out.push(`${a.installation} · ${a.tickets.length} ticket(s), ${a.tickets.filter((t) => t.publie).length} publié(s) · ${nombreConstats(a)} constat(s).`, "");
  out.push("Chaque constat dit ce que le skill peut proposer. L'audit n'écrit jamais de lui-même : ses seules sorties sont `save_ticket`, `publish_kb` et `update_context`, un par un, sur oui. Il ne touche jamais un ticket clôturé, un journal ou une entrée de base.", "");

  out.push("## tickets — Volet tickets", "");
  out.push("### Jeu de test du triage — signaux cochés → domaines calculés → validés", "");
  if (a.triage.length === 0) out.push("_(aucun ticket)_");
  else {
    out.push("| Ticket | Signaux cochés | Calculés | Proposés | Validés | Escalade | Écart |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const l of a.triage) {
      out.push(`| ${l.ticket}${l.reference ? ` (${l.reference})` : ""} | ${l.signaux.join(", ") || "—"} | ${l.calcules.join(" > ") || "—"} | ${l.proposes.join(", ") || "—"} | ${l.valides.join(", ") || "—"} | ${l.escalades.join(" → ") || "—"} | ${l.ecart ? "**oui**" : "non"} |`);
    }
    out.push("", `${a.triage.filter((l) => l.ecart).length} écart(s). Un écart = le premier domaine calculé par les signaux n'est pas parmi les validés : un signal du manifeste à revoir — à lire par le référent, jamais corrigé en cours de ticket. Un triage ambigu résolu par une question ou une escalade réussie n'en sont pas. Les tickets sans signaux cochés sont antérieurs aux identifiants : à lire à la main.`);
  }
  out.push("", "### Brouillons anciens — à clôturer en `non-resolu` sur oui, un par un (`save_ticket`)", "");
  out.push(puce(a.brouillonsAnciens.map((b) => `\`${b.id}\` (${b.reference}) : ${b.age} j, étape ${b.etape}, prochaine étape : ${b.prochaine_etape}`)));
  out.push("", "### Brouillons zombies et orphelins — à supprimer à la main", "");
  out.push(puce([...a.zombies.map((z) => `zombie \`${z}\` : le ticket est déjà clôturé`), ...a.orphelins.map((o) => `orphelin \`${o}\` : pas d'en-tête lisible`)]));
  out.push("", "### Tickets résolus jamais publiés — candidats à `publish_kb`, un par un, sur oui", "");
  out.push(puce(a.resolusNonPublies.map((t) => `\`${t.id}\`${t.reference ? ` (${t.reference})` : ""} · ${t.nature} · ${t.domaines_valides.join(", ")} · ${t.date.slice(0, 10)}${t.conclusion ? ` — ${t.conclusion}` : ""}`)));
  out.push("", "### Tags hors bibliothèque dans la base — correction manuelle", "");
  out.push(puce(a.tagsHorsBibliotheque.map((x) => `\`${x.entree}\` : ${x.tags.join(", ")}`)));
  out.push("", "### Cas lus par `read_kb` et suite donnée", "");
  out.push(puce(a.casLus.map((x) => `\`${x.ticket}\` a lu ${x.cas.map((c) => `\`${c}\``).join(", ")} → ${x.statut}`)));
  out.push("", "### Points d'étape à plusieurs actions — un indice, pas une preuve (décision 10)", "");
  out.push(puce(a.actionsMultiples.map((x) => `\`${x.ticket}\` : ${x.appels.join(", ")} action(s) par appel`)));
  out.push("", "### Santé des fichiers (C3) — correction manuelle", "");
  out.push(
    puce([
      ...a.ticketsIllisibles.map((f) => `ticket illisible : \`tickets/${f}\` (YAML cassé)`),
      ...a.kbIllisibles.map((f) => `entrée de base illisible : \`kb/${f}\` (YAML cassé, invisible à la recherche)`),
      ...a.nomsDiscordants.map((f) => `nom de fichier ≠ id de l'en-tête : \`${f}\` — copie à la main, doublon en base ; supprimer`),
      ...a.domainesInconnus.map((x) => `\`${x.ticket}\` : domaine(s) inconnu(s) du manifeste : ${x.domaines.join(", ")}`),
      ...a.titresMalFormes.map((x) => `\`contexte/${x.fichier}\` : titre(s) sans identifiant, section invisible : ${x.titres.join(" ; ")}`),
      ...a.sectionsEnDouble.map((x) => `\`contexte/${x.fichier}\` : section(s) en double : ${x.sections.join(", ")}`),
    ]),
  );
  out.push("", "### Mesures (T-P7)", "");
  out.push("| Ticket | Nature | Domaine(s) | Questions | Durée active (min) | Résolu par | Statut |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const t of a.tickets.filter((x) => !x.illisible)) {
    out.push(`| ${t.id}${t.reference ? ` (${t.reference})` : ""} | ${t.nature} | ${t.domaines_valides.join(", ") || "—"} | ${t.questions} | ${t.duree ?? "—"} | ${t.resolu_par} | ${t.statut} |`);
  }

  out.push("", "## contexte — Volet contexte", "");
  const total = a.remplissage.remplies + a.remplissage.vides;
  out.push(
    a.remplissage.vides
      ? `_${a.remplissage.vides} section(s) vide(s) sur ${total} — information, pas un constat : l'outil pose la question au moment utile ; \`etat\` les liste, \`/support remplis le contexte\` les remplit._`
      : `_${total} section(s), toutes remplies._`,
    "",
  );
  out.push(`### Sections périmées (> ${JOURS_PEREMPTION} jours) — « toujours vrai ? » : oui → \`update_context\` identique (re-date), non → nouveau contenu`, "");
  out.push(puce(a.perimees.map((p) => `\`${p.section}\` : datée du ${p.date}, ${p.age} j`)));
  out.push("", "### File des candidats — proposé par les tickets, pas encore dans le contexte", "");
  out.push(rendreCandidats(a.candidats));
  out.push("", `### Volumineuses (> ${LIGNES_MAX_SECTION} lignes ou > ${CARACTERES_MAX_SECTION} caractères) — élaguer`, "");
  out.push(puce(a.volumineuses.map((s) => `\`${s}\``)));
  out.push("", "### Placeholders restants — compléter ou retirer", "");
  out.push(puce(a.placeholders.map((s) => `\`${s}\``)));
  out.push("", "### Copies dans `historique/` — signalé seulement (pas de rétention automatique)", "");
  out.push(puce(a.historique.map((h) => `\`${h.fichier}\` : ${h.copies} copie(s)`)));
  return out.join("\n") + "\n";
}

/** Écrit le rapport, daté, une fois (flag wx) : la seule écriture de l'audit. */
export function ecrireAudit(r: Racines, a: Audit): string {
  assurerInstallation(r);
  const c = chemins(r);
  let fichier = path.join(c.audits, `${horodatage(new Date(a.date)).compact}.md`);
  let n = 1;
  while (fs.existsSync(fichier)) fichier = path.join(c.audits, `${horodatage(new Date(a.date)).compact}-${++n}.md`);
  fs.writeFileSync(fichier, `---\ndate: ${a.date}\nconstats: ${nombreConstats(a)}\ntickets: ${a.tickets.length}\n---\n\n${rendreAudit(a)}`, { encoding: "utf8", flag: "wx" });
  return fichier;
}

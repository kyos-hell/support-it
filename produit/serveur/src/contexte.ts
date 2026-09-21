// get_context, update_context et l'état de remplissage. L'index est dérivé
// des titres à chaque appel : il n'existe nulle part sur disque.
//
// Définition de « vide » (conception/format-contexte.md §3) : une section est
// vide si, commentaires retirés, il ne reste rien — ou si son contenu est
// identique à celui du gabarit livré (placeholders jamais touchés).
//
// update_context est la seule écriture sur un fichier existant de tout le
// serveur : elle sauvegarde la version précédente dans contexte/historique/
// et écrit de façon atomique. Elle n'est appelée qu'après validation humaine
// explicite (tenue par le prompt : remplissage.md, cloture.md).
import fs from "node:fs";
import path from "node:path";
import { JOURS_PEREMPTION, chemins, type Racines } from "./config.js";
import { dateDuJour, horodatageCompact } from "./ids.js";
import { lireDocument, sansCommentaires, sections, type Section } from "./markdown.js";

export type EtatSection = "ok" | "vide" | "inconnue";

export interface ResultatSection {
  id: string; // « domaine/section »
  etat: EtatSection;
  titre?: string;
  contenu?: string;
  derniereMiseAJour?: string;
  /** Âge en jours depuis « Dernière mise à jour » ; absent si la section n'a pas de date. */
  ageJours?: number;
  /** Décision 9 : datée de plus de JOURS_PEREMPTION jours — à faire confirmer avant de s'en servir. */
  perimee?: boolean;
  note?: string;
  /** Pour une section vide : la consigne de remplissage du gabarit et son squelette. */
  consigne?: string;
  squelette?: string;
}

const RE_ID = /^([a-z0-9-]+)\/([a-z0-9-]+)$/;
const RE_PLACEHOLDER = /<[^<>\n]{1,80}>/;
const RE_MAJ_LIGNE = /^Dernière mise à jour\s*:.*$/im;

function normaliser(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Âge d'une date AAAA-MM-JJ, en jours entiers ; null si illisible. */
export function ageEnJours(date: string | undefined, maintenant = new Date()): number | null {
  if (!date) return null;
  const t = Date.parse(date.trim().slice(0, 10));
  if (Number.isNaN(t)) return null;
  return Math.floor((maintenant.getTime() - t) / 86400000);
}

function commentaires(brut: string): string {
  const m = brut.match(/<!--[\s\S]*?-->/g) ?? [];
  return m.map((c) => normaliser(c.replace(/^<!--/, "").replace(/-->$/, ""))).join(" ");
}

export function gabaritsLivres(r: Racines): { domaine: string; fichier: string }[] {
  const c = chemins(r);
  const liste = [{ domaine: "general", fichier: c.gabaritGeneral }];
  if (fs.existsSync(c.domaines)) {
    for (const d of fs.readdirSync(c.domaines, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("_")) continue;
      const f = path.join(c.domaines, d.name, "contexte.exemple.md");
      if (fs.existsSync(f)) liste.push({ domaine: d.name, fichier: f });
    }
  }
  return liste;
}

function lireSections(fichier: string): Section[] | null {
  if (!fs.existsSync(fichier)) return null;
  return sections(lireDocument(fs.readFileSync(fichier, "utf8")).corps);
}

interface SectionGabarit {
  titre: string;
  contenuNormalise: string;
  consigne: string;
  squelette: string;
  brut: string;
  aDate: boolean;
}

function sectionsGabarit(r: Racines, domaine: string): Map<string, SectionGabarit> {
  const g = gabaritsLivres(r).find((x) => x.domaine === domaine);
  const m = new Map<string, SectionGabarit>();
  if (!g) return m;
  for (const s of lireSections(g.fichier) ?? []) {
    m.set(s.id, {
      titre: s.titre,
      contenuNormalise: normaliser(s.contenu),
      consigne: commentaires(s.brut),
      squelette: s.contenu,
      brut: s.brut,
      aDate: RE_MAJ_LIGNE.test(s.brut),
    });
  }
  return m;
}

/**
 * « Vide » indépendamment de la version du gabarit (C2) : une fois retirées
 * les lignes qui ne contiennent que des placeholders `<…>`, des séparateurs
 * de table (`|`, `-`, `:`) ou une ligne d'en-tête de table dont toutes les
 * cellules sont des placeholders, il ne reste rien.
 */
export function squeletteSeulement(contenu: string): boolean {
  const lignes = contenu
    .replace(RE_MAJ_LIGNE, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const separateur = (l: string) => /^\|?[\s|:\-]+\|?$/.test(l) && l.includes("-");
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (separateur(l)) continue;
    // L'en-tête d'une table (la ligne juste avant le séparateur) est de la structure, pas du contenu.
    if (l.startsWith("|") && i + 1 < lignes.length && separateur(lignes[i + 1])) continue;
    const sansPlaceholders = l.replace(/<[^<>\n]{1,80}>/g, "");
    if (/^[\s|:\-]*$/.test(sansPlaceholders)) continue; // cellules toutes placeholders
    return false;
  }
  return true;
}

/**
 * La ligne d'en-tête du premier tableau d'un contenu (cellules normalisées),
 * ou null s'il n'y a pas de tableau. EA2 (campagne sans jeu de données) : le
 * modèle a écrit une section jamais servie avec des colonnes inventées ; le
 * serveur compare l'en-tête à celui attendu avant d'écrire.
 */
export function enTeteTableau(contenu: string): string | null {
  const lignes = contenu.split("\n").map((l) => l.trim()).filter(Boolean);
  const separateur = (l: string) => /^\|?[\s|:\-]+\|?$/.test(l) && l.includes("-");
  for (let i = 0; i + 1 < lignes.length; i++) {
    if (lignes[i].startsWith("|") && separateur(lignes[i + 1])) {
      const cellules = lignes[i].replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => normaliser(c).toLowerCase());
      return `| ${cellules.join(" | ")} |`;
    }
  }
  return null;
}

/** Sections d'un fichier de contexte rempli, avec « vide » calculé contre le gabarit et contre le squelette. */
export function sectionsRemplies(r: Racines, domaine: string): Section[] | null {
  const secs = lireSections(path.join(chemins(r).contexte, `${domaine}.md`));
  if (!secs) return null;
  const gabarit = sectionsGabarit(r, domaine);
  return secs.map((s) => ({
    ...s,
    vide: s.vide || normaliser(s.contenu) === gabarit.get(s.id)?.contenuNormalise || squeletteSeulement(s.contenu),
  }));
}

export function obtenirSections(r: Racines, ids: string[]): ResultatSection[] {
  const cache = new Map<string, Section[] | null>();
  const gabarits = new Map<string, Map<string, SectionGabarit>>();
  const gabaritDe = (domaine: string, section: string) => {
    if (!gabarits.has(domaine)) gabarits.set(domaine, sectionsGabarit(r, domaine));
    return gabarits.get(domaine)!.get(section);
  };
  const resultats: ResultatSection[] = [];
  for (const id of ids) {
    const m = id.match(RE_ID);
    if (!m) {
      resultats.push({ id, etat: "inconnue", note: "identifiant attendu au format domaine/section" });
      continue;
    }
    const [, domaine, section] = m;
    if (!cache.has(domaine)) cache.set(domaine, sectionsRemplies(r, domaine));
    const secs = cache.get(domaine);
    const g = gabaritDe(domaine, section);
    if (!secs) {
      resultats.push({
        id,
        etat: "vide",
        titre: g?.titre,
        note: `le fichier de contexte ${domaine}.md n'existe pas dans l'installation — poser la question au technicien`,
        consigne: g?.consigne,
        squelette: g?.squelette,
      });
      continue;
    }
    const s = secs.find((x) => x.id === section);
    if (!s) {
      resultats.push({
        id,
        etat: "inconnue",
        titre: g?.titre,
        note: g
          ? "section prévue par le gabarit mais absente du fichier de contexte (gabarit plus récent) — poser la question ; update_context pourra l'ajouter"
          : "aucune section de cet identifiant dans le fichier de contexte ni dans le gabarit",
        consigne: g?.consigne,
        squelette: g?.squelette,
      });
      continue;
    }
    if (s.vide) {
      resultats.push({
        id,
        etat: "vide",
        titre: s.titre,
        note: "section présente mais non remplie — poser la question au technicien",
        consigne: g?.consigne,
        squelette: g?.squelette,
      });
      continue;
    }
    const age = ageEnJours(s.derniereMiseAJour);
    resultats.push({
      id,
      etat: "ok",
      titre: s.titre,
      contenu: s.contenu,
      derniereMiseAJour: s.derniereMiseAJour,
      ageJours: age ?? undefined,
      perimee: age !== null && age > JOURS_PEREMPTION,
      note: RE_PLACEHOLDER.test(s.contenu)
        ? "contient encore des placeholders <…> : tenir ces valeurs pour inconnues, pas pour vraies"
        : undefined,
    });
  }
  return resultats;
}

export function rendreSections(res: ResultatSection[]): string {
  const out: string[] = [];
  for (const s of res) {
    const titre = s.titre ? ` — ${s.titre}` : "";
    out.push(`### ${s.id}${titre} · ${s.etat}${s.perimee ? " · **PÉRIMÉE, À CONFIRMER**" : ""}`);
    if (s.etat === "ok") {
      if (s.perimee) {
        // E13 (campagne 0.3.0-beta) : en tête, pas en pied — le modèle lisait le
        // contenu et ignorait la note. Une consigne, pas une information.
        out.push(
          `_**Datée du ${s.derniereMiseAJour}, plus de ${JOURS_PEREMPTION} jours : ne pas s'en servir avant d'avoir dit au technicien qu'elle est périmée et obtenu sa réponse** — « toujours vrai ? » oui : update_context avec le contenu identique (le serveur re-date seulement) ; non : update_context avec le nouveau contenu._`,
        );
      }
      out.push(s.contenu ?? "");
      if (s.derniereMiseAJour) out.push(`_Dernière mise à jour : ${s.derniereMiseAJour}_`);
      if (s.note) out.push(`_${s.note}_`);
    } else {
      if (s.note) out.push(`_${s.note}_`);
      if (s.consigne) out.push(`Consigne du gabarit : ${s.consigne}`);
      if (s.squelette) out.push("Squelette attendu :", "```markdown", s.squelette, "```");
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}

// ---- update_context --------------------------------------------------------

export class ErreurContexte extends Error {}

export interface EcritureContexte {
  id: string;
  fichier: string;
  sauvegarde: string | null;
  fichierCree: boolean;
  sectionAjoutee: boolean;
  derniereMiseAJour: string | null;
  /** Décision 9 : le contenu était identique — seule la date a changé, pas de copie dans historique/. */
  confirmee: boolean;
  /** OA2 : la section était vide (squelette) — remplie, pas remplacée ; rien à sauver dans historique/. */
  depuisVide: boolean;
}

export function ecrireSection(r: Racines, id: string, contenu: string): EcritureContexte {
  const m = id.match(RE_ID);
  if (!m) throw new ErreurContexte("identifiant attendu au format domaine/section");
  const [, domaine, section] = m;
  const gabarit = gabaritsLivres(r).find((x) => x.domaine === domaine);
  if (!gabarit) {
    throw new ErreurContexte(
      `domaine « ${domaine} » sans gabarit livré : seuls ${gabaritsLivres(r).map((g) => g.domaine).join(", ")} ont un fichier de contexte.`,
    );
  }
  const propre = sansCommentaires(contenu).replace(RE_MAJ_LIGNE, "").trim();
  if (!propre) throw new ErreurContexte("contenu vide : rien à écrire");
  if (/^## /m.test(propre)) throw new ErreurContexte("le contenu ne doit pas contenir de titre de section « ## » : une section à la fois");

  const c = chemins(r);
  fs.mkdirSync(c.contexte, { recursive: true });
  const fichier = path.join(c.contexte, `${domaine}.md`);
  let fichierCree = false;
  if (!fs.existsSync(fichier)) {
    fs.copyFileSync(gabarit.fichier, fichier);
    fichierCree = true;
  }
  const texte = fs.readFileSync(fichier, "utf8").replace(/\r\n/g, "\n");
  const lignes = texte.split("\n");
  const reTitre = new RegExp(`^## ${section}\\s+[—–-]\\s+`);
  const debut = lignes.findIndex((l) => reTitre.test(l));
  const gab = sectionsGabarit(r, domaine).get(section);

  // EA2 : un tableau se remplit avec les colonnes attendues — celles du
  // squelette si la section est vide ou absente, celles déjà en place sinon.
  // Le modèle ne choisit pas la forme : get_context la lui donne.
  const controlerEnTete = (reference: string) => {
    const attendu = enTeteTableau(reference);
    if (attendu === null) return;
    const recu = enTeteTableau(propre);
    if (recu !== attendu) {
      throw new ErreurContexte(
        `l'en-tête du tableau ne correspond pas à celui attendu pour « ${id} » : attendu « ${attendu} », reçu « ${recu ?? "aucun tableau"} ». Reprendre le squelette servi par get_context(["${id}"]) ; les colonnes ne se changent pas par cet appel.`,
      );
    }
  };

  let nouvelles: string[];
  let sectionAjoutee = false;
  let confirmee = false;
  let depuisVide = false;
  let aDate: boolean;
  if (debut < 0) {
    if (!gab) {
      throw new ErreurContexte(
        `section « ${section} » inconnue du fichier ${domaine}.md et du gabarit : vérifier l'identifiant, ou ajouter la section au gabarit d'abord.`,
      );
    }
    controlerEnTete(gab.squelette);
    // Section prévue par le gabarit mais absente (migration H4) : on l'ajoute en fin de fichier.
    depuisVide = true;
    aDate = gab.aDate;
    const bloc = [`## ${section} — ${gab.titre}`, "", ...gab.brut.match(/<!--[\s\S]*?-->/g) ?? [], "", propre];
    if (aDate) bloc.push("", `Dernière mise à jour : ${dateDuJour()}`);
    nouvelles = [...lignes.join("\n").trimEnd().split("\n"), "", ...bloc, ""];
    sectionAjoutee = true;
  } else {
    let fin = lignes.findIndex((l, i) => i > debut && l.startsWith("## "));
    if (fin < 0) fin = lignes.length;
    const ancien = lignes.slice(debut + 1, fin).join("\n");
    const ancienPropre = sansCommentaires(ancien).replace(RE_MAJ_LIGNE, "").trim();
    const ancienVide = !ancienPropre || normaliser(ancienPropre) === gab?.contenuNormalise || squeletteSeulement(ancienPropre);
    controlerEnTete(ancienVide ? gab?.squelette ?? "" : ancienPropre);
    depuisVide = ancienVide;
    aDate = RE_MAJ_LIGNE.test(ancien) || Boolean(gab?.aDate);
    // Décision 9 : « toujours vrai » = le même contenu ; on repose la date, sans copie dans historique/.
    confirmee = normaliser(sansCommentaires(ancien).replace(RE_MAJ_LIGNE, "")) === normaliser(propre);
    const consignes = ancien.match(/<!--[\s\S]*?-->/g) ?? [];
    const bloc = [lignes[debut], "", ...consignes, ...(consignes.length ? [""] : []), propre];
    if (aDate) bloc.push("", `Dernière mise à jour : ${dateDuJour()}`);
    bloc.push("");
    nouvelles = [...lignes.slice(0, debut), ...bloc, ...lignes.slice(fin)];
  }

  // Sauvegarde de la version précédente, puis écriture atomique. Une confirmation
  // (contenu identique) ne change que la date : rien à sauver. Une section qui
  // était vide non plus (OA2) : la version précédente est le gabarit livré.
  let sauvegarde: string | null = null;
  if (!fichierCree && !confirmee && !depuisVide) {
    const hist = path.join(c.contexte, "historique");
    fs.mkdirSync(hist, { recursive: true });
    sauvegarde = path.join(hist, `${domaine}-${horodatageCompact()}.md`);
    let n = 1;
    while (fs.existsSync(sauvegarde)) sauvegarde = path.join(hist, `${domaine}-${horodatageCompact()}-${++n}.md`);
    fs.copyFileSync(fichier, sauvegarde);
  }
  const tmp = `${fichier}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, nouvelles.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
  fs.renameSync(tmp, fichier);
  return { id, fichier, sauvegarde, fichierCree, sectionAjoutee, derniereMiseAJour: aDate ? dateDuJour() : null, confirmee, depuisVide };
}

// ---- État de remplissage (CLI, script d'installation, skill remplissage) ----

export interface EtatFichier {
  domaine: string;
  fichier: string;
  present: boolean;
  remplies: string[];
  vides: string[];
  /** Sections du gabarit livré absentes du fichier rempli : rapport de migration. */
  manquantes: string[];
  /** Sections du fichier rempli inconnues du gabarit : à signaler, pas une erreur. */
  enPlus: string[];
  /** Sections de plus de LIGNES_MAX_SECTION lignes ou CARACTERES_MAX_SECTION caractères : inventaire déguisé, à élaguer (format-contexte §4.1). */
  volumineuses: string[];
}

export const LIGNES_MAX_SECTION = 40;
/** C1 : le coût est en caractères, pas en lignes — une table de 20 lignes à 400 caractères par cellule passe sous le seuil de lignes. */
export const CARACTERES_MAX_SECTION = 2500;

export function volumineuse(contenu: string): boolean {
  return contenu.split("\n").length > LIGNES_MAX_SECTION || contenu.length > CARACTERES_MAX_SECTION;
}

export function etatRemplissage(r: Racines): EtatFichier[] {
  const c = chemins(r);
  return gabaritsLivres(r).map(({ domaine, fichier }) => {
    const gabarit = (lireSections(fichier) ?? []).map((s) => s.id);
    const cible = path.join(c.contexte, `${domaine}.md`);
    const secs = sectionsRemplies(r, domaine);
    if (!secs) {
      return { domaine, fichier: cible, present: false, remplies: [], vides: gabarit, manquantes: [], enPlus: [], volumineuses: [] };
    }
    const ids = secs.map((s) => s.id);
    return {
      domaine,
      fichier: cible,
      present: true,
      remplies: secs.filter((s) => !s.vide).map((s) => s.id),
      vides: secs.filter((s) => s.vide).map((s) => s.id),
      manquantes: gabarit.filter((id) => !ids.includes(id)),
      enPlus: ids.filter((id) => !gabarit.includes(id)),
      volumineuses: secs.filter((s) => s.contenu.split("\n").length > LIGNES_MAX_SECTION).map((s) => s.id),
    };
  });
}

export function rendreEtat(etats: EtatFichier[]): string {
  const out = ["| Fichier | Remplies | Vides | Manquantes (gabarit plus récent) |", "| --- | --- | --- | --- |"];
  for (const e of etats) {
    const vides = e.present ? e.vides : e.vides;
    out.push(
      `| \`${e.domaine}\`${e.present ? "" : " (fichier absent)"} | ${e.remplies.length ? e.remplies.map((x) => `\`${x}\``).join(", ") : "—"} | ${vides.length ? vides.map((x) => `\`${x}\``).join(", ") : "—"} | ${e.manquantes.length ? e.manquantes.map((x) => `\`${x}\``).join(", ") : "—"} |`,
    );
  }
  const vol = etats.flatMap((e) => e.volumineuses.map((s) => `\`${e.domaine}/${s}\``));
  if (vol.length) {
    out.push("", `Sections volumineuses (plus de ${LIGNES_MAX_SECTION} lignes ou ${CARACTERES_MAX_SECTION} caractères — probablement un inventaire de niveau 3 à élaguer, format-contexte §4.1) : ${vol.join(", ")}`);
  }
  return out.join("\n");
}

/** Tous les identifiants « domaine/section » des gabarits livrés — l'enum des champs `section` (décision 9). */
export function identifiantsSections(r: Racines): string[] {
  const out: string[] = [];
  for (const g of gabaritsLivres(r)) {
    for (const s of lireSections(g.fichier) ?? []) out.push(`${g.domaine}/${s.id}`);
  }
  return out;
}

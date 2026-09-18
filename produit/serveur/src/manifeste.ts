// Le manifeste : ce que le produit déclare sur ses domaines. Écrit à la main,
// validé par script. Il désigne des domaines, jamais des chemins.
import fs from "node:fs";
import YAML from "yaml";
import { chemins, type Racines } from "./config.js";

export type Statut = "beta" | "decrit";

/** Un signal discriminant : le modèle coche l'identifiant, le libellé est ce que le triage lit (décision 2). */
export interface Signal {
  id: string;
  libelle: string;
}

export interface DomaineManifeste {
  id: string;
  libelle: string;
  statut: Statut;
  suit: string;
  signaux: Signal[];
  tags: string[];
}

export interface Manifeste {
  version: number;
  natures: { incident: string; demande: string };
  questions_rattrapage: string[];
  max_domaines: number;
  /** Au plus tant de signaux par domaine (contrôlé par `valider`). */
  max_signaux: number;
  domaines: DomaineManifeste[];
}

/** Identifiant dérivé d'un libellé (ancien format, chaînes nues — manifeste temporaire du smoke, versions antérieures). */
function idDeLibelle(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
}

export function lireManifeste(r: Racines): Manifeste {
  const texte = fs.readFileSync(chemins(r).manifeste, "utf8");
  const m = YAML.parse(texte) as Manifeste;
  if (!m || !Array.isArray(m.domaines)) {
    throw new Error("manifeste.yaml illisible : pas de liste `domaines`");
  }
  m.max_domaines = m.max_domaines ?? 2;
  m.max_signaux = m.max_signaux ?? 6;
  for (const d of m.domaines) {
    const bruts = (d.signaux ?? []) as unknown[];
    d.signaux = bruts.map((x) =>
      typeof x === "string" ? { id: idDeLibelle(x), libelle: x } : { id: String((x as Signal).id ?? ""), libelle: String((x as Signal).libelle ?? "") },
    );
    d.tags = d.tags ?? [];
  }
  return m;
}

/** Tous les identifiants de signaux, dans l'ordre du manifeste — l'enum du schéma de save_progress et save_ticket. */
export function identifiantsSignaux(m: Manifeste): string[] {
  return m.domaines.flatMap((d) => d.signaux.map((s) => s.id));
}

export function libelleSignal(m: Manifeste, id: string): string {
  for (const d of m.domaines) for (const s of d.signaux) if (s.id === id) return s.libelle;
  return id;
}

/**
 * Le classement des domaines depuis les signaux cochés : nombre de signaux
 * par domaine, décroissant, domaines à zéro exclus. C'est le calcul que le
 * triage faisait de tête ; le modèle garde le jugement net / ambigu.
 */
export function classerDomaines(m: Manifeste, ids: string[]): { domaine: string; n: number; signaux: string[] }[] {
  const uniques = [...new Set(ids)];
  return m.domaines
    .map((d) => {
      const coches = d.signaux.filter((s) => uniques.includes(s.id)).map((s) => s.id);
      return { domaine: d.id, n: coches.length, signaux: coches };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

export function trouverDomaine(m: Manifeste, id: string): DomaineManifeste | undefined {
  return m.domaines.find((d) => d.id === id);
}

/** Les identifiants qui ne sont pas des domaines du manifeste (A3). */
export function domainesInconnus(m: Manifeste, ids: string[]): string[] {
  return ids.filter((id) => !trouverDomaine(m, id));
}

/** Rendu markdown du manifeste, tel que le triage le reçoit. */
export function rendreManifeste(m: Manifeste): string {
  const lignes: string[] = [];
  lignes.push("## Natures");
  lignes.push(`- **incident** : ${m.natures.incident}`);
  lignes.push(`- **demande** : ${m.natures.demande}`);
  lignes.push("");
  lignes.push("## Domaines");
  lignes.push("");
  lignes.push("| Domaine | Statut | Le problème suit… | Signaux discriminants |");
  lignes.push("| --- | --- | --- | --- |");
  for (const d of m.domaines) {
    const statut = d.statut === "beta" ? "**couvert**" : "décrit, hors bêta";
    lignes.push(`| \`${d.id}\` — ${d.libelle} | ${statut} | ${d.suit} | ${d.signaux.map((s) => `\`${s.id}\` ${s.libelle}`).join(" · ")} |`);
  }
  lignes.push("");
  lignes.push(`Au plus ${m.max_domaines} domaines par ticket. Un signal se **coche** par son identifiant, avec l'extrait du ticket qui le montre (\`signaux: [{ id, preuve }]\`) ; le serveur classe les domaines depuis les signaux cochés.`);
  lignes.push("");
  lignes.push("## Questions de rattrapage (quand aucun signal n'est présent)");
  m.questions_rattrapage.forEach((q, i) => lignes.push(`${i + 1}. ${q}`));
  return lignes.join("\n");
}

// ---- La bibliothèque de tags (décision 1) --------------------------------------
//
// Deux étages, chaque tag rattaché à un domaine : le produit (les `tags:` du
// manifeste, par domaine) et le client (`installation/tags.yaml`, même forme,
// plus une rubrique `general` pour les transverses — plateformes, outils).
// Le modèle coche dans cette liste, il ne rédige pas ; la liste ne grandit
// que par l'humain (le référent édite tags.yaml).

export interface Bibliotheque {
  /** Tags par domaine, produit ∪ client, sans doublon. */
  parDomaine: Map<string, string[]>;
  /** Tags transverses (client, rubrique `general`) : acceptés quel que soit le domaine. */
  generaux: string[];
  /** Tous les tags cochables, dans l'ordre — l'enum du schéma. */
  tous: string[];
  /** Ce qui n'a pas pu être pris dans tags.yaml : illisible, doublon avec le produit, domaine inconnu. Vide si tout va bien. */
  avertissements: string[];
}

export const RE_TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lit installation/tags.yaml : `{ general: [...], <domaine>: [...] }`. Un fichier absent = étage client vide. */
export function lireTagsClient(r: Racines): { parDomaine: Map<string, string[]>; avertissements: string[] } {
  const fichier = chemins(r).tagsClient;
  const parDomaine = new Map<string, string[]>();
  const avertissements: string[] = [];
  if (!fs.existsSync(fichier)) return { parDomaine, avertissements };
  let brut: unknown;
  try {
    brut = YAML.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    avertissements.push(`tags.yaml illisible (${e instanceof Error ? e.message.split("\n")[0] : String(e)}) : étage client ignoré`);
    return { parDomaine, avertissements };
  }
  if (brut === null || brut === undefined) return { parDomaine, avertissements };
  if (typeof brut !== "object" || Array.isArray(brut)) {
    avertissements.push("tags.yaml : attendu un objet `domaine: [tags]` ; étage client ignoré");
    return { parDomaine, avertissements };
  }
  for (const [domaine, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (!Array.isArray(valeur)) {
      avertissements.push(`tags.yaml : « ${domaine} » n'est pas une liste, ignoré`);
      continue;
    }
    const tags = valeur.map((x) => String(x).trim()).filter(Boolean);
    const mauvais = tags.filter((t) => !RE_TAG.test(t));
    if (mauvais.length) avertissements.push(`tags.yaml : « ${domaine} » : kebab-case attendu, ignorés : ${mauvais.join(", ")}`);
    parDomaine.set(domaine, tags.filter((t) => RE_TAG.test(t)));
  }
  return { parDomaine, avertissements };
}

export function bibliotheque(r: Racines, m: Manifeste): Bibliotheque {
  const client = lireTagsClient(r);
  const avertissements = [...client.avertissements];
  const parDomaine = new Map<string, string[]>();
  const produit = new Set<string>();
  for (const d of m.domaines) {
    parDomaine.set(d.id, [...d.tags]);
    for (const t of d.tags) produit.add(t);
  }
  const generaux: string[] = [];
  for (const [domaine, tags] of client.parDomaine) {
    if (domaine === "general") {
      for (const t of tags) {
        if (produit.has(t)) avertissements.push(`tags.yaml : « ${t} » (general) existe déjà dans le produit, ignoré`);
        else if (!generaux.includes(t)) generaux.push(t);
      }
      continue;
    }
    if (!parDomaine.has(domaine)) {
      avertissements.push(`tags.yaml : domaine inconnu « ${domaine} », ses tags sont ignorés`);
      continue;
    }
    const liste = parDomaine.get(domaine)!;
    for (const t of tags) {
      if (produit.has(t)) avertissements.push(`tags.yaml : « ${t} » (${domaine}) existe déjà dans le produit, ignoré`);
      else if (!liste.includes(t)) liste.push(t);
    }
  }
  const tous: string[] = [];
  for (const liste of parDomaine.values()) for (const t of liste) if (!tous.includes(t)) tous.push(t);
  for (const t of generaux) if (!tous.includes(t)) tous.push(t);
  return { parDomaine, generaux, tous, avertissements };
}

/** Les tags cochables pour un ticket : ceux des domaines donnés, plus les transverses. Sans domaine : toute la bibliothèque. */
export function tagsCandidats(b: Bibliotheque, domaines: string[]): string[] {
  if (!domaines.length) return b.tous;
  const out: string[] = [];
  for (const d of domaines) for (const t of b.parDomaine.get(d) ?? []) if (!out.includes(t)) out.push(t);
  for (const t of b.generaux) if (!out.includes(t)) out.push(t);
  return out;
}

/** Le domaine d'un tag (le premier qui le porte), « general » pour un transverse, null s'il est inconnu. */
export function domaineDuTag(b: Bibliotheque, tag: string): string | null {
  if (b.generaux.includes(tag)) return "general";
  for (const [d, liste] of b.parDomaine) if (liste.includes(tag)) return d;
  return null;
}

/** Distance d'édition bornée, pour proposer les tags proches d'un tag inconnu. */
export function tagsProches(b: Bibliotheque, tag: string, max = 2): string[] {
  const dist = (a: string, c: string): number => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(c.length).fill(0)]);
    for (let j = 1; j <= c.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= c.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === c[j - 1] ? 0 : 1));
      }
    }
    return dp[a.length][c.length];
  };
  return b.tous.filter((t) => dist(t, tag) <= max);
}

/** Vocabulaire de tags connu : identifiants de domaine + tags déclarés (produit seul). */
export function vocabulaire(m: Manifeste): Set<string> {
  const v = new Set<string>();
  for (const d of m.domaines) {
    v.add(d.id);
    for (const t of d.tags) v.add(t);
  }
  return v;
}

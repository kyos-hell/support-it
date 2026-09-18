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

/** Vocabulaire de tags connu : identifiants de domaine + tags déclarés. */
export function vocabulaire(m: Manifeste): Set<string> {
  const v = new Set<string>();
  for (const d of m.domaines) {
    v.add(d.id);
    for (const t of d.tags) v.add(t);
  }
  return v;
}

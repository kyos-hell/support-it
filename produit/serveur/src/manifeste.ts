// Le manifeste : ce que le produit déclare sur ses domaines. Écrit à la main,
// validé par script. Il désigne des domaines, jamais des chemins.
import fs from "node:fs";
import YAML from "yaml";
import { chemins, type Racines } from "./config.js";

export type Statut = "beta" | "decrit";

export interface DomaineManifeste {
  id: string;
  libelle: string;
  statut: Statut;
  suit: string;
  signaux: string[];
  tags: string[];
}

export interface Manifeste {
  version: number;
  natures: { incident: string; demande: string };
  questions_rattrapage: string[];
  max_domaines: number;
  domaines: DomaineManifeste[];
}

export function lireManifeste(r: Racines): Manifeste {
  const texte = fs.readFileSync(chemins(r).manifeste, "utf8");
  const m = YAML.parse(texte) as Manifeste;
  if (!m || !Array.isArray(m.domaines)) {
    throw new Error("manifeste.yaml illisible : pas de liste `domaines`");
  }
  m.max_domaines = m.max_domaines ?? 2;
  for (const d of m.domaines) {
    d.signaux = d.signaux ?? [];
    d.tags = d.tags ?? [];
  }
  return m;
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
    lignes.push(`| \`${d.id}\` — ${d.libelle} | ${statut} | ${d.suit} | ${d.signaux.join(" · ")} |`);
  }
  lignes.push("");
  lignes.push(`Au plus ${m.max_domaines} domaines par ticket.`);
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

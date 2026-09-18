// load_skill : renvoie un périmètre de travail, ses sections requises déjà
// résolues, et sa table selon-cas. Valeurs réservées : triage, cloture, remplissage.
import fs from "node:fs";
import path from "node:path";
import { chemins, type Racines } from "./config.js";
import { etatRemplissage, obtenirSections, rendreEtat, rendreSections } from "./contexte.js";
import { BROUILLONS_LISTES_MAX, listerBrouillons, rendreListe } from "./encours.js";
import { lireManifeste, rendreManifeste, tagsCandidats, trouverDomaine, type Bibliotheque, type Manifeste } from "./manifeste.js";
import { lireDocument, sansCommentaires } from "./markdown.js";

export type Nature = "incident" | "demande";

export interface EnteteSkill {
  domaine: string;
  version: number;
  requis: string[];
  selonCas: Record<string, string[]>;
}

export class ErreurSkill extends Error {}

export function lireEnteteSkill(entete: Record<string, unknown>): EnteteSkill {
  const contexte = (entete.contexte ?? {}) as Record<string, unknown>;
  const requis = Array.isArray(contexte.requis) ? (contexte.requis as string[]) : [];
  const selonBrut = (contexte["selon-cas"] ?? {}) as Record<string, unknown>;
  const selonCas: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(selonBrut)) {
    selonCas[k] = Array.isArray(v) ? (v as string[]) : typeof v === "string" ? [v] : [];
  }
  return {
    domaine: String(entete.domaine ?? ""),
    version: Number(entete.version ?? 0),
    requis,
    selonCas,
  };
}

export function fichierSkill(r: Racines, domaine: string, nature: Nature): string {
  return path.join(chemins(r).domaines, domaine, nature === "incident" ? "skill.md" : "demandes.md");
}

function listeDomaines(m: Manifeste): string {
  return m.domaines
    .map((d) => `\`${d.id}\` (${d.statut === "beta" ? "couvert" : "décrit, hors bêta"})`)
    .join(", ");
}

export type Reserve = "triage" | "cloture" | "remplissage";
const RESERVES: Reserve[] = ["triage", "cloture", "remplissage"];

export interface OptionsChargement {
  biblio?: Bibliotheque;
  /** Les domaines validés (et escalades) du brouillon courant ; null sans brouillon → toute la bibliothèque. */
  domainesValides?: string[] | null;
}

/** Décision 1 : la liste des tags cochables, servie avec `cloture` — filtrée sur les domaines validés quand le serveur les connaît. */
function rendreTagsCandidats(o: OptionsChargement): string {
  if (!o.biblio) return "";
  const domaines = o.domainesValides ?? [];
  const candidats = tagsCandidats(o.biblio, domaines);
  const titre = domaines.length ? `# Tags cochables pour ce ticket (domaines ${domaines.join(", ")} + transverses)` : "# Tags cochables (toute la bibliothèque — aucun brouillon courant)";
  return (
    `\n\n---\n\n${titre}\n\n` +
    (candidats.length ? candidats.map((t) => `\`${t}\``).join(" · ") : "_(aucun)_") +
    "\n\nAu plus cinq, ceux qui distinguent ce cas ; un tag hors liste est refusé. Nature, domaines, escalades et référence sont ajoutés automatiquement."
  );
}

function chargerReserve(r: Racines, nom: Reserve, m: Manifeste, o: OptionsChargement = {}): string {
  const c = chemins(r);
  const fichier = nom === "triage" ? c.triage : nom === "cloture" ? c.cloture : c.remplissage;
  if (!fs.existsSync(fichier)) throw new ErreurSkill(`fichier produit manquant : ${path.basename(fichier)}`);
  const corps = sansCommentaires(lireDocument(fs.readFileSync(fichier, "utf8")).corps).trim();
  if (nom === "triage") {
    return (
      `${corps}\n\n---\n\n# Manifeste des domaines\n\n${rendreManifeste(m)}` +
      `\n\n---\n\n# Tickets en cours (calculé à l'instant)\n\n${rendreListe(listerBrouillons(r), BROUILLONS_LISTES_MAX)}`
    );
  }
  if (nom === "remplissage") {
    return `${corps}\n\n---\n\n# État de remplissage du contexte (calculé à l'instant)\n\n${rendreEtat(etatRemplissage(r))}`;
  }
  if (nom === "cloture") return corps + rendreTagsCandidats(o);
  return corps;
}

export interface SkillRendu {
  texte: string;
  /** Ce que la session note : les domaines (ou le réservé) effectivement chargés. */
  domaines: string[];
  /** Les sections requises servies avec le skill (état ok ou vide : le modèle les a vues). */
  sectionsServies: string[];
}

function chargerDomaine(r: Racines, m: Manifeste, id: string, nature: Nature): { texte: string; sections: string[] } {
  const d = trouverDomaine(m, id);
  if (!d) {
    throw new ErreurSkill(
      `domaine inconnu : \`${id}\`. Domaines du manifeste : ${listeDomaines(m)}. ` +
        `Si le ticket relève d'un domaine décrit mais non couvert, répondre « hors des domaines couverts pour l'instant ».`,
    );
  }
  if (d.statut !== "beta") {
    throw new ErreurSkill(
      `domaine \`${id}\` (${d.libelle}) : décrit dans la taxonomie mais hors bêta, aucun skill livré. ` +
        `Répondre « hors des domaines couverts pour l'instant » et proposer la clôture du ticket avec ce domaine comme conclusion.`,
    );
  }
  const fichier = fichierSkill(r, id, nature);
  if (!fs.existsSync(fichier)) {
    throw new ErreurSkill(`fichier produit manquant pour \`${id}\` / ${nature} : ${path.basename(fichier)}`);
  }
  const doc = lireDocument(fs.readFileSync(fichier, "utf8"));
  const entete = lireEnteteSkill(doc.entete);
  const corps = sansCommentaires(doc.corps).trim();
  const requis = obtenirSections(r, entete.requis);

  const out: string[] = [];
  out.push(`# Skill chargé — \`${id}\` (${nature}, version ${entete.version})`);
  out.push("");
  out.push(corps);
  out.push("");
  out.push("---");
  out.push("");
  out.push("# Contexte entreprise — sections requises (déjà chargées)");
  out.push("");
  out.push(requis.length ? rendreSections(requis) : "_Aucune section requise déclarée._");
  out.push("");
  out.push("# Sections selon le cas — à charger avec `get_context` quand le signal apparaît");
  out.push("");
  const cles = Object.entries(entete.selonCas);
  if (cles.length === 0) out.push("_Aucune._");
  for (const [signal, ids] of cles) {
    out.push(`- **${signal}** → ${ids.map((x) => `\`${x}\``).join(", ")}`);
  }
  return { texte: out.join("\n"), sections: requis.filter((s) => s.etat !== "inconnue").map((s) => s.id) };
}

export function chargerSkills(r: Racines, domaines: string[], nature?: Nature, o: OptionsChargement = {}): SkillRendu {
  const m = lireManifeste(r);
  if (domaines.length === 0) throw new ErreurSkill("aucun domaine demandé");
  const reserves = domaines.filter((d): d is Reserve => (RESERVES as string[]).includes(d));
  if (reserves.length > 0) {
    if (domaines.length !== 1) throw new ErreurSkill("`triage`, `cloture` et `remplissage` se chargent seuls, sans autre domaine");
    return { texte: chargerReserve(r, reserves[0], m, o), domaines: [reserves[0]], sectionsServies: [] };
  }
  if (!nature) throw new ErreurSkill("`nature` est obligatoire pour charger un domaine : incident ou demande");
  // E1 : dédoublonner avant de compter — ["reseau","systeme","reseau"] fait deux domaines.
  const uniques = [...new Set(domaines.map((d) => d.trim().toLowerCase()))];
  if (uniques.length > m.max_domaines) {
    throw new ErreurSkill(
      `au plus ${m.max_domaines} domaines par appel : le triage n'a pas tranché. Poser la question qui discrimine, puis recharger.`,
    );
  }
  const blocs = uniques.map((d) => chargerDomaine(r, m, d, nature));
  const sectionsServies = [...new Set(blocs.flatMap((b) => b.sections))];
  if (blocs.length === 1) return { texte: blocs[0].texte, domaines: uniques, sectionsServies };
  return {
    texte:
      `# Deux domaines chargés : ${uniques.map((d) => `\`${d}\``).join(" et ")}\n\n` +
      `**Discriminer d'abord.** Utiliser les signaux du manifeste pour éliminer un des deux au plus vite — une question au technicien si l'étape 0 ne suffit pas — puis suivre l'ordre du skill survivant, l'autre restant en référence. Jamais deux diagnostics de front.\n\n` +
      blocs.map((b) => b.texte).join("\n\n---\n\n"),
    domaines: uniques,
    sectionsServies,
  };
}

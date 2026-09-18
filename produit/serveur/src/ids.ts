// Identifiants et horodatages : fabriqués par le serveur, jamais par le modèle
// (décision 0.4). Partagés par les tickets et les brouillons en cours.
import os from "node:os";

const RE_ID = /^\d{8}-\d{6}-[a-z0-9]+-[a-z0-9]+(?:-\d+)?$/;

export function propre(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x";
}

const p = (n: number) => String(n).padStart(2, "0");

/**
 * Tout en UTC (A7) : les dates ISO le sont déjà, les identifiants et les
 * noms de fichiers doivent trier dans le même ordre sur deux postes de
 * fuseaux différents. Format inchangé, fichiers existants valides.
 */
export function horodatage(d: Date): { compact: string; iso: string } {
  const compact = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return { compact, iso: d.toISOString() };
}

/** `AAAA-MM-JJ` en UTC : la ligne « Dernière mise à jour » du contexte. */
export function dateDuJour(d = new Date()): string {
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** `AAAAMMJJ-HHMMSS` en UTC : suffixe des copies dans contexte/historique/. */
export function horodatageCompact(d = new Date()): string {
  return horodatage(d).compact;
}

/**
 * Clé de comparaison d'une entrée libre (A2) : minuscules, sans accents ni
 * ponctuation, espaces réduits. Deux reformulations de la même ligne
 * (« Cran 1 : ping OK. » / « cran 1 — ping ok ») ne s'ajoutent pas deux fois.
 */
export function normaliserCle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function utilisateur(): string {
  return os.userInfo().username;
}

export function poste(): string {
  return os.hostname();
}

/** `AAAAMMJJ-HHMMSS-<utilisateur>-<poste>` : unique sans coordination, trie par nom. */
export function fabriquerId(d = new Date()): string {
  const { compact } = horodatage(d);
  return `${compact}-${propre(utilisateur())}-${propre(poste())}`;
}

export function idValide(id: string): boolean {
  return RE_ID.test(id);
}

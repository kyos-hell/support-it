// Identifiants et horodatages : fabriqués par le serveur, jamais par le modèle
// (décision 0.4). Partagés par les tickets et les brouillons en cours.
import os from "node:os";

const RE_ID = /^\d{8}-\d{6}-[a-z0-9]+-[a-z0-9]+(?:-\d+)?$/;

export function propre(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x";
}

export function horodatage(d: Date): { compact: string; iso: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const compact = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return { compact, iso: d.toISOString() };
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

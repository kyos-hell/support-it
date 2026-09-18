// L'état de session (décision 3 du 2026-09-17). Le transport stdio donne un
// processus serveur par session Claude Code : le serveur peut se souvenir de
// ce qu'il a servi. Il sait alors à quel brouillon un appel appartient sans
// que le modèle le dise, refuse un appel hors séquence, et dérive ce que le
// modèle renseignait de mémoire (escalades, étape, sections chargées).
//
// Le disque reste la vérité : l'état est recopié dans le brouillon à chaque
// save_progress et reconstruit depuis lui par resume_ticket ou save_progress(id).
// Aucune dépendance vers les autres modules.

export interface Session {
  /** Id du brouillon courant : posé par save_progress ou resume_ticket, vidé par save_ticket. */
  brouillonCourant: string | null;
  /**
   * Un élément par appel load_skill : « triage », « reseau », « reseau+systeme »,
   * « cloture »… Les domaines d'un appel sont joints par « + ». L'ordre est
   * celui des appels : c'est la chaîne d'escalade.
   */
  skillsCharges: string[];
  /** Sections de contexte servies (requis d'un skill, ou get_context). */
  sectionsServies: string[];
  /** Cas de la base lus par read_kb, dans l'ordre. */
  casLus: string[];
  /** Un search_kb a eu lieu pour ce brouillon. */
  rechercheFaite: boolean;
}

export const RESERVES = ["triage", "cloture", "remplissage", "audit"] as const;

export function nouvelleSession(): Session {
  return { brouillonCourant: null, skillsCharges: [], sectionsServies: [], casLus: [], rechercheFaite: false };
}

/** Ce qu'un brouillon garde de l'état, écrit par le serveur seulement. */
export interface EtatBrouillon {
  skills_charges: string[];
  sections_servies: string[];
  cas_lus: string[];
  recherche_faite: boolean;
}

export function etatDepuisSession(s: Session): EtatBrouillon {
  return {
    skills_charges: [...s.skillsCharges],
    sections_servies: [...s.sectionsServies],
    cas_lus: [...s.casLus],
    recherche_faite: s.rechercheFaite,
  };
}

/** Reprise : l'état est celui du brouillon, l'état mémoire est remplacé. */
export function reconstruire(s: Session, id: string, e: EtatBrouillon): void {
  s.brouillonCourant = id;
  s.skillsCharges = [...e.skills_charges];
  s.sectionsServies = [...e.sections_servies];
  s.casLus = [...e.cas_lus];
  s.rechercheFaite = e.recherche_faite;
}

/** Fusion sans doublon, l'ordre existant d'abord (pour recopier l'état dans un brouillon qui en a déjà un). */
export function fusionnerEtat(existant: EtatBrouillon, s: Session): EtatBrouillon {
  const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];
  return {
    skills_charges: union(existant.skills_charges, s.skillsCharges),
    sections_servies: union(existant.sections_servies, s.sectionsServies),
    cas_lus: union(existant.cas_lus, s.casLus),
    recherche_faite: existant.recherche_faite || s.rechercheFaite,
  };
}

export function vider(s: Session): void {
  const neuf = nouvelleSession();
  s.brouillonCourant = neuf.brouillonCourant;
  s.skillsCharges = neuf.skillsCharges;
  s.sectionsServies = neuf.sectionsServies;
  s.casLus = neuf.casLus;
  s.rechercheFaite = neuf.rechercheFaite;
}

export function noterSkill(s: Session, domaines: string[]): void {
  const cle = domaines.join("+");
  if (!s.skillsCharges.includes(cle)) s.skillsCharges.push(cle);
}

export function noterSection(s: Session, id: string): void {
  if (!s.sectionsServies.includes(id)) s.sectionsServies.push(id);
}

/** Une section réécrite par update_context n'est plus « déjà servie » : le modèle doit la relire. */
export function oublierSection(s: Session, id: string): void {
  s.sectionsServies = s.sectionsServies.filter((x) => x !== id);
}

export function noterCas(s: Session, id: string): void {
  if (!s.casLus.includes(id)) s.casLus.push(id);
}

/** Les domaines instruits, dans l'ordre de premier chargement (les réservés exclus). */
export function domainesInstruits(skills: string[]): string[] {
  const out: string[] = [];
  for (const k of skills) {
    if ((RESERVES as readonly string[]).includes(k)) continue;
    for (const d of k.split("+")) if (!out.includes(d)) out.push(d);
  }
  return out;
}

/**
 * Les escalades dérivées : tout domaine chargé après le premier appel de
 * domaine, qui n'était pas dans ce premier appel. Le deuxième load_skill
 * d'un domaine sur le même brouillon *est* une escalade (décision 3, point 5).
 */
export function escaladesDerivees(skills: string[]): string[] {
  const appels = skills.filter((k) => !(RESERVES as readonly string[]).includes(k));
  if (appels.length <= 1) return [];
  const vus = new Set(appels[0].split("+"));
  const out: string[] = [];
  for (const k of appels.slice(1)) {
    for (const d of k.split("+")) {
      if (!vus.has(d)) {
        vus.add(d);
        out.push(d);
      }
    }
  }
  return out;
}

export function skillCharge(skills: string[], nom: string): boolean {
  return skills.includes(nom);
}

export function casInstruit(skills: string[]): boolean {
  return domainesInstruits(skills).length > 0;
}

// Lecture déterministe des fichiers markdown du produit et de l'installation :
// en-tête YAML, sections « ## id — titre », commentaires HTML, date de mise à jour.
import YAML from "yaml";

export interface Document {
  entete: Record<string, unknown>;
  corps: string;
}

export interface Section {
  id: string;
  titre: string;
  /** Contenu sans les commentaires HTML, sans la ligne « Dernière mise à jour ». */
  contenu: string;
  /** Lignes brutes de la section, commentaires compris (pour les consignes). */
  brut: string;
  vide: boolean;
  derniereMiseAJour?: string;
}

const RE_TITRE = /^## ([a-z0-9]+(?:-[a-z0-9]+)*)\s+[—–-]\s+(.+?)\s*$/;
const RE_MAJ = /^Dernière mise à jour\s*:\s*(.+?)\s*$/im;

export function lireDocument(texte: string): Document {
  const t = texte.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return { entete: {}, corps: t };
  const fin = t.indexOf("\n---", 4);
  if (fin < 0) return { entete: {}, corps: t };
  const yamlTexte = t.slice(4, fin);
  const corps = t.slice(fin + 4).replace(/^\n/, "");
  let entete: Record<string, unknown> = {};
  try {
    const parse = YAML.parse(yamlTexte);
    if (parse && typeof parse === "object") entete = parse as Record<string, unknown>;
  } catch {
    entete = {};
  }
  return { entete, corps };
}

export function sansCommentaires(texte: string): string {
  return texte.replace(/<!--[\s\S]*?-->/g, "");
}

/** Découpe un corps en sections de niveau 2 au format « ## id — titre ». */
export function sections(corps: string): Section[] {
  const lignes = corps.replace(/\r\n/g, "\n").split("\n");
  const resultat: Section[] = [];
  let courante: { id: string; titre: string; lignes: string[] } | null = null;
  const clore = () => {
    if (!courante) return;
    const brut = courante.lignes.join("\n");
    const propre = sansCommentaires(brut);
    const maj = propre.match(RE_MAJ)?.[1];
    const contenu = propre.replace(RE_MAJ, "").trim();
    resultat.push({
      id: courante.id,
      titre: courante.titre,
      contenu,
      brut,
      vide: contenu.length === 0,
      derniereMiseAJour: maj,
    });
  };
  for (const l of lignes) {
    const m = l.match(RE_TITRE);
    if (m) {
      clore();
      courante = { id: m[1], titre: m[2], lignes: [] };
    } else if (l.startsWith("## ")) {
      // Titre de niveau 2 mal formé : on le ferme comme section anonyme pour
      // que la validation puisse le signaler, sans le rendre adressable.
      clore();
      courante = { id: "", titre: l.slice(3).trim(), lignes: [] };
    } else if (courante) {
      courante.lignes.push(l);
    }
  }
  clore();
  return resultat.filter((s) => s.id !== "");
}

/** Titres de niveau 2 qui ne suivent pas la convention — pour la validation. */
export function titresMalFormes(corps: string): string[] {
  return corps
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => l.startsWith("## ") && !RE_TITRE.test(l));
}

export function compterLignes(texte: string): number {
  return texte.replace(/\r\n/g, "\n").split("\n").filter((_, i, a) => !(i === a.length - 1 && _ === "")).length;
}

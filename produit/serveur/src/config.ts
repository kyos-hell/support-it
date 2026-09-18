// Résolution des deux racines. Aucun chemin absolu dans le code : le serveur
// se situe lui-même (produit/serveur/dist → produit/), et l'installation est
// soit donnée par l'environnement, soit à côté de produit/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Racines {
  produit: string;
  installation: string;
}

export function racines(): Racines {
  const ici = path.dirname(fileURLToPath(import.meta.url)); // …/produit/serveur/dist
  const produitDefaut = path.resolve(ici, "..", "..");
  const produit = process.env.SUPPORT_IT_PRODUIT
    ? path.resolve(process.env.SUPPORT_IT_PRODUIT)
    : produitDefaut;
  const installation = process.env.SUPPORT_IT_INSTALLATION
    ? path.resolve(process.env.SUPPORT_IT_INSTALLATION)
    : path.resolve(produit, "..", "installation");
  return { produit, installation };
}

/**
 * produit/contenu/ est tout ce que le modèle lit, et rien d'autre :
 *   contenu/manifeste.yaml
 *   contenu/general/{triage,cloture,contexte.exemple}.md   ← id de contexte « general »
 *   contenu/domaines/<id>/{skill,demandes,contexte.exemple}.md
 * Le contexte de X se résout donc toujours en contenu/<X>/contexte.exemple.md,
 * X valant « general » ou « domaines/<id> ».
 */
export function chemins(r: Racines) {
  const contenu = path.join(r.produit, "contenu");
  return {
    contenu,
    manifeste: path.join(contenu, "manifeste.yaml"),
    version: path.join(r.produit, "VERSION"),
    general: path.join(contenu, "general"),
    triage: path.join(contenu, "general", "triage.md"),
    cloture: path.join(contenu, "general", "cloture.md"),
    remplissage: path.join(contenu, "general", "remplissage.md"),
    domaines: path.join(contenu, "domaines"),
    gabaritGeneral: path.join(contenu, "general", "contexte.exemple.md"),
    contexte: path.join(r.installation, "contexte"),
    tickets: path.join(r.installation, "tickets"),
    enCours: path.join(r.installation, "en-cours"),
    kb: path.join(r.installation, "kb"),
    journal: path.join(r.installation, "journal"),
    /** L'étage client de la bibliothèque de tags (décision 1) : créé vide par init, édité par le référent. */
    tagsClient: path.join(r.installation, "tags.yaml"),
  };
}

export function lireVersion(r: Racines): string {
  try {
    return fs.readFileSync(chemins(r).version, "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

/** Crée les dossiers de l'installation s'ils manquent. Seule écriture hors ticket. */
export function assurerInstallation(r: Racines): void {
  const c = chemins(r);
  for (const d of [c.contexte, c.tickets, c.kb, c.journal, c.enCours]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

// Outillage hors serveur : les contrôles qui rendent le produit livrable.
// Lancés avant chaque livraison ; le serveur ne les exécute jamais à l'usage.
import fs from "node:fs";
import path from "node:path";
import { chemins, type Racines } from "./config.js";
import { lireManifeste } from "./manifeste.js";
import { compterLignes, lireDocument, sections, titresMalFormes } from "./markdown.js";
import { lireEnteteSkill } from "./skills.js";

export interface Constat {
  niveau: "erreur" | "avertissement";
  ou: string;
  message: string;
}

const LONGUEUR_CIBLE = 100;
const LONGUEUR_MAX = 110;
const SECTIONS_TRANSVERSES_LIBRES = ["contacts-escalade", "referents"];
/** Décision 10 : présentes mot pour mot dans chaque skill.md et demandes.md. */
export const REGLES_DE_CONDUITE = ["**Une question, puis j'attends la réponse.**", "**Une commande, puis j'attends la sortie.**"];

// Ce qui ressemble à une donnée d'entreprise. Volontairement simple et
// lisible : un faux positif se corrige en reformulant, un faux négatif coûte
// une fuite chez un client.
const MOTIFS_DONNEES = [
  { nom: "adresse IPv4", re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { nom: "chemin UNC", re: /\\\\[A-Za-z0-9_.-]+\\/ },
  { nom: "adresse mail", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
  { nom: "nom de domaine interne", re: /\b[a-z0-9-]+\.(?:local|lan|corp|intra|internal)\b/i },
  { nom: "nom d'hôte plausible", re: /\b(?:srv|svr|dc|fw|sw|esx|vm|nas|prx|proxy|mail)-?[a-z]*-?\d{2,}\b/i },
];

function lire(f: string): string {
  return fs.readFileSync(f, "utf8");
}

function fichiersMarkdown(dossier: string, exclure: (p: string) => boolean): string[] {
  const out: string[] = [];
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (exclure(p)) continue;
      if (e.isDirectory()) marcher(p);
      else if (e.name.endsWith(".md") || e.name.endsWith(".yaml")) out.push(p);
    }
  };
  marcher(dossier);
  return out;
}

export function valider(r: Racines): Constat[] {
  const c = chemins(r);
  const constats: Constat[] = [];
  const err = (ou: string, message: string) => constats.push({ niveau: "erreur", ou, message });
  const avert = (ou: string, message: string) => constats.push({ niveau: "avertissement", ou, message });
  const rel = (p: string) => path.relative(r.produit, p).replace(/\\/g, "/");

  // 1. Fichiers produit indispensables.
  if (!fs.existsSync(c.contenu)) err("contenu/", "dossier du contenu livré manquant");
  for (const f of [c.manifeste, c.version, c.triage, c.cloture, c.remplissage, c.gabaritGeneral]) {
    if (!fs.existsSync(f)) err(rel(f), "fichier livré manquant");
  }
  const entree = path.join(r.produit, "entrees", "claude-code", "support", "SKILL.md");
  if (!fs.existsSync(entree)) err(rel(entree), "point d'entrée /support manquant");
  else {
    const doc = lireDocument(lire(entree));
    if (!doc.entete.name || !doc.entete.description) err(rel(entree), "en-tête SKILL.md : name et description obligatoires");
    if (compterLignes(doc.corps) > 15) avert(rel(entree), "le point d'entrée dépasse quinze lignes : l'intelligence doit rester derrière le serveur");
  }
  for (const f of [c.triage, c.cloture]) {
    if (fs.existsSync(f) && compterLignes(lire(f)) > LONGUEUR_MAX + 20) {
      avert(rel(f), `dépasse ${LONGUEUR_MAX + 20} lignes`);
    }
  }
  // PowerShell 5.1 lit un .ps1 sans BOM en ANSI : les guillemets français
  // cassent alors une chaîne (trouvé au test T-H1). Le BOM est obligatoire.
  const ps1 = path.join(r.produit, "install.ps1");
  if (!fs.existsSync(ps1)) err("install.ps1", "script d'installation Windows manquant");
  else {
    const b = fs.readFileSync(ps1);
    if (!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)) err("install.ps1", "doit être enregistré en UTF-8 avec BOM (PowerShell 5.1)");
  }
  const sh = path.join(r.produit, "install.sh");
  if (!fs.existsSync(sh)) err("install.sh", "script d'installation Linux/macOS manquant");
  else if (fs.readFileSync(sh, "utf8").includes("\r")) err("install.sh", "contient des retours chariot : fins de ligne LF obligatoires (bash refuse un script CRLF)");
  if (constats.some((x) => x.niveau === "erreur")) return constats;

  // 2. Manifeste contre dossiers.
  let manifeste;
  try {
    manifeste = lireManifeste(r);
  } catch (e) {
    err(rel(c.manifeste), e instanceof Error ? e.message : String(e));
    return constats;
  }
  const dossiers = fs.existsSync(c.domaines)
    ? fs.readdirSync(c.domaines, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name)
    : [];
  const signauxVus = new Map<string, string>();
  for (const d of manifeste.domaines) {
    if (!/^[a-z0-9-]+$/.test(d.id)) err(rel(c.manifeste), `identifiant de domaine invalide : ${d.id}`);
    if (d.statut === "beta") {
      for (const f of ["skill.md", "demandes.md", "contexte.exemple.md"]) {
        if (!fs.existsSync(path.join(c.domaines, d.id, f))) err(`domaines/${d.id}/${f}`, `domaine en bêta sans ${f}`);
      }
      if (d.signaux.length === 0) avert(rel(c.manifeste), `domaine ${d.id} sans signaux discriminants`);
      // Décision 2 : identifiants kebab-case, uniques dans tout le manifeste, au plus max_signaux par domaine.
      if (d.signaux.length > manifeste.max_signaux) err(rel(c.manifeste), `domaine ${d.id} : ${d.signaux.length} signaux, au plus ${manifeste.max_signaux} — un signal discrimine, il ne catalogue pas`);
      for (const sg of d.signaux) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sg.id)) err(rel(c.manifeste), `signal « ${sg.id} » (${d.id}) : identifiant kebab-case attendu`);
        if (!sg.libelle.trim()) err(rel(c.manifeste), `signal « ${sg.id} » (${d.id}) : libellé vide`);
        if (signauxVus.has(sg.id)) err(rel(c.manifeste), `signal « ${sg.id} » en double : déjà dans ${signauxVus.get(sg.id)}`);
        signauxVus.set(sg.id, d.id);
      }
    } else if (dossiers.includes(d.id)) {
      avert(rel(c.manifeste), `domaine ${d.id} déclaré « décrit » mais un dossier existe : passer en bêta ou retirer le dossier`);
    }
  }
  for (const d of dossiers) {
    if (!manifeste.domaines.some((x) => x.id === d)) err(`domaines/${d}`, "dossier de domaine absent du manifeste");
  }

  // 3. Gabarits : index des sections et forme des titres.
  const sectionsGabarit = new Map<string, string[]>();
  const gabarits: { domaine: string; fichier: string }[] = [{ domaine: "general", fichier: c.gabaritGeneral }];
  for (const d of dossiers) gabarits.push({ domaine: d, fichier: path.join(c.domaines, d, "contexte.exemple.md") });
  for (const g of gabarits) {
    if (!fs.existsSync(g.fichier)) continue;
    const texte = lire(g.fichier);
    const doc = lireDocument(texte);
    for (const t of titresMalFormes(doc.corps)) err(rel(g.fichier), `titre de section hors convention « ## id — titre » : ${t}`);
    const secs = sections(doc.corps);
    const ids = secs.map((s) => s.id);
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const d of doublons) err(rel(g.fichier), `section en double : ${d}`);
    sectionsGabarit.set(g.domaine, ids);
    if (/<!--/.test(texte) === false) avert(rel(g.fichier), "aucune consigne de remplissage en commentaire HTML");
    const exemplesRealistes = texte.match(/`[a-z]+-[a-z]+-\d{2}`/g);
    if (exemplesRealistes) avert(rel(g.fichier), `exemple ressemblant à du vrai : ${exemplesRealistes.join(", ")}`);
  }

  // 4. Skills : en-tête, contrat B/C dans les deux sens, selon-cas cités, longueur.
  const declarees = new Set<string>();
  for (const d of manifeste.domaines.filter((x) => x.statut === "beta")) {
    for (const nom of ["skill.md", "demandes.md"]) {
      const f = path.join(c.domaines, d.id, nom);
      if (!fs.existsSync(f)) continue;
      const texte = lire(f);
      const doc = lireDocument(texte);
      const ent = lireEnteteSkill(doc.entete);
      if (ent.domaine !== d.id) err(rel(f), `en-tête : domaine « ${ent.domaine} » ≠ dossier « ${d.id} »`);
      if (!ent.version) err(rel(f), "en-tête : version manquante");
      const n = compterLignes(texte);
      if (n > LONGUEUR_MAX) err(rel(f), `${n} lignes : au-delà de ${LONGUEUR_MAX}, scinder ou couper`);
      else if (n > LONGUEUR_CIBLE) avert(rel(f), `${n} lignes : au-delà de la cible de ${LONGUEUR_CIBLE}`);
      // Décision 10 : les deux règles de conduite, mot pour mot (format-skill §6).
      for (const regle of REGLES_DE_CONDUITE) {
        if (!doc.corps.includes(regle)) err(rel(f), `règle de conduite absente : « ${regle} »`);
      }
      const tous = [...ent.requis, ...Object.values(ent.selonCas).flat()];
      for (const id of tous) {
        declarees.add(id);
        const m = id.match(/^([a-z0-9-]+)\/([a-z0-9-]+)$/);
        if (!m) {
          err(rel(f), `identifiant de section invalide : ${id}`);
          continue;
        }
        const secs = sectionsGabarit.get(m[1]);
        if (!secs) err(rel(f), `${id} : aucun gabarit pour le domaine « ${m[1]} »`);
        else if (!secs.includes(m[2])) err(rel(f), `${id} : section absente du gabarit ${m[1]}`);
      }
      for (const [cle, ids] of Object.entries(ent.selonCas)) {
        const cite = ids.some((id) => doc.corps.includes(`\`${id}\``) || doc.corps.includes(id));
        if (!cite) avert(rel(f), `clé selon-cas « ${cle} » : aucune de ses sections n'est citée dans le corps`);
      }
      const tags = manifeste.domaines.find((x) => x.id === d.id)?.tags ?? [];
      if (nom === "skill.md") {
        for (const cle of Object.keys(ent.selonCas)) {
          if (!tags.includes(cle)) avert(rel(c.manifeste), `tag « ${cle} » du skill ${d.id} absent des tags du manifeste`);
        }
      }
    }
  }
  for (const [domaine, ids] of sectionsGabarit) {
    for (const id of ids) {
      const complet = `${domaine}/${id}`;
      if (domaine === "general" && SECTIONS_TRANSVERSES_LIBRES.includes(id)) continue;
      if (!declarees.has(complet)) avert(`gabarit ${domaine}`, `section « ${complet} » déclarée par aucun skill`);
    }
  }

  // 5. Aucune donnée d'entreprise dans contenu/ — tout ce que le modèle lit,
  // sans exception ni filtre de chemin.
  const fichiers = fichiersMarkdown(c.contenu, () => false);
  for (const f of fichiers) {
    const lignes = lire(f).split(/\r?\n/);
    lignes.forEach((l, i) => {
      for (const m of MOTIFS_DONNEES) {
        const hit = l.match(m.re);
        if (hit) err(`${rel(f)}:${i + 1}`, `${m.nom} — « ${hit[0]} »`);
      }
    });
  }

  return constats;
}

export function rendreConstats(constats: Constat[]): string {
  if (constats.length === 0) return "Validation : aucun constat. Le produit est livrable.";
  const erreurs = constats.filter((c) => c.niveau === "erreur");
  const lignes = constats.map((c) => `${c.niveau === "erreur" ? "ERREUR " : "avert. "} ${c.ou} — ${c.message}`);
  lignes.push("");
  lignes.push(`${erreurs.length} erreur(s), ${constats.length - erreurs.length} avertissement(s).`);
  return lignes.join("\n");
}

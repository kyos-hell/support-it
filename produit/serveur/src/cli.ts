#!/usr/bin/env node
// Ligne de commande du produit : tout ce que les scripts d'installation
// délèguent au code pour n'avoir qu'une implémentation (décision 0.4).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assurerInstallation, chemins, lireVersion, racines } from "./config.js";
import { etatRemplissage, gabaritsLivres } from "./contexte.js";
import { ageJours, JOURS_BROUILLON_ANCIEN, lireEnCours } from "./encours.js";
import { rendreConstats, valider } from "./validation.js";

const r = racines();
const c = chemins(r);
const commande = process.argv[2] ?? "aide";

function aide(): void {
  console.log(`support-it ${lireVersion(r)}
Usage : node dist/cli.js <commande>

  chemins      Affiche les deux racines résolues (produit, installation).
  valider      Contrôles de livraison : manifeste, contrat B/C, longueurs, données d'entreprise.
  tester       Test de fumée du serveur construit (écrit seulement dans un dossier temporaire).
  init         Initialise installation/ : dossiers et gabarits copiés — n'écrase jamais un fichier existant ;
               note la version du produit dans installation/VERSION et annonce une mise à jour.
  etat         État de remplissage du contexte, par fichier et par section.
  enregistrer  Enregistre le serveur MCP dans ~/.claude.json (portée utilisateur), avec sauvegarde.
  entree       Installe le point d'entrée /support dans ~/.claude/skills/support/.

Variables : SUPPORT_IT_PRODUIT, SUPPORT_IT_INSTALLATION (défauts : le dossier produit/ du serveur, et installation/ à côté).`);
}

/** installation/VERSION : la version du produit qui a initialisé ou mis à jour cette installation. */
function versionInstallation(): string | null {
  const f = path.join(r.installation, "VERSION");
  try {
    return fs.readFileSync(f, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function init(): void {
  const avant = versionInstallation();
  const version = lireVersion(r);
  assurerInstallation(r);
  const copies: string[] = [];
  const gardes: string[] = [];
  for (const g of gabaritsLivres(r)) {
    const cible = path.join(c.contexte, `${g.domaine}.md`);
    if (fs.existsSync(cible)) {
      gardes.push(cible);
      continue;
    }
    fs.copyFileSync(g.fichier, cible);
    copies.push(cible);
  }
  fs.writeFileSync(path.join(r.installation, "VERSION"), `${version}\n`, "utf8");
  console.log(`installation : ${r.installation}`);
  if (avant === null) console.log(`  mode : ${gardes.length ? "REJOINDRE" : "INITIALISER"} — produit ${version}`);
  else if (avant !== version) console.log(`  mode : MISE À JOUR ${avant} → ${version}`);
  else console.log(`  mode : REJOINDRE — déjà en ${version}`);
  for (const f of copies) console.log(`  copié   ${f}`);
  for (const f of gardes) console.log(`  gardé   ${f} (existant, non touché)`);
  if (!copies.length) console.log("  aucun nouveau gabarit à copier");
  console.log(`  dossiers : contexte/, en-cours/, tickets/, kb/, journal/`);
}

/** Lance le test de fumée du serveur construit : n'écrit que dans un dossier temporaire. */
function tester(): number {
  const smoke = path.join(path.dirname(fileURLToPath(import.meta.url)), "test", "smoke.js");
  if (!fs.existsSync(smoke)) {
    console.error(`test de fumée absent : ${smoke} (serveur non construit ?)`);
    return 1;
  }
  const res = spawnSync(process.execPath, [smoke], { stdio: "inherit", env: { ...process.env, SUPPORT_IT_PRODUIT: r.produit } });
  return res.status ?? 1;
}

function etat(): number {
  let vides = 0;
  console.log(`Contexte entreprise — ${r.installation}`);
  for (const e of etatRemplissage(r)) {
    if (!e.present) {
      console.log(`  ${e.domaine.padEnd(10)} ABSENT — lancer « init » ou copier le gabarit ; ${e.vides.length} section(s) seront demandées au technicien`);
      vides += e.vides.length;
      continue;
    }
    console.log(`  ${e.domaine.padEnd(10)} ${e.remplies.length} remplie(s), ${e.vides.length} vide(s)`);
    if (e.vides.length) console.log(`             vides : ${e.vides.join(", ")}`);
    if (e.manquantes.length) console.log(`             MANQUANTES (gabarit plus récent que le fichier) : ${e.manquantes.join(", ")}`);
    if (e.enPlus.length) console.log(`             en plus (inconnues du gabarit) : ${e.enPlus.join(", ")}`);
    if (e.volumineuses.length) console.log(`             VOLUMINEUSES (> 40 lignes ou > 2 500 car., inventaire à élaguer ?) : ${e.volumineuses.join(", ")}`);
    vides += e.vides.length;
  }
  const enCours = lireEnCours(r);
  console.log(`Tickets en cours : ${enCours.actifs.length}`);
  for (const b of enCours.actifs) {
    const age = ageJours(b);
    console.log(`  ${(b.reference ?? "—").padEnd(14)} ${b.id}  ${b.technicien}  ${b.etape}  ${age} j${age >= JOURS_BROUILLON_ANCIEN ? "  ANCIEN : à clôturer ou reprendre" : ""}`);
  }
  for (const b of enCours.zombies) console.log(`  ZOMBIE  ${b.id} : le ticket est déjà clôturé, le brouillon reste dans en-cours/ (ignoré ; supprimer à la main)`);
  for (const f of enCours.orphelins) console.log(`  ORPHELIN  ${f} : pas d'en-tête lisible (ignoré ; supprimer à la main)`);
  console.log(
    vides === 0
      ? "Contexte complet."
      : `${vides} section(s) vide(s) : l'outil fonctionne, il posera la question au technicien au moment utile. Remplir avant le premier ticket est recommandé, pas obligatoire.`,
  );
  return 0;
}

function enregistrer(): number {
  const fichier = path.join(os.homedir(), ".claude.json");
  let config: Record<string, unknown> = {};
  if (fs.existsSync(fichier)) {
    fs.copyFileSync(fichier, `${fichier}.support-it.bak`);
    try {
      config = JSON.parse(fs.readFileSync(fichier, "utf8")) as Record<string, unknown>;
    } catch {
      console.error(`~/.claude.json illisible : enregistrement refusé, rien n'a été modifié (sauvegarde : ${fichier}.support-it.bak)`);
      return 1;
    }
  }
  const serveurs = (config.mcpServers ?? {}) as Record<string, unknown>;
  const dist = path.dirname(fileURLToPath(import.meta.url));
  serveurs["support-it"] = {
    type: "stdio",
    command: "node",
    args: [path.join(dist, "index.js")],
    env: { SUPPORT_IT_PRODUIT: r.produit, SUPPORT_IT_INSTALLATION: r.installation },
  };
  config.mcpServers = serveurs;
  fs.writeFileSync(fichier, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`serveur MCP « support-it » enregistré dans ${fichier} (portée utilisateur)`);
  console.log(`  commande : node ${path.join(dist, "index.js")}`);
  console.log(`  produit  : ${r.produit}`);
  console.log(`  install. : ${r.installation}`);
  console.log("Redémarrer Claude Code pour qu'il voie le serveur.");
  return 0;
}

function entree(): number {
  const source = path.join(r.produit, "entrees", "claude-code", "support", "SKILL.md");
  if (!fs.existsSync(source)) {
    console.error(`point d'entrée absent du produit : ${source}`);
    return 1;
  }
  const dossier = path.join(os.homedir(), ".claude", "skills", "support");
  fs.mkdirSync(dossier, { recursive: true });
  fs.copyFileSync(source, path.join(dossier, "SKILL.md"));
  console.log(`point d'entrée /support installé : ${path.join(dossier, "SKILL.md")}`);
  return 0;
}

let code = 0;
switch (commande) {
  case "chemins":
    console.log(`produit      : ${r.produit}\ninstallation : ${r.installation}\nversion      : ${lireVersion(r)}`);
    break;
  case "valider": {
    const constats = valider(r);
    console.log(rendreConstats(constats));
    code = constats.some((x) => x.niveau === "erreur") ? 1 : 0;
    break;
  }
  case "tester":
    code = tester();
    break;
  case "init":
    init();
    break;
  case "etat":
    code = etat();
    break;
  case "enregistrer":
    code = enregistrer();
    break;
  case "entree":
    code = entree();
    break;
  default:
    aide();
    code = commande === "aide" ? 0 : 2;
}
process.exit(code);

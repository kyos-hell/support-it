#!/usr/bin/env node
// Ligne de commande du produit : tout ce que les scripts d'installation
// délèguent au code pour n'avoir qu'une implémentation (décision 0.4).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculerAudit, constatsSante, ecrireAudit, nombreConstats, rendreAudit } from "./audit.js";
import { assurerInstallation, chemins, lireVersion, racines } from "./config.js";
import { etatRemplissage, gabaritsLivres } from "./contexte.js";
import { ageJours, JOURS_BROUILLON_ANCIEN, lireEnCours } from "./encours.js";
import { bibliotheque, lireManifeste } from "./manifeste.js";
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
  audit        Le rapport d'audit (tickets, base, brouillons, contexte) : affiché et écrit dans installation/audits/ ;
               code 1 si un constat de santé des fichiers (C3) est trouvé. Le même rapport que /support audit.
  enregistrer  Enregistre le serveur MCP dans ~/.claude.json (portée utilisateur), avec sauvegarde.
  entree       Installe le point d'entrée /support dans ~/.claude/skills/support/.
  hote         Dépose .claude/settings.json dans le dossier de lancement (permissions refusées au modèle), en fusionnant.

Variables : SUPPORT_IT_PRODUIT, SUPPORT_IT_INSTALLATION (défauts : le dossier produit/ du serveur, et installation/ à côté).`);
}

/** Le tags.yaml livré vide : la consigne en commentaire, une rubrique par domaine. */
const TAGS_YAML_VIDE = `# Tags propres à l'entreprise (décision 1 du 2026-09-14) : application maison,
# site, outil interne, plateforme. Même forme que le manifeste du produit : une
# liste par domaine, plus « general » pour les tags transverses (plateformes,
# outils) acceptés quel que soit le domaine. kebab-case ASCII. Un tag déjà
# présent dans le produit est ignoré ici. Cette liste ne grandit que par la
# main du référent : le modèle coche dedans, il ne propose rien.
#
# general: [m365, azure]
# reseau: [vpn-site-a-site]
# applicatif: [app-compta]
general: []
`;

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
  // L'étage client des tags : créé vide avec sa consigne, jamais écrasé.
  let tagsCrees = false;
  if (!fs.existsSync(c.tagsClient)) {
    fs.writeFileSync(c.tagsClient, TAGS_YAML_VIDE, "utf8");
    tagsCrees = true;
  }
  console.log(`installation : ${r.installation}`);
  if (avant === null) console.log(`  mode : ${gardes.length ? "REJOINDRE" : "INITIALISER"} — produit ${version}`);
  else if (avant !== version) console.log(`  mode : MISE À JOUR ${avant} → ${version}`);
  else console.log(`  mode : REJOINDRE — déjà en ${version}`);
  for (const f of copies) console.log(`  copié   ${f}`);
  for (const f of gardes) console.log(`  gardé   ${f} (existant, non touché)`);
  if (!copies.length) console.log("  aucun nouveau gabarit à copier");
  console.log(`  ${tagsCrees ? "créé    " : "gardé   "}${c.tagsClient}${tagsCrees ? " (étage client des tags, vide)" : " (existant, non touché)"}`);
  console.log(`  dossiers : contexte/, en-cours/, tickets/, kb/, journal/, audits/`);
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
  // L'étage client des tags : lisible, sans doublon avec le produit.
  const b = bibliotheque(r, lireManifeste(r));
  const nClient = b.generaux.length + [...b.parDomaine.entries()].reduce((n, [d, l]) => n + l.length - (lireManifeste(r).domaines.find((x) => x.id === d)?.tags.length ?? 0), 0);
  console.log(`Tags : ${b.tous.length} cochables, dont ${nClient} de l'entreprise (${fs.existsSync(c.tagsClient) ? "tags.yaml" : "tags.yaml ABSENT — lancer « init »"})`);
  for (const a of b.avertissements) console.log(`  AVERTISSEMENT ${a}`);
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

/** Décision 8 : le même rapport que load_skill(["audit"]), lisible sans modèle. */
function audit(): number {
  const a = calculerAudit(r);
  const fichier = ecrireAudit(r, a);
  console.log(rendreAudit(a));
  console.log(`Rapport écrit : ${fichier}`);
  const sante = constatsSante(a);
  console.log(`${nombreConstats(a)} constat(s), dont ${sante} de santé des fichiers (C3).`);
  return sante > 0 ? 1 : 0;
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

/**
 * Décision 5 : ce que Claude Code ne peut plus faire là où un appel MCP
 * existe. Dépose `<dossier de lancement>/.claude/settings.json` — le dossier
 * de lancement est le parent de produit/, d'où le technicien lance Claude
 * Code — en fusionnant : les entrées `deny` manquantes sont ajoutées, rien
 * n'est retiré, le reste du fichier est intact, l'ancien est sauvegardé.
 */
function hote(): number {
  const modele = path.join(r.produit, "entrees", "claude-code", "settings.json");
  if (!fs.existsSync(modele)) {
    console.error(`modèle de settings.json absent du produit : ${modele}`);
    return 1;
  }
  const lancement = path.resolve(r.produit, "..");
  const dossier = path.join(lancement, ".claude");
  const fichier = path.join(dossier, "settings.json");
  const livre = JSON.parse(fs.readFileSync(modele, "utf8")) as { permissions: { deny: string[] } };
  // Les motifs livrés visent /installation/** relatif au dossier de lancement.
  // Si l'installation est ailleurs (partage réseau), on vise son chemin absolu (forme //).
  const relatif = path.relative(lancement, r.installation).replace(/\\/g, "/");
  const dedans = relatif && !relatif.startsWith("..") && !path.isAbsolute(relatif);
  const racineMotif = dedans ? `/${relatif}` : `//${r.installation.replace(/\\/g, "/").replace(/^\/+/, "")}`;
  const deny = livre.permissions.deny.map((d) => d.replace("/installation", racineMotif));

  let config: Record<string, unknown> = {};
  let existant = false;
  if (fs.existsSync(fichier)) {
    existant = true;
    try {
      config = JSON.parse(fs.readFileSync(fichier, "utf8")) as Record<string, unknown>;
    } catch {
      console.error(`${fichier} illisible : rien n'a été modifié. Corriger le JSON, puis relancer « hote ».`);
      return 1;
    }
  }
  const permissions = (config.permissions ?? {}) as Record<string, unknown>;
  const actuels = Array.isArray(permissions.deny) ? (permissions.deny as unknown[]).map(String) : [];
  const ajoutes = deny.filter((d) => !actuels.includes(d));
  permissions.deny = [...actuels, ...ajoutes];
  config.permissions = permissions;
  fs.mkdirSync(dossier, { recursive: true });
  if (existant) fs.copyFileSync(fichier, `${fichier}.support-it.bak`);
  fs.writeFileSync(fichier, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`permissions Claude Code : ${fichier}${existant ? " (fusionné, sauvegarde .support-it.bak)" : " (créé)"}`);
  console.log(`  dossier de lancement : ${lancement} — lancer Claude Code depuis là`);
  console.log(`  ${ajoutes.length ? `ajouté : ${ajoutes.join(", ")}` : "déjà en place, rien ajouté"}`);
  if (!dedans) console.log(`  installation hors du dossier de lancement : motifs absolus (${racineMotif}) — à vérifier au premier ticket`);
  console.log("  interdit au modèle : écrire dans installation/ (Edit, Write), lire kb/ et en-cours/ directement, exécuter une commande (Bash, PowerShell).");
  console.log("  Le serveur MCP écrit, Claude Code ne contourne plus. Redémarrer Claude Code.");
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
  case "audit":
    code = audit();
    break;
  case "enregistrer":
    code = enregistrer();
    break;
  case "entree":
    code = entree();
    break;
  case "hote":
    code = hote();
    break;
  default:
    aide();
    code = commande === "aide" ? 0 : 2;
}
process.exit(code);

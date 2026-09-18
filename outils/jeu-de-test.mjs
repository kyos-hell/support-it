#!/usr/bin/env node
// Générateur du jeu de données de test (plan-after-beta.md §3.1).
//
// Pilote le serveur MCP construit (produit/serveur/dist) par le client MCP,
// comme le smoke : tout ce qui entre dans l'installation est fabriqué par le
// serveur, au format courant, avec de vrais identifiants. Les anomalies
// « édition » sont posées après, par modification directe des fichiers, et
// listées dans le YAML. Aucune donnée réelle : « Exemple SAS » est fictive.
//
// Usage : node outils/jeu-de-test.mjs [--reinitialiser]
//   SUPPORT_IT_INSTALLATION : le dossier cible (défaut : installation/ à la racine du dépôt).
//   Refuse un dossier non vide sans --reinitialiser (qui le vide d'abord).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const produit = path.join(racine, "produit");
const serveur = path.join(produit, "serveur");
const dist = path.join(serveur, "dist");
const installation = path.resolve(process.env.SUPPORT_IT_INSTALLATION ?? path.join(racine, "installation"));
const reinitialiser = process.argv.includes("--reinitialiser");

// Les dépendances du serveur, pas de node_modules ici.
const require = createRequire(path.join(serveur, "package.json"));
const YAML = require("yaml");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const jeu = YAML.parse(fs.readFileSync(path.join(racine, "outils", "jeu-de-test.yaml"), "utf8"));

function echec(message) {
  console.error(`jeu-de-test : ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(dist, "index.js"))) echec("serveur non construit : npm run build dans produit/serveur");
if (fs.existsSync(installation) && fs.readdirSync(installation).length > 0) {
  if (!reinitialiser) echec(`${installation} n'est pas vide : --reinitialiser pour le vider d'abord`);
  fs.rmSync(installation, { recursive: true, force: true });
}
fs.mkdirSync(installation, { recursive: true });

const env = { ...process.env, SUPPORT_IT_PRODUIT: produit, SUPPORT_IT_INSTALLATION: installation };

function cli(commande) {
  const res = spawnSync(process.execPath, [path.join(dist, "cli.js"), commande], { env, encoding: "utf8" });
  if (res.status !== 0 && commande !== "audit") echec(`cli ${commande} : code ${res.status}\n${res.stdout}\n${res.stderr}`);
  return res;
}

/** Un client = un processus serveur = une session. Un par ticket : l'état de session repart de zéro. */
async function ouvrir(nom) {
  const c = new Client({ name: nom, version: "0" });
  await c.connect(
    new StdioClientTransport({ command: process.execPath, args: [path.join(dist, "index.js")], env, stderr: "pipe" }),
  );
  return c;
}

function texte(res) {
  return (res.content ?? []).map((c) => c.text ?? "").join("\n");
}

async function appel(client, name, args, ou) {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) echec(`${ou} — ${name} refusé :\n${texte(res)}`);
  return texte(res);
}

const dateMoins = (jours, minutes = 0) => new Date(Date.now() - jours * 86400000 - minutes * 60000).toISOString();
const jourMoins = (jours) => dateMoins(jours).slice(0, 10);

const journal = [];
const log = (l) => {
  journal.push(l);
  console.log(l);
};

async function main() {
  // 1. init : dossiers, gabarits, tags.yaml — puis l'étage client du jeu.
  cli("init");
  fs.writeFileSync(
    path.join(installation, "tags.yaml"),
    "# Étage client du jeu de test (outils/jeu-de-test.yaml)\n" + YAML.stringify(jeu.tags_client),
    "utf8",
  );
  log(`init : ${installation}`);

  // 2. Le contexte : une session, un update_context par section.
  const clientCtx = await ouvrir("jeu-contexte");
  let nSections = 0;
  for (const [section, contenu] of Object.entries(jeu.contexte)) {
    await appel(clientCtx, "update_context", { section, contenu }, `contexte ${section}`);
    nSections++;
  }
  // Anomalie 16 : general/sites écrite trois fois → trois copies de general.md dans historique/.
  for (let i = 0; i < 2; i++) {
    await appel(clientCtx, "update_context", { section: "general/sites", contenu: jeu.contexte["general/sites"] + `| Site temporaire ${i + 1} | test | — | 0 |\n` }, "general/sites (copie)");
  }
  await appel(clientCtx, "update_context", { section: "general/sites", contenu: jeu.contexte["general/sites"] }, "general/sites (final)");
  await clientCtx.close();
  log(`contexte : ${nSections} section(s) écrite(s)`);

  // 3. Les tickets, un par session, dans l'ordre du YAML.
  const ids = new Map(); // référence → id
  let nTickets = 0;
  let nPublies = 0;
  for (const t of jeu.tickets) {
    const ou = t.reference;
    const c = await ouvrir(`jeu-${t.reference}`);
    const premier = t.premier_domaine ?? t.domaines[0];
    const proposes = t.proposes ?? t.domaines;
    await appel(c, "load_skill", { domaines: ["triage"] }, ou);
    const creation = {
      reference: t.reference,
      symptome_initial: t.symptome,
      nature: t.nature,
      domaines_proposes: proposes,
      domaines_valides: t.domaines,
      prochaine_etape: "charger le skill",
      ...(t.signaux ? { signaux: t.signaux } : {}),
    };
    const rep = await appel(c, "save_progress", creation, `${ou} création`);
    const id = rep.match(/Brouillon créé : (\S+) ·/)?.[1];
    if (!id) echec(`${ou} : id du brouillon introuvable dans « ${rep.slice(0, 120)} »`);
    ids.set(t.reference, id);
    await appel(c, "load_skill", { domaines: [premier], nature: t.nature }, `${ou} skill`);
    if (t.selon_cas) await appel(c, "get_context", { sections: [t.selon_cas] }, `${ou} get_context`);
    await appel(c, "save_progress", { id, verifications: t.verifications ?? [], questions: t.questions ?? [], prochaine_etape: "instruire" }, `${ou} instruction`);
    // Escalade : le second domaine chargé après le premier — le serveur la dérive.
    for (const d of t.domaines) if (d !== premier) await appel(c, "load_skill", { domaines: [d], nature: t.nature }, `${ou} escalade ${d}`);
    if (t.contradictions) await appel(c, "save_progress", { id, contradictions: t.contradictions }, `${ou} contradictions`);
    await appel(c, "search_kb", { tags: t.recherche }, `${ou} recherche`);
    if (t.lit) {
      const idLu = ids.get(t.lit);
      if (!idLu) echec(`${ou} lit ${t.lit} : pas encore généré`);
      await appel(c, "read_kb", { ticket_id: idLu }, `${ou} lecture`);
    }
    await appel(c, "save_progress", { id, plan_action: t.plan, prochaine_etape: "appliquer le plan, une commande à la fois" }, `${ou} plan`);
    if (t.actions_en_un_appel) await appel(c, "save_progress", { id, actions: t.actions }, `${ou} actions (un appel)`);
    else for (const a of t.actions ?? []) await appel(c, "save_progress", { id, actions: [a], prochaine_etape: "action suivante" }, `${ou} action`);
    // Durée : le brouillon est antidaté (seule édition en cours de route), le serveur calcule création → clôture.
    if (t.duree) {
      const f = path.join(installation, "en-cours", `${id}.md`);
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^cree: .*$/m, `cree: ${dateMoins(0, t.duree)}`), "utf8");
    }
    await appel(c, "load_skill", { domaines: ["cloture"] }, `${ou} cloture`);
    const cloture = {
      symptome_initial: t.symptome,
      nature: t.nature,
      domaines_proposes: proposes,
      domaines_valides: t.domaines,
      conclusion: t.conclusion,
      plan_action: t.plan,
      statut: t.statut ?? "resolu",
      tags: t.tags ?? [],
      ...(t.resolu_par ? { resolu_par: t.resolu_par } : {}),
      ...(t.mises_a_jour_contexte ? { mises_a_jour_contexte: t.mises_a_jour_contexte } : {}),
    };
    const repClot = await appel(c, "save_ticket", cloture, `${ou} save_ticket`);
    if (!repClot.includes(`Ticket enregistré : ${id}`)) echec(`${ou} : le ticket n'a pas repris l'id du brouillon — ${repClot.slice(0, 200)}`);
    nTickets++;
    if (t.publier !== false) {
      await appel(c, "publish_kb", { ticket_id: id }, `${ou} publish_kb`);
      nPublies++;
    }
    await c.close();
    log(`ticket ${t.reference} → ${id}${t.publier === false ? " (non publié)" : ""}`);
  }

  // 4. Les anomalies « édition » (numéros du YAML).
  const enCours = path.join(installation, "en-cours");
  const tickets = path.join(installation, "tickets");
  const kb = path.join(installation, "kb");
  const contexte = path.join(installation, "contexte");
  const lire = (f) => fs.readFileSync(f, "utf8");
  const ecrire = (f, s) => fs.writeFileSync(f, s, "utf8");

  // 1 : un brouillon EX-2001, en instruction, reculé de 45 jours.
  {
    const c = await ouvrir("jeu-anomalie-1");
    await appel(c, "load_skill", { domaines: ["triage"] }, "EX-2001");
    const rep = await appel(
      c,
      "save_progress",
      { reference: "EX-2001", symptome_initial: "Le wifi invités ne donne plus d'adresse au Siège", nature: "incident", signaux: [{ id: "population-lieu-lien", preuve: "les invités du Siège" }], domaines_proposes: ["reseau"], domaines_valides: ["reseau"], prochaine_etape: "cran 2 : DHCP invités" },
      "EX-2001 création",
    );
    const id = rep.match(/Brouillon créé : (\S+) ·/)[1];
    await appel(c, "load_skill", { domaines: ["reseau"], nature: "incident" }, "EX-2001 skill");
    await appel(c, "save_progress", { id, verifications: ["cran 1 : bornes associées, pas d'adresse"], prochaine_etape: "cran 2 : DHCP invités sur fw-siege" }, "EX-2001 instruction");
    await c.close();
    const f = path.join(enCours, `${id}.md`);
    ecrire(f, lire(f).replace(/^derniere_mise_a_jour: .*$/m, `derniere_mise_a_jour: ${dateMoins(45)}`).replace(/^cree: .*$/m, `cree: ${dateMoins(46)}`));
    ids.set("EX-2001", id);
    log(`anomalie 1 : brouillon EX-2001 → ${id}, reculé de 45 jours`);
  }
  // 2 : zombie — copie du ticket EX-1005 dans en-cours/.
  fs.copyFileSync(path.join(tickets, `${ids.get("EX-1005")}.md`), path.join(enCours, `${ids.get("EX-1005")}.md`));
  log("anomalie 2 : zombie (EX-1005)");
  // 3 : orphelin.
  ecrire(path.join(enCours, "orphelin.md"), "# Un fichier sans en-tête\n\nrien d'exploitable ici\n");
  log("anomalie 3 : orphelin.md");
  // 5 : tag hors bibliothèque dans l'entrée EX-1009.
  {
    const f = path.join(kb, `${ids.get("EX-1009")}.md`);
    ecrire(f, lire(f).replace(/^tags:\n/m, "tags:\n  - identite-manageee\n"));
    log("anomalie 5 : tag identite-manageee dans kb (EX-1009)");
  }
  // 6 : domaine inconnu dans le ticket EX-1008.
  {
    const f = path.join(tickets, `${ids.get("EX-1008")}.md`);
    ecrire(f, lire(f).replace(/^domaines_valides:\n  - materiel$/m, "domaines_valides:\n  - cloud"));
    log("anomalie 6 : domaines_valides [cloud] dans le ticket EX-1008");
  }
  // 7 : entrée kb illisible — copie de EX-1010 sans le second ---.
  {
    const s = lire(path.join(kb, `${ids.get("EX-1010")}.md`));
    ecrire(path.join(kb, "casse.md"), s.replace(/\n---\n\n# Ticket/, "\n\n# Ticket"));
    log("anomalie 7 : kb/casse.md (YAML cassé)");
  }
  // 8 : reseau/acces-distant datée de 120 jours (topologie n'a pas de ligne de date dans le gabarit).
  {
    const f = path.join(contexte, "reseau.md");
    const s = lire(f);
    const debut = s.indexOf("## acces-distant");
    const fin = s.indexOf("\n## ", debut + 1);
    const bloc = s.slice(debut, fin).replace(/Dernière mise à jour : \d{4}-\d{2}-\d{2}/, `Dernière mise à jour : ${jourMoins(120)}`);
    ecrire(f, s.slice(0, debut) + bloc + s.slice(fin));
    log("anomalie 8 : reseau/acces-distant datée de 120 jours");
  }
  // 13 : un placeholder dans systeme/serveurs.
  {
    const f = path.join(contexte, "systeme.md");
    ecrire(f, lire(f).replace("| srv-bkp-01 | sauvegarde | Siège | physique | appliance | console web |", "| srv-bkp-01 | sauvegarde | Siège | physique | <à compléter> | console web |"));
    log("anomalie 13 : placeholder dans systeme/serveurs");
  }
  // 14 : titre sans identifiant dans general.md.
  fs.appendFileSync(path.join(contexte, "general.md"), "\n## Sites\n\nUn titre ajouté à la main, sans identifiant : la section est invisible pour le serveur.\n", "utf8");
  log("anomalie 14 : ## Sites dans general.md");
  // 15 : dns-dhcp dupliquée dans reseau.md.
  {
    const f = path.join(contexte, "reseau.md");
    const s = lire(f);
    const debut = s.indexOf("## dns-dhcp");
    const fin = s.indexOf("\n## ", debut + 1);
    ecrire(f, s.trimEnd() + "\n\n" + s.slice(debut, fin).trimEnd() + "\n");
    log("anomalie 15 : dns-dhcp en double dans reseau.md");
  }

  // 5. Le bilan.
  const res = cli("audit");
  const constats = res.stdout.match(/(\d+) constat\(s\), dont (\d+) de santé/);
  log("");
  log(`Jeu de test généré dans ${installation}`);
  log(`  sections : ${nSections} écrites sur 45 (materiel/salles-techniques laissée vide)`);
  log(`  tickets  : ${nTickets} clôturés, ${nPublies} publiés, ${ids.size - nTickets} brouillon(s)`);
  log(`  audit    : ${constats ? `${constats[1]} constat(s), dont ${constats[2]} de santé des fichiers` : "(rapport non lu)"} — les 19 anomalies du YAML, chacune dans sa rubrique (le compteur compte par élément) ; le premier rapport est dans audits/`);
  log(`  identifiants : ${[...ids.entries()].map(([r, i]) => `${r}=${i}`).join(" ")}`);
  fs.writeFileSync(path.join(installation, "jeu-de-test.log"), journal.join("\n") + "\n", "utf8");
}

main().catch((e) => echec(e instanceof Error ? e.stack ?? e.message : String(e)));

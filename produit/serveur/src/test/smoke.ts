// Test de fumée : lance le serveur sur une installation temporaire et joue
// les neuf appels dans l'ordre du flux, sur les six domaines livrés. Le cas
// « domaine décrit, hors bêta » n'existe plus dans le produit réel depuis la
// bêta v2 : il est rejoué sur une copie temporaire du produit à laquelle on
// ajoute un domaine décrit. Aucune écriture hors des dossiers temporaires.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ECART_ACTIF_MAX_MINUTES, dureeActiveMinutes } from "../tickets.js";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const produit = process.env.SUPPORT_IT_PRODUIT ?? path.resolve(dist, "..", "..");
const installation = fs.mkdtempSync(path.join(os.tmpdir(), "support-it-smoke-"));
const DOMAINES = ["reseau", "systeme", "poste-de-travail", "materiel", "identite", "applicatif"];

/** Copie contenu/ et VERSION dans un dossier temporaire et y ajoute un domaine décrit, hors bêta. */
function produitAvecDomaineDecrit(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "support-it-smoke-produit-"));
  fs.cpSync(path.join(produit, "contenu"), path.join(tmp, "contenu"), { recursive: true });
  fs.copyFileSync(path.join(produit, "VERSION"), path.join(tmp, "VERSION"));
  fs.appendFileSync(
    path.join(tmp, "contenu", "manifeste.yaml"),
    "\n  - id: exemple-decrit\n    libelle: Exemple décrit\n    statut: decrit\n    suit: rien, domaine de test\n    signaux: []\n    tags: []\n",
  );
  return tmp;
}

/** Un client = un processus serveur = une session (stdio). */
async function ouvrir(nom: string, produitPour: string): Promise<Client> {
  const c = new Client({ name: nom, version: "0" });
  await c.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(dist, "index.js")],
      env: { ...process.env, SUPPORT_IT_PRODUIT: produitPour, SUPPORT_IT_INSTALLATION: installation } as Record<string, string>,
      stderr: "pipe",
    }),
  );
  return c;
}

function texte(res: unknown): string {
  const r = res as { content: { type: string; text?: string }[]; isError?: boolean };
  return r.content.map((c) => c.text ?? "").join("\n");
}
function estErreur(res: unknown): boolean {
  return Boolean((res as { isError?: boolean }).isError);
}
/**
 * Un refus du schéma (enum, longueur) arrive avant notre code : le SDK le
 * rend comme une erreur -32602 « Input validation error » — en résultat
 * isError selon la version, en exception sinon.
 */
async function refusSchema(p: Promise<unknown>, motif: RegExp, message: string): Promise<void> {
  let brut: string;
  try {
    const res = await p;
    assert.ok(estErreur(res), `${message} : accepté alors que le schéma devait refuser — ${texte(res)}`);
    brut = texte(res);
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e;
    brut = String(e);
  }
  assert.match(brut, /-32602|Input validation|Invalid/, message);
  assert.match(brut, motif, message);
}

async function main() {
  // Contexte : gabarits copiés, puis une section remplie pour tester l'état « ok ».
  fs.mkdirSync(path.join(installation, "contexte"), { recursive: true });
  // L'étage client des tags (décision 1) : un transverse, un tag réseau, un tag applicatif, un doublon avec le produit (ignoré).
  fs.writeFileSync(path.join(installation, "tags.yaml"), "general: [m365]\nreseau: [vpn-site-a-site]\napplicatif: [app-compta]\nsysteme: [sauvegarde]\n", "utf8");
  const contenu = path.join(produit, "contenu");
  fs.copyFileSync(path.join(contenu, "general", "contexte.exemple.md"), path.join(installation, "contexte", "general.md"));
  fs.copyFileSync(path.join(contenu, "domaines", "reseau", "contexte.exemple.md"), path.join(installation, "contexte", "reseau.md"));
  const general = fs.readFileSync(path.join(installation, "contexte", "general.md"), "utf8");
  fs.writeFileSync(
    path.join(installation, "contexte", "general.md"),
    general.replace("| <nom> | <ville / bâtiment> | <type de lien vers les autres sites> | <nombre> |", "| SITE-TEST | VILLE-TEST | LIEN-TEST | 42 |"),
  );

  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(dist, "index.js")],
      env: { ...process.env, SUPPORT_IT_PRODUIT: produit, SUPPORT_IT_INSTALLATION: installation } as Record<string, string>,
      stderr: "pipe",
    }),
  );

  const outils = await client.listTools();
  assert.deepEqual(
    outils.tools.map((t) => t.name).sort(),
    ["get_context", "load_skill", "publish_kb", "read_kb", "resume_ticket", "save_progress", "save_ticket", "search_kb", "update_context"],
    "neuf appels, ni plus ni moins",
  );

  // 1. Triage.
  const triage = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.ok(!estErreur(triage));
  assert.match(texte(triage), /Manifeste des domaines/);
  assert.match(texte(triage), /`reseau`/);
  for (const d of DOMAINES) assert.match(texte(triage), new RegExp("`" + d + "` — [^|]+\\| \\*\\*couvert\\*\\*"), `${d} couvert au manifeste`);
  // E10 (campagne 0.3.0-beta) : hors-perimetre est décrit sans dossier, avec ses signaux.
  assert.match(texte(triage), /`hors-perimetre` — [^|]+\| décrit, hors bêta \|[^|]+\| `travaux-batiment`/, "hors-perimetre décrit au manifeste");
  const horsPerimetre = await client.callTool({ name: "load_skill", arguments: { domaines: ["hors-perimetre"], nature: "demande" } });
  assert.ok(estErreur(horsPerimetre) && /hors des domaines couverts/.test(texte(horsPerimetre)), texte(horsPerimetre));
  assert.match(texte(triage), /Tickets en cours[\s\S]*Aucun ticket en cours/);

  // 2. Domaine inconnu, domaine hors bêta, nature manquante, trois domaines.
  const inconnu = await client.callTool({ name: "load_skill", arguments: { domaines: ["cloud"], nature: "incident" } });
  assert.ok(estErreur(inconnu) && /domaine inconnu/.test(texte(inconnu)));
  const dejaBeta = await client.callTool({ name: "load_skill", arguments: { domaines: ["materiel"], nature: "incident" } });
  assert.ok(!estErreur(dejaBeta), "materiel est en bêta depuis la v2 : " + texte(dejaBeta));
  const sansNature = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau"] } });
  assert.ok(estErreur(sansNature) && /nature/.test(texte(sansNature)));
  // E1 : dédoublonné avant de compter — ["reseau","systeme","reseau"] fait deux domaines, pas trois.
  const doublon = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau", "systeme", "reseau"], nature: "incident" } });
  assert.ok(!estErreur(doublon) && /Deux domaines chargés/.test(texte(doublon)), texte(doublon));
  const trop = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau", "systeme", "identite"], nature: "incident" } });
  assert.ok(estErreur(trop) && /au plus 2/.test(texte(trop)));

  // 3. Skill réseau, incident : corps + requis résolus (sites rempli, topologie vide).
  const reseau = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau"], nature: "incident" } });
  assert.ok(!estErreur(reseau), texte(reseau));
  const tr = texte(reseau);
  assert.match(tr, /Ordre de diagnostic/);
  assert.match(tr, /general\/sites — Sites et implantations · ok/);
  assert.match(tr, /SITE-TEST/);
  assert.match(tr, /reseau\/topologie — Topologie du réseau · vide/);
  assert.match(tr, /general\/criticite-services[^\n]*· vide/);
  assert.match(tr, /\*\*vpn\*\* → `reseau\/acces-distant`/);
  assert.doesNotMatch(tr, /<!--/, "les commentaires HTML ne doivent jamais sortir");

  // 3b. Deux domaines, demande : système n'a pas de fichier de contexte → vide avec note.
  const deux = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau", "systeme"], nature: "demande" } });
  assert.ok(!estErreur(deux), texte(deux));
  assert.match(texte(deux), /Discriminer d'abord/);
  assert.match(texte(deux), /creation-partage/);
  assert.match(texte(deux), /systeme\/serveurs[^\n]*· vide/);

  // 3c. Les quatre domaines de la bêta v2 : skill et demandes se chargent, requis résolus, selon-cas cités.
  const attendus: Record<string, { requis: string; selon: string; demande: string }> = {
    identite: { requis: "identite/annuaires", selon: "synchronisation", demande: "creation-compte" },
    "poste-de-travail": { requis: "poste-de-travail/parc", selon: "profil", demande: "installation-logiciel" },
    materiel: { requis: "materiel/parc-materiel", selon: "sav", demande: "remplacement-materiel" },
    applicatif: { requis: "applicatif/catalogue", selon: "integration", demande: "habilitation-applicative" },
  };
  for (const [d, a] of Object.entries(attendus)) {
    const inc = await client.callTool({ name: "load_skill", arguments: { domaines: [d], nature: "incident" } });
    assert.ok(!estErreur(inc), `${d} incident : ${texte(inc)}`);
    const ti = texte(inc);
    assert.match(ti, /Ordre de diagnostic/, `${d} : ordre de diagnostic`);
    assert.match(ti, /Escalade — ce n'est pas chez moi si/, `${d} : escalade`);
    assert.match(ti, new RegExp(a.requis.replace("/", "\\/") + " — [^\\n]*· vide"), `${d} : requis ${a.requis} résolu (fichier absent → vide)`);
    assert.match(ti, new RegExp("\\*\\*" + a.selon + "\\*\\* → `" + d + "\\/"), `${d} : table selon-cas`);
    assert.doesNotMatch(ti, /<!--/, `${d} : pas de commentaire HTML`);
    const dem = await client.callTool({ name: "load_skill", arguments: { domaines: [d], nature: "demande" } });
    assert.ok(!estErreur(dem), `${d} demande : ${texte(dem)}`);
    assert.match(texte(dem), new RegExp("## Demande — " + a.demande), `${d} : demande ${a.demande}`);
    assert.match(texte(dem), /Gabarit de plan d'action/, `${d} : gabarit de plan`);
  }
  // Les deux domaines qui se disputent « je ne peux plus ouvrir ma session ».
  const paire = await client.callTool({ name: "load_skill", arguments: { domaines: ["identite", "poste-de-travail"], nature: "incident" } });
  assert.ok(!estErreur(paire), texte(paire));
  assert.match(texte(paire), /Discriminer d'abord/);

  // 4. get_context : ok, vide, inconnue, fichier absent.
  const ctx = await client.callTool({
    name: "get_context",
    arguments: { sections: ["general/sites", "reseau/dns-dhcp", "reseau/nexiste-pas", "systeme/serveurs"] },
  });
  const tc = texte(ctx);
  assert.match(tc, /general\/sites[^\n]*· ok/);
  assert.match(tc, /reseau\/dns-dhcp[^\n]*· vide/);
  assert.match(tc, /reseau\/nexiste-pas · inconnue/);
  assert.match(tc, /systeme\/serveurs[^\n]*· vide[\s\S]*n'existe pas/);

  const ctxV2 = await client.callTool({ name: "get_context", arguments: { sections: ["identite/annuaires", "materiel/stock"] } });
  assert.match(texte(ctxV2), /identite\/annuaires[^\n]*· vide[\s\S]*n'existe pas/);
  assert.match(texte(ctxV2), /materiel\/stock[\s\S]*Consigne du gabarit : Ce qu'on garde en réserve/);

  // 4b. Une section vide renvoie la consigne du gabarit et son squelette.
  assert.match(tc, /reseau\/dns-dhcp[\s\S]*Consigne du gabarit : Qui rend ces services/);
  assert.match(tc, /Squelette attendu :\n```markdown\nDNS : <qui porte le service/);

  // 4c. Skill remplissage : consignes + état calculé.
  const remplissage = await client.callTool({ name: "load_skill", arguments: { domaines: ["remplissage"] } });
  assert.ok(!estErreur(remplissage), texte(remplissage));
  assert.match(texte(remplissage), /État de remplissage du contexte/);
  assert.match(texte(remplissage), /`systeme` \(fichier absent\)/);
  assert.match(texte(remplissage), /update_context/);

  // 4d. update_context : section existante remplacée, sauvegarde, date ; fichier créé depuis le gabarit ; erreurs.
  const maj1 = await client.callTool({
    name: "update_context",
    arguments: { section: "reseau/plan-adressage", contenu: "| VLAN | Nom | Plage | Usage | Site(s) |\n| --- | --- | --- | --- | --- |\n| 10 | VLAN-TEST | PLAGE-TEST | test | SITE-TEST |" },
  });
  assert.ok(!estErreur(maj1), texte(maj1));
  // OA2 (campagne sans jeu de données) : une section vide se remplit, elle n'est pas « remplacée », et le gabarit vierge n'est pas archivé.
  assert.match(texte(maj1), /section remplie \(était vide\)/, texte(maj1));
  assert.match(texte(maj1), /version précédente : aucune \(section vide/, texte(maj1));
  assert.match(texte(maj1), /dernière mise à jour : \d{4}-\d{2}-\d{2}/);
  const reseauMd = fs.readFileSync(path.join(installation, "contexte", "reseau.md"), "utf8");
  assert.match(reseauMd, /## plan-adressage — Plan d'adressage et VLAN\n\n<!--[\s\S]*?-->\n\n\| VLAN \| Nom[\s\S]*VLAN-TEST[\s\S]*\nDernière mise à jour : \d{4}-\d{2}-\d{2}\n/, "titre, consigne, contenu, date");
  assert.doesNotMatch(reseauMd, /<numéro> \| <nom>/, "le squelette de la section a été remplacé");
  assert.match(reseauMd, /## wifi — Wifi/, "les autres sections sont intactes");
  assert.ok(!fs.existsSync(path.join(installation, "contexte", "historique")) || fs.readdirSync(path.join(installation, "contexte", "historique")).length === 0, "pas de copie pour une section qui était vide");
  // Une vraie modification (une ligne de plus) : « remplacée », avec copie de la version précédente.
  const maj1bis = await client.callTool({
    name: "update_context",
    arguments: { section: "reseau/plan-adressage", contenu: "| VLAN | Nom | Plage | Usage | Site(s) |\n| --- | --- | --- | --- | --- |\n| 10 | VLAN-TEST | PLAGE-TEST | test | SITE-TEST |\n| 20 | VLAN-TEST-2 | PLAGE-TEST-2 | test | SITE-TEST |" },
  });
  assert.ok(!estErreur(maj1bis), texte(maj1bis));
  assert.match(texte(maj1bis), /section remplacée/);
  const hist = fs.readdirSync(path.join(installation, "contexte", "historique"));
  assert.equal(hist.length, 1, "une sauvegarde de la version précédente");
  assert.match(hist[0], /^reseau-\d{8}-\d{6}\.md$/);
  const relu = await client.callTool({ name: "get_context", arguments: { sections: ["reseau/plan-adressage"] } });
  assert.match(texte(relu), /plan-adressage[^\n]*· ok[\s\S]*VLAN-TEST/);
  assert.doesNotMatch(texte(relu), /À CONFIRMER/, "datée d'aujourd'hui : pas périmée");
  // Décision 9 : le même contenu = « toujours vrai » — re-datée, pas de copie dans historique/.
  const confirmee = await client.callTool({
    name: "update_context",
    arguments: { section: "reseau/plan-adressage", contenu: "| VLAN | Nom | Plage | Usage | Site(s) |\n| --- | --- | --- | --- | --- |\n| 10 | VLAN-TEST | PLAGE-TEST | test | SITE-TEST |\n| 20 | VLAN-TEST-2 | PLAGE-TEST-2 | test | SITE-TEST |" },
  });
  assert.ok(!estErreur(confirmee) && /confirmée, re-datée/.test(texte(confirmee)), texte(confirmee));
  assert.equal(fs.readdirSync(path.join(installation, "contexte", "historique")).length, 1, "une confirmation ne copie rien dans historique/");
  // Une section datée de plus de 90 jours est annotée « à confirmer » — dans get_context comme dans les requis d'un skill.
  const reseauMdDate = fs.readFileSync(path.join(installation, "contexte", "reseau.md"), "utf8");
  fs.writeFileSync(path.join(installation, "contexte", "reseau.md"), reseauMdDate.replace(/Dernière mise à jour : \d{4}-\d{2}-\d{2}/, "Dernière mise à jour : 2020-01-01"), "utf8");
  const perimee = await client.callTool({ name: "get_context", arguments: { sections: ["reseau/plan-adressage"] } });
  // E13 (campagne 0.3.0-beta) : la consigne est en tête de section, avant le contenu.
  assert.match(texte(perimee), /plan-adressage[^\n]*· ok · \*\*PÉRIMÉE, À CONFIRMER\*\*\n_\*\*Datée du 2020-01-01, plus de 90 jours : ne pas s'en servir[\s\S]*\| 10 \| VLAN-TEST/, texte(perimee));
  assert.match(texte(perimee), /update_context avec le contenu identique/);

  const maj2 = await client.callTool({
    name: "update_context",
    arguments: { section: "systeme/serveurs", contenu: "| Serveur | Rôle | Site | Physique / VM | OS | Administration |\n| --- | --- | --- | --- | --- | --- |\n| SRVTEST | fichiers | SITE-TEST | VM | OS-TEST | console |" },
  });
  assert.ok(!estErreur(maj2), texte(maj2));
  assert.match(texte(maj2), /créé depuis le gabarit/);
  assert.ok(fs.existsSync(path.join(installation, "contexte", "systeme.md")));
  const systemeMd = fs.readFileSync(path.join(installation, "contexte", "systeme.md"), "utf8");
  assert.match(systemeMd, /SRVTEST/);
  assert.match(systemeMd, /## ordonnancement — Tâches planifiées/, "le reste du gabarit est copié");
  const sectionServeurs = systemeMd.slice(systemeMd.indexOf("## serveurs"), systemeMd.indexOf("## services"));
  assert.doesNotMatch(sectionServeurs, /Dernière mise à jour/, "serveurs n'a pas de date dans le gabarit");
  assert.match(sectionServeurs, /<!--[\s\S]*?-->[\s\S]*SRVTEST/, "consignes conservées, contenu écrit");

  const majV2 = await client.callTool({
    name: "update_context",
    arguments: { section: "identite/annuaires", contenu: "| Annuaire | Type | Fait autorité pour | Conventions de nommage | Administration |\n| --- | --- | --- | --- | --- |\n| ANNUAIRE-TEST | domaine interne | comptes | prenom.nom | console |" },
  });
  assert.ok(!estErreur(majV2), texte(majV2));
  assert.match(texte(majV2), /créé depuis le gabarit/);
  assert.match(fs.readFileSync(path.join(installation, "contexte", "identite.md"), "utf8"), /ANNUAIRE-TEST[\s\S]*## comptes-service — Comptes de service/);

  // C2 : une section qui ne contient que le squelette (en-tête de table + placeholders), même
  // reformulé par rapport au gabarit livré (gabarit plus ancien chez le client), reste « vide ».
  // Écrit à la main dans le fichier : update_context refuse un en-tête différent (EA2).
  const reseauMdC2 = fs.readFileSync(path.join(installation, "contexte", "reseau.md"), "utf8");
  fs.writeFileSync(
    path.join(installation, "contexte", "reseau.md"),
    reseauMdC2.replace(/(## wifi — Wifi\n\n<!--[\s\S]*?-->\n\n)[\s\S]*?(?=\n## )/, "$1| SSID | Usage | Authentification |\n| --- | --- | --- |\n| <nom du réseau> | <qui> | <comment> |\n"),
    "utf8",
  );
  const wifiVide = await client.callTool({ name: "get_context", arguments: { sections: ["reseau/wifi"] } });
  assert.match(texte(wifiVide), /reseau\/wifi[^\n]*· vide/, "C2 : squelette seul = vide, quel que soit le gabarit");
  // EA2 (campagne sans jeu de données) : un tableau aux colonnes inventées est refusé — celles du
  // squelette si la section est vide, celles déjà en place sinon ; la prose sur une section tabulaire aussi.
  const majColonnes = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "| SSID | Usage | Authentification |\n| --- | --- | --- |\n| WIFI-TEST | employés | certificat |" } });
  assert.ok(estErreur(majColonnes) && /en-tête du tableau ne correspond pas[^\n]*attendu « \| ssid \| population \| authentification \| accès \| »[^\n]*reçu « \| ssid \| usage \| authentification \| »/.test(texte(majColonnes)), "EA2 : section vide → colonnes du gabarit — " + texte(majColonnes));
  const majProse = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "Un seul SSID pour tout le monde." } });
  assert.ok(estErreur(majProse) && /reçu « aucun tableau »/.test(texte(majProse)), "EA2 : prose sur une section tabulaire — " + texte(majProse));
  const majServeursAutre = await client.callTool({ name: "update_context", arguments: { section: "systeme/serveurs", contenu: "| Serveur | Rôle | Adresse | Site |\n| --- | --- | --- | --- |\n| SRVTEST | fichiers | ADRESSE-TEST | SITE-TEST |" } });
  assert.ok(estErreur(majServeursAutre) && /attendu « \| serveur \| rôle \| site \| physique \/ vm \| os \| administration \| »/.test(texte(majServeursAutre)), "EA2 : section remplie → colonnes en place — " + texte(majServeursAutre));
  const majBonnesColonnes = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "|  SSID | Population | AUTHENTIFICATION | Accès |\n| --- | --- | --- | --- |\n| WIFI-TEST | employés | certificat | tout |" } });
  assert.ok(!estErreur(majBonnesColonnes), "EA2 : mêmes colonnes à la casse et aux espaces près → accepté — " + texte(majBonnesColonnes));
  const majInconnue = await client.callTool({ name: "update_context", arguments: { section: "reseau/nexiste-pas", contenu: "x" } });
  assert.ok(estErreur(majInconnue) && /inconnue du fichier/.test(texte(majInconnue)));
  const majDomaine = await client.callTool({ name: "update_context", arguments: { section: "cloud/parc", contenu: "x" } });
  assert.ok(estErreur(majDomaine) && /sans gabarit/.test(texte(majDomaine)));
  const majTitre = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "## wifi — x\ntruc" } });
  assert.ok(estErreur(majTitre) && /une section à la fois/.test(texte(majTitre)));
  const majVide = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "<!-- rien -->" } });
  assert.ok(estErreur(majVide) && /contenu vide/.test(texte(majVide)));

  // 5. Base vide, hors ticket : aucun refus sans brouillon courant.
  const vide = await client.callTool({ name: "search_kb", arguments: { tags: ["reseau", "vpn"] } });
  assert.match(texte(vide), /Base de connaissances vide/);
  // EA1 (campagne sans jeu de données) : un domaine ou une nature du manifeste est connu même sans aucun cas en base.
  assert.doesNotMatch(texte(vide), /Tag inconnu/, "EA1 : « reseau » connu par le manifeste, pas seulement par les cas — " + texte(vide));
  const videNature = await client.callTool({ name: "search_kb", arguments: { tags: ["incident", "hors-perimetre", "inconnu-xyz"] } });
  assert.doesNotMatch(texte(videNature), /Tag inconnu de la bibliothèque : « (incident|hors-perimetre) »/, texte(videNature));
  assert.match(texte(videNature), /Tag inconnu de la bibliothèque : « inconnu-xyz »/, "un mot-clé libre reste signalé");

  // 5b. Le brouillon : création avec symptôme obligatoire ; A6, A3 ; B1 (liste plafonnée).
  const sansSymptome = await client.callTool({ name: "save_progress", arguments: {} });
  assert.ok(estErreur(sansSymptome) && /symptome_initial/.test(texte(sansSymptome)));
  const refFabriquee = await client.callTool({ name: "save_progress", arguments: { reference: "SANS-REF-20260918", symptome_initial: "Test A6" } });
  assert.ok(estErreur(refFabriquee) && /ne s'invente pas/.test(texte(refFabriquee)), texte(refFabriquee));
  // A3 puis décision 2 : les domaines sont un enum construit depuis le manifeste — refus du schéma, avant notre code.
  await refusSchema(client.callTool({ name: "save_progress", arguments: { symptome_initial: "Test A3", domaines_valides: ["Systeme", "cloud"] } }), /cloud/, "domaine inconnu");
  await refusSchema(client.callTool({ name: "save_progress", arguments: { symptome_initial: "Test signal", signaux: [{ id: "lenteur-generale", preuve: "x" }] } }), /lenteur-generale/, "signal hors manifeste");
  await refusSchema(client.callTool({ name: "save_progress", arguments: { symptome_initial: "Test preuve", signaux: [{ id: "depend-du-lieu", preuve: "x".repeat(200) }] } }), /preuve/, "preuve trop longue");
  const ids11: string[] = [];
  for (let i = 1; i <= 11; i++) {
    const p = await client.callTool({ name: "save_progress", arguments: { symptome_initial: `Test B1 numéro ${i}` } });
    assert.ok(!estErreur(p), texte(p));
    ids11.push(texte(p).match(/Brouillon créé : (\S+) ·/)![1]);
  }
  const triage11 = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.match(texte(triage11), /11 ticket\(s\) en cours[\s\S]*… et 1 autre\(s\) : `resume_ticket\(\)`/);
  const liste11 = await client.callTool({ name: "resume_ticket", arguments: {} });
  assert.equal((texte(liste11).match(/Test B1 numéro/g) ?? []).length, 0, "la liste ne montre pas le symptôme");
  assert.equal((texte(liste11).match(/^\| — \| `/gm) ?? []).length, 11, "resume_ticket() rend les onze");
  for (const i of ids11) fs.rmSync(path.join(installation, "en-cours", `${i}.md`));
  await client.close();

  // ---- Client B : une session neuve, la séquence complète d'un ticket, et les refus hors séquence (décision 3).
  const clientB = await ouvrir("smoke-sequence", produit);
  const tB = await clientB.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.ok(!estErreur(tB));
  // Décision 2, point 7 : un domaine proposé sans signal coché est refusé, avec le classement.
  const sansSignal = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "INC-PAUSE-1", symptome_initial: "Test : le partage ne répond plus", nature: "incident", signaux: [{ id: "un-service-touche", preuve: "le partage ne répond plus, le reste va" }], domaines_proposes: ["systeme", "reseau"] },
  });
  assert.ok(estErreur(sansSignal) && /reseau sans aucun signal coché/.test(texte(sansSignal)) && /systeme \(1 : un-service-touche\)/.test(texte(sansSignal)), texte(sansSignal));
  assert.equal(fs.readdirSync(path.join(installation, "en-cours")).length, 0, "un refus ne crée rien");
  const p1a = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "INC-PAUSE-1", symptome_initial: "Test : le partage ne répond plus", nature: "incident", signaux: [{ id: "un-service-touche", preuve: "le partage ne répond plus, le reste va" }, { id: "independant-du-chemin", preuve: "pareil en VPN et sur site" }], domaines_proposes: ["systeme", "reseau"], domaines_valides: ["systeme"], prochaine_etape: "cran 1 : le serveur répond-il ?" },
  });
  assert.ok(estErreur(p1a), "reseau toujours sans signal : " + texte(p1a));
  const p1b = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "INC-PAUSE-1", symptome_initial: "Test : le partage ne répond plus", nature: "incident", signaux: [{ id: "un-service-touche", preuve: "le partage ne répond plus, le reste va" }, { id: "independant-du-chemin", preuve: "pareil en VPN et sur site" }, { id: "population-lieu-lien", preuve: "surtout les télétravailleurs" }], domaines_proposes: ["systeme", "reseau"], domaines_valides: ["systeme"], prochaine_etape: "cran 1 : le serveur répond-il ?" },
  });
  assert.ok(!estErreur(p1b), texte(p1b));
  assert.match(texte(p1b), /Brouillon créé : \S+ · étape triage/);
  assert.match(texte(p1b), /domaines classés par les signaux cochés : systeme \(2 : un-service-touche, independant-du-chemin\) > reseau \(1 : population-lieu-lien\)/, "classement calculé par le serveur");
  const p1 = p1b;
  const pid = texte(p1).match(/Brouillon créé : (\S+) ·/)?.[1];
  // E10 (campagne 0.3.0-beta) : une demande aussi exige un signal par domaine proposé.
  const demandeSansSignal = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "DEM-TEST-1", symptome_initial: "Test : créer un partage pour l'équipe", nature: "demande", domaines_proposes: ["systeme"] },
  });
  assert.ok(estErreur(demandeSansSignal) && /systeme sans aucun signal coché/.test(texte(demandeSansSignal)), texte(demandeSansSignal));
  // E11 : la référence en tête du symptôme est retirée, et dite.
  const prefixe = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "DEM-TEST-1", symptome_initial: "DEM-TEST-1 : créer un partage pour l'équipe", nature: "demande", signaux: [{ id: "objet-service", preuve: "créer un partage" }], domaines_proposes: ["systeme"], prochaine_etape: "x" },
  });
  assert.ok(!estErreur(prefixe), texte(prefixe));
  assert.match(texte(prefixe), /ATTENTION symptome_initial : la référence « DEM-TEST-1 » en tête a été retirée/, texte(prefixe));
  const pidDem = texte(prefixe).match(/Brouillon créé : (\S+) ·/)?.[1];
  assert.ok(pidDem);
  assert.match(fs.readFileSync(path.join(installation, "en-cours", `${pidDem}.md`), "utf8"), /symptome_initial: créer un partage pour l'équipe/);
  fs.rmSync(path.join(installation, "en-cours", `${pidDem}.md`));
  // Retour au brouillon de la séquence.
  const retour = await clientB.callTool({ name: "resume_ticket", arguments: { ticket: pid } });
  assert.ok(!estErreur(retour), texte(retour));
  assert.ok(pid, "id du brouillon");
  assert.ok(fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)));
  // Refus hors séquence, brouillon courant : chercher avant d'instruire, clôturer sans cloture.
  const tropTot = await clientB.callTool({ name: "search_kb", arguments: { tags: ["systeme"] } });
  assert.ok(estErreur(tropTot) && /n'est pas instruit/.test(texte(tropTot)), texte(tropTot));
  const sansCloture = await clientB.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu" } });
  assert.ok(estErreur(sansCloture) && /charger `cloture` d'abord/.test(texte(sansCloture)), texte(sansCloture));
  // Une section servie ne repart pas.
  const s1 = await clientB.callTool({ name: "get_context", arguments: { sections: ["general/sites"] } });
  assert.match(texte(s1), /general\/sites[^\n]*· ok[\s\S]*SITE-TEST/);
  const s2 = await clientB.callTool({ name: "get_context", arguments: { sections: ["general/sites", "reseau/dns-dhcp"] } });
  assert.match(texte(s2), /Déjà chargée\(s\)[^\n]*`general\/sites`/, "déjà servie : pas de contenu");
  assert.doesNotMatch(texte(s2), /SITE-TEST/);
  assert.match(texte(s2), /reseau\/dns-dhcp[^\n]*· vide/, "la section nouvelle est servie");
  // Instruction : le skill, ses requis, un point d'étape.
  const sk = await clientB.callTool({ name: "load_skill", arguments: { domaines: ["systeme"], nature: "incident" } });
  assert.ok(!estErreur(sk), texte(sk));
  // E5 (campagne 0.3.0-beta) : après le premier skill de domaine, domaines_valides ne se retire plus — union, dite.
  const retrait = await clientB.callTool({ name: "save_progress", arguments: { id: pid, domaines_valides: ["materiel"], prochaine_etape: "x" } });
  assert.ok(!estErreur(retrait), texte(retrait));
  assert.match(texte(retrait), /ATTENTION domaines_valides : systeme conservé\(s\)[^\n]*validés : systeme, materiel/, texte(retrait));
  assert.match(fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8"), /domaines_valides:\n  - systeme\n  - materiel/);
  await refusSchema(clientB.callTool({ name: "save_progress", arguments: { id: pid, contradictions: [{ section: "reseau/inexistante", constat: "x" }] } }), /inexistante/, "section inconnue des gabarits");
  await refusSchema(clientB.callTool({ name: "save_progress", arguments: { id: pid, questions: [{ question: "q", reponse: "r", section: "systeme/nexiste-pas" }] } }), /nexiste-pas/, "section candidate inconnue");
  const p2 = await clientB.callTool({
    name: "save_progress",
    arguments: { id: pid, verifications: ["cran 1 : ping OK", "cran 2 : disque plein 100 %"], questions: [{ question: "Quel serveur porte le partage ?", reponse: "SRV-TEST", section: "systeme/serveurs" }], contradictions: [{ section: "systeme/serveurs", constat: "le partage est sur SRV-AUTRE, pas SRVTEST" }], prochaine_etape: "cran 3 : état du service" },
  });
  assert.ok(!estErreur(p2) && /Brouillon mis à jour : \S+ · étape instruction/.test(texte(p2)), texte(p2));
  const b2 = fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8");
  assert.match(b2, /^skills_charges:\n  - triage\n  - systeme$/m, "l'état de session est recopié dans le brouillon");
  assert.match(b2, /^sections_servies:\n(  - .*\n)*  - general\/sites/m);
  // A4 : référence changée ; A5 : rattachement par symptôme (A2 : à la normalisation près).
  const refChangee = await clientB.callTool({ name: "save_progress", arguments: { id: pid, reference: "INC-AUTRE" } });
  assert.ok(estErreur(refChangee) && /mauvais id/.test(texte(refChangee)), texte(refChangee));
  const parSymptome = await clientB.callTool({ name: "save_progress", arguments: { symptome_initial: "test, le partage ne repond plus !", notes: ["rattaché sans id"] } });
  assert.ok(!estErreur(parSymptome) && /rattaché par le symptôme/.test(texte(parSymptome)) && texte(parSymptome).includes(pid), texte(parSymptome));
  // Escalade : le deuxième load_skill d'un domaine, sans champ.
  const esc = await clientB.callTool({ name: "load_skill", arguments: { domaines: ["identite"], nature: "incident" } });
  assert.ok(!estErreur(esc), texte(esc));
  // Pause (le mot du technicien), puis levée ; rattachement par référence en minuscules, sans écraser la casse.
  const p3 = await clientB.callTool({
    name: "save_progress",
    arguments: { reference: "inc-pause-1", pause: true, verifications: ["Cran 2 — disque plein 100 %."], notes: ["mis en pause pour un ticket urgent"], prochaine_etape: "libérer de l'espace puis cran 3" },
  });
  assert.ok(!estErreur(p3) && /rattaché par la référence/.test(texte(p3)) && /étape pause/.test(texte(p3)), texte(p3));
  const brouillon = fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8");
  assert.match(brouillon, /^etape: pause$/m);
  assert.match(brouillon, /^reference: INC-PAUSE-1$/m, "la casse d'origine de la référence est conservée");
  assert.ok(((brouillon.match(/^points_etape:\n((?:  - \S+\n)+)/m) ?? [])[1] ?? "").split("\n").filter(Boolean).length >= 3, "O8 : un horodatage par point d'étape, écrit par le serveur — " + brouillon.slice(0, 600));
  assert.equal((brouillon.match(/disque plein 100 %/g) ?? []).length, 1, "vérification dédoublonnée à la clé normalisée (A2), et le corps ne répète pas l'en-tête");
  assert.match(brouillon, /## etat — Où en est le ticket[\s\S]*escalade : identite[\s\S]*libérer de l'espace puis cran 3/);
  assert.doesNotMatch(brouillon, /## verifications —/, "le corps du fichier est réduit à l'état");
  assert.match(brouillon, /2 vérification\(s\), 1 question\(s\)/);
  const tropLong = await clientB.callTool({ name: "save_progress", arguments: { id: pid, verifications: ["cran 3 : " + "x".repeat(300)], notes: ["ok"] } });
  assert.ok(estErreur(tropLong) && /trop longues[\s\S]*verifications \(3\d\d > 240\)/.test(texte(tropLong)), texte(tropLong));
  assert.doesNotMatch(fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8"), /- ok$/m, "un appel refusé n'écrit rien, même les entrées valides");
  const p4 = await clientB.callTool({ name: "save_progress", arguments: { id: pid, notes: ["reprise"] } });
  assert.match(texte(p4), /étape instruction/, "la pause est levée au save_progress suivant");
  // Recherche, plan, actions : l'étape suit ce que le serveur voit. read_kb avant search_kb est refusé.
  const lireTropTot = await clientB.callTool({ name: "read_kb", arguments: { ticket_id: "20200101-000000-x-y" } });
  assert.ok(estErreur(lireTropTot) && /chercher d'abord/.test(texte(lireTropTot)), texte(lireTropTot));
  const rech = await clientB.callTool({ name: "search_kb", arguments: { tags: ["systeme", "stockage"] } });
  assert.ok(!estErreur(rech), texte(rech));
  const p5 = await clientB.callTool({ name: "save_progress", arguments: { id: pid, prochaine_etape: "proposer le plan" } });
  assert.match(texte(p5), /étape recherche/);
  const p6 = await clientB.callTool({ name: "save_progress", arguments: { id: pid, plan_action: "1. Libérer de l'espace → 20 % libres" } });
  assert.match(texte(p6), /étape plan/);
  const p7 = await clientB.callTool({ name: "save_progress", arguments: { id: pid, actions: ["1 : purge des journaux → 25 % libres", "2 : redémarrage du service → OK"] } });
  assert.match(texte(p7), /étape actions/);
  const liste = await clientB.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(liste), /1 ticket\(s\) en cours[\s\S]*INC-PAUSE-1[\s\S]*actions/);
  const reprise = await clientB.callTool({ name: "resume_ticket", arguments: { ticket: "INC-PAUSE-1" } });
  assert.ok(!estErreur(reprise), texte(reprise));
  const trp = texte(reprise);
  assert.match(trp, /# Reprise du ticket \S+ — INC-PAUSE-1/);
  assert.match(trp, /load_skill\(\["identite"\], "incident"\)/, "recharger le dernier skill de domaine chargé");
  assert.match(trp, /cran 1 : ping OK/);
  assert.match(trp, /Quel serveur porte le partage/);
  assert.doesNotMatch(trp, /^technicien: /m, "l'en-tête YAML n'est pas renvoyé au modèle");
  const inconnuRep = await clientB.callTool({ name: "resume_ticket", arguments: { ticket: "INC-NEXISTE-PAS" } });
  assert.ok(estErreur(inconnuRep) && /aucun ticket en cours/.test(texte(inconnuRep)));
  // Clôture : un autre id que le courant est refusé ; sans cloture chargé aussi ; puis la bonne.
  const autreId = await clientB.callTool({ name: "save_ticket", arguments: { id: "20200101-000000-x-y", symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: [], conclusion: "x", plan_action: "x", statut: "resolu" } });
  assert.ok(estErreur(autreId) && /un autre ticket est en cours/.test(texte(autreId)), texte(autreId));
  const cloture = await clientB.callTool({ name: "load_skill", arguments: { domaines: ["cloture"] } });
  assert.ok(!estErreur(cloture) && /save_ticket/.test(texte(cloture)));
  // Décision 1 : cloture sert les tags cochables, filtrés sur les domaines validés (+ escalade) et les transverses.
  assert.match(texte(cloture), /Tags cochables pour ce ticket \(domaines systeme, materiel, identite \+ transverses\)/, texte(cloture).slice(-600));
  assert.match(texte(cloture), /`sauvegarde`[\s\S]*`verrouillage`[\s\S]*`m365`/, "tags produit des deux domaines puis le transverse client");
  assert.doesNotMatch(texte(cloture), /`vpn`/, "un tag d'un autre domaine n'est pas proposé");
  // Tag inconnu et sixième tag : refus du schéma ; tag d'un autre domaine : refus du serveur avec la liste.
  await refusSchema(clientB.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu", tags: ["ecm-interne"] } }), /ecm-interne/, "tag hors bibliothèque");
  await refusSchema(clientB.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu", tags: ["sauvegarde", "stockage", "messagerie", "certificat", "virtualisation", "m365"] } }), /5|maximum|Too big|at most/i, "six tags");
  const horsDomaine = await clientB.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu", tags: ["sauvegarde", "vpn"] } });
  assert.ok(estErreur(horsDomaine) && /vpn \(reseau\)/.test(texte(horsDomaine)) && /Cocher parmi : [^\n]*sauvegarde/.test(texte(horsDomaine)), texte(horsDomaine));
  assert.ok(fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "un refus de tags ne clôture rien");
  const clotRef = await clientB.callTool({ name: "save_ticket", arguments: { reference: "INC-AUTRE", symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu" } });
  assert.ok(estErreur(clotRef) && /mauvais id/.test(texte(clotRef)), texte(clotRef));
  assert.ok(fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "un refus ne retire pas le brouillon");
  const clot = await clientB.callTool({
    name: "save_ticket",
    arguments: { symptome_initial: "Le partage ne répond plus (paraphrase de clôture)", nature: "incident", domaines_proposes: ["reseau"], domaines_valides: ["systeme"], conclusion: "Test : disque plein", statut: "resolu", duree_minutes: 999 },
  });
  assert.ok(!estErreur(clot), texte(clot));
  assert.match(texte(clot), new RegExp(`Ticket enregistré : ${pid}\\n`), "sans id : le brouillon courant est rattaché");
  assert.match(texte(clot), /brouillon en cours : retiré/);
  assert.ok(!fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "le brouillon est retiré à la clôture");
  const final = fs.readFileSync(path.join(installation, "tickets", `${pid}.md`), "utf8");
  assert.match(final, /^reference: INC-PAUSE-1$/m, "référence héritée du brouillon");
  assert.match(final, /Test : le partage ne répond plus/, "A1 : le symptôme du brouillon, tel qu'exprimé");
  assert.doesNotMatch(final, /paraphrase de clôture/, "A1 : la paraphrase de la clôture est ignorée");
  assert.match(final, /^domaines_proposes:\n  - systeme\n  - reseau$/m, "domaines proposés du brouillon, pas ceux de la clôture");
  assert.match(final, /^escalades:\n  - identite$/m, "escalade dérivée du second load_skill, jamais fournie");
  assert.match(final, /^resolu_par: null$/m, "resolu_par omis → null, jamais « outil » par défaut");
  assert.match(final, /^duree_minutes: \d+$/m, "durée calculée par le serveur (création → clôture), pas la valeur donnée");
  assert.doesNotMatch(final, /^duree_minutes: 999$/m);
  // O8 (campagne 0.3.0-beta) : durée active (points d'étape, écarts plafonnés) et calendaire côte à côte.
  assert.match(final, /^duree_calendaire_minutes: \d+$/m, "la durée calendaire est écrite à côté de l'active");
  assert.match(texte(clot), /durée : \d+ min \(active, calculée des points d'étape[^\n]*calendaire : \d+ min/, "la réponse dit l'active et la calendaire — " + texte(clot));
  {
    const t0 = Date.parse("2026-09-21T08:00:00.000Z");
    const iso = (min: number) => new Date(t0 + min * 60000).toISOString();
    assert.equal(dureeActiveMinutes([iso(0), iso(5), iso(60)], new Date(t0 + 62 * 60000)), 5 + ECART_ACTIF_MAX_MINUTES + 2, "un écart de 55 min compte pour le plafond");
    assert.equal(dureeActiveMinutes([iso(0)], new Date(t0 + 1500 * 60000)), ECART_ACTIF_MAX_MINUTES, "une nuit de session perdue compte pour le plafond");
    assert.equal(dureeActiveMinutes([], new Date()), undefined, "brouillon antérieur sans points : la calendaire sert");
  }
  assert.match(final, /Libérer de l'espace/, "plan d'action du brouillon");
  assert.match(final, /Quel serveur porte le partage/, "questions du brouillon reprises");
  assert.match(final, /## contradictions — Contexte contredit par le terrain[\s\S]*`systeme\/serveurs` : le partage est sur SRV-AUTRE/, "contradictions reprises dans le ticket");
  assert.match(final, /## mises-a-jour-contexte[\s\S]*`systeme\/serveurs` :[\s\S]*\(contradiction constatée en ticket\) le partage est sur SRV-AUTRE/, "la contradiction devient une mise à jour proposée, sans la mémoire du modèle");
  const journalPid = path.join(installation, "journal", `${pid}.md`);
  assert.ok(fs.existsSync(journalPid), "journal écrit depuis les questions du brouillon");
  const tj = fs.readFileSync(journalPid, "utf8");
  assert.match(tj, /^questions: 1$/m);
  assert.match(tj, /^sections_candidates:\n  - systeme\/serveurs$/m, "sections candidates dans l'en-tête");
  assert.match(tj, /## q01 — Question 1[\s\S]*Quel serveur porte le partage[\s\S]*Section candidate : `systeme\/serveurs`/);
  assert.match(texte(clot), /journal : [^\n]*\(1 question\(s\)\)/);
  const listeVide = await clientB.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(listeVide), /Aucun ticket en cours/);
  // A8 : un brouillon dont le ticket existe est un zombie — ignoré, et retiré au premier save_ticket.
  fs.writeFileSync(path.join(installation, "en-cours", `${pid}.md`), brouillon, "utf8");
  const listeZombie = await clientB.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(listeZombie), /Aucun ticket en cours/, "le zombie n'est pas listé");
  const dejaClos = await clientB.callTool({ name: "save_ticket", arguments: { id: pid, symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu" } });
  assert.ok(estErreur(dejaClos) && /déjà clôturé/.test(texte(dejaClos)) && /retiré/.test(texte(dejaClos)), texte(dejaClos));
  assert.ok(!fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "le zombie est retiré");

  // 6. Clôture sans brouillon (session vidée par la clôture précédente : aucun refus), plan obligatoire si résolu.
  const sansPlanSansBrouillon = await clientB.callTool({
    name: "save_ticket",
    arguments: { symptome_initial: "Test : sans plan", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", statut: "resolu" },
  });
  assert.ok(estErreur(sansPlanSansBrouillon) && /plan d'action/.test(texte(sansPlanSansBrouillon)), texte(sansPlanSansBrouillon));
  const sauve = await clientB.callTool({
    name: "save_ticket",
    arguments: {
      symptome_initial: "Test de fumée : lenteur uniquement via VPN",
      nature: "incident",
      domaines_proposes: ["reseau", "identite"],
      domaines_valides: ["reseau"],
      signaux: [{ id: "depend-du-lieu", preuve: "uniquement via VPN" }, { id: "tous-services-touches", preuve: "tous les services touchés" }],
      conclusion: "Test : concentrateur VPN saturé",
      plan_action: "Test : rien",
      questions: [{ question: "Quelle est la passerelle du site ?", reponse: "TEST", section: "reseau/topologie" }],
      // EA3 : un candidat de plus de 60 caractères, dont le début sera écrit seul plus loin (8b).
      mises_a_jour_contexte: [{ section: "reseau/acces-distant", contenu: "TEST — la section entière reprise par le ticket, puis complétée : un piège connu de plus" }],
      statut: "resolu",
      tags: ["vpn", "vpn-site-a-site", "m365"],
      duree_minutes: 3,
      reference: "INC-TEST-42",
    },
  });
  assert.ok(!estErreur(sauve), texte(sauve));
  const id = texte(sauve).match(/Ticket enregistré : (\S+)/)?.[1];
  assert.ok(id, "identifiant renvoyé");
  assert.ok(fs.existsSync(path.join(installation, "tickets", `${id}.md`)));
  assert.ok(fs.existsSync(path.join(installation, "journal", `${id}.md`)), "un journal par ticket");
  assert.equal(fs.readdirSync(path.join(installation, "journal")).length, 2, "deux tickets avec questions → deux fichiers de journal, pas un par question");
  const ticket = fs.readFileSync(path.join(installation, "tickets", `${id}.md`), "utf8");
  assert.match(ticket, /symptome-initial — Symptôme initial/);
  assert.match(ticket, /lenteur uniquement via VPN/);
  assert.match(ticket, /- incident\n/);
  assert.match(ticket, /- vpn\n/);
  assert.match(ticket, /- vpn-site-a-site\n/, "tag client du domaine validé");
  assert.match(ticket, /- m365\n/, "tag transverse client");
  assert.match(ticket, /^escalades: \[\]$/m, "sans brouillon ni skill de domaine dans la session : aucune escalade");
  assert.match(ticket, /^duree_minutes: 3$/m, "sans brouillon, la durée donnée sert (baseline)");
  assert.match(ticket, /^reference: INC-TEST-42$/m, "référence dans l'en-tête");
  assert.match(ticket, /^# Ticket \S+ — INC-TEST-42$/m, "référence dans le titre");
  assert.match(ticket, /- inc-test-42\n/, "référence dans les tags");

  // 7. Non publié : invisible en recherche. Publication, puis visible. Seul un ticket résolu se publie.
  const avant = await clientB.callTool({ name: "search_kb", arguments: { tags: ["vpn"] } });
  assert.match(texte(avant), /Base de connaissances vide/);
  const pubHors = await clientB.callTool({ name: "publish_kb", arguments: { ticket_id: id, tags: ["sauvegarde"] } });
  assert.ok(estErreur(pubHors) && /sauvegarde \(systeme\)/.test(texte(pubHors)), texte(pubHors));
  const pub = await clientB.callTool({ name: "publish_kb", arguments: { ticket_id: id, tags: ["proxy-internet"] } });
  assert.ok(!estErreur(pub), texte(pub));
  assert.match(texte(pub), /symptôme : Test de fumée : lenteur uniquement via VPN/, "la réponse de publish_kb cite ce qui a été publié");
  const rePub = await clientB.callTool({ name: "publish_kb", arguments: { ticket_id: id } });
  assert.ok(estErreur(rePub) && /déjà publié/.test(texte(rePub)));
  const apres = await clientB.callTool({ name: "search_kb", arguments: { tags: ["vpn", "dns", "proxy-internet"] } });
  assert.match(texte(apres), /1 cas sur 1 en base, par rareté/);
  assert.match(texte(apres), /score 2/, "D2 : deux tags communs portés par une seule entrée = 1 + 1");
  assert.match(texte(apres), /tags communs : vpn, proxy-internet \(et \d+ autre\(s\)\)/, "rendu compact : tags communs seulement");
  assert.doesNotMatch(texte(apres), /Tag inconnu/, "tous les tags cherchés sont de la bibliothèque");
  assert.doesNotMatch(texte(apres), /- tags : /, "la liste complète des tags n'est plus rendue");
  assert.match(texte(apres), /read_kb\(ticket_id\)/);
  const parRef = await clientB.callTool({ name: "search_kb", arguments: { tags: ["inc-test-42"] } });
  assert.match(texte(parRef), /— INC-TEST-42 · score 0/, "la référence retrouve le cas mais ne pèse pas");
  // read_kb : le cas publié, sans les questions ; refus d'un id inconnu.
  const lu = await clientB.callTool({ name: "read_kb", arguments: { ticket_id: id } });
  assert.ok(!estErreur(lu), texte(lu));
  assert.match(texte(lu), /# Cas \S+ — INC-TEST-42/);
  assert.match(texte(lu), /## Conclusion\n\nTest : concentrateur VPN saturé/);
  assert.match(texte(lu), /## Plan d'action\n\nTest : rien/);
  assert.match(texte(lu), /- dépend du lieu[^\n]*\(`depend-du-lieu`\) — uniquement via VPN/, "signal rendu par libellé, identifiant et preuve");
  assert.doesNotMatch(texte(lu), /Quelle est la passerelle/, "les questions ne sont pas renvoyées");
  const ticketVpn = fs.readFileSync(path.join(installation, "tickets", `${id}.md`), "utf8");
  assert.match(ticketVpn, /^signaux:\n  - id: depend-du-lieu\n    preuve: uniquement via VPN$/m, "signaux { id, preuve } dans l'en-tête du ticket");
  const luInconnu = await clientB.callTool({ name: "read_kb", arguments: { ticket_id: "20200101-000000-x-y" } });
  assert.ok(estErreur(luInconnu) && /aucun cas publié/.test(texte(luInconnu)), texte(luInconnu));
  const rien = await clientB.callTool({ name: "search_kb", arguments: { tags: ["imprimante"] } });
  assert.match(texte(rien), /Tag inconnu de la bibliothèque : « imprimante »/, "un tag inconnu est signalé, pas ignoré en silence");
  assert.match(texte(rien), /Aucun cas ne partage/);
  const proche = await clientB.callTool({ name: "search_kb", arguments: { tags: ["vpnn"] } });
  assert.match(texte(proche), /« vpnn » — proche de : vpn/, "tags proches proposés");
  const inexistant = await clientB.callTool({ name: "publish_kb", arguments: { ticket_id: "20200101-000000-x-y" } });
  assert.ok(estErreur(inexistant) && /introuvable/.test(texte(inexistant)));
  const nonResolu = await clientB.callTool({
    name: "save_ticket",
    arguments: { symptome_initial: "Test : devis câblage", nature: "demande", domaines_proposes: [], domaines_valides: [], conclusion: "Test : hors domaines", statut: "hors-domaines-couverts" },
  });
  assert.ok(!estErreur(nonResolu), texte(nonResolu));
  const idNonResolu = texte(nonResolu).match(/Ticket enregistré : (\S+)/)![1];
  const pubRefusee = await clientB.callTool({ name: "publish_kb", arguments: { ticket_id: idNonResolu } });
  assert.ok(estErreur(pubRefusee) && /seul un ticket résolu/.test(texte(pubRefusee)), texte(pubRefusee));
  assert.ok(!fs.existsSync(path.join(installation, "kb", `${idNonResolu}.md`)));
  const luNonPublie = await clientB.callTool({ name: "read_kb", arguments: { ticket_id: idNonResolu } });
  assert.ok(estErreur(luNonPublie) && /n'est pas publié/.test(texte(luNonPublie)), texte(luNonPublie));
  // Ancien format (avant 2.6) : un brouillon aux signaux libres se lit tel quel, sans migration.
  const ancien = await clientB.callTool({ name: "save_progress", arguments: { symptome_initial: "Test : ancien format", nature: "incident" } });
  const idAncien = texte(ancien).match(/Brouillon créé : (\S+) ·/)![1];
  const fAncien = path.join(installation, "en-cours", `${idAncien}.md`);
  fs.writeFileSync(fAncien, fs.readFileSync(fAncien, "utf8").replace(/^signaux: \[\]$/m, "signaux:\n  - un signal rédigé à l'ancienne"), "utf8");
  const repriseAncien = await clientB.callTool({ name: "resume_ticket", arguments: { ticket: idAncien } });
  assert.match(texte(repriseAncien), /- un signal rédigé à l'ancienne/, "ancien format lu tel quel");
  fs.rmSync(fAncien);
  // Un second brouillon, laissé en instruction : la reprise après redémarrage se teste au client C.
  await clientB.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  const p8 = await clientB.callTool({ name: "save_progress", arguments: { reference: "INC-SEQ-2", symptome_initial: "Test : reprise après redémarrage", nature: "incident", domaines_valides: ["reseau"] } });
  assert.ok(!estErreur(p8), texte(p8));
  const pid2 = texte(p8).match(/Brouillon créé : (\S+) ·/)![1];
  const skR = await clientB.callTool({ name: "load_skill", arguments: { domaines: ["reseau"], nature: "incident" } });
  assert.ok(!estErreur(skR));
  await clientB.callTool({ name: "get_context", arguments: { sections: ["reseau/wifi"] } });
  const p9 = await clientB.callTool({ name: "save_progress", arguments: { id: pid2, pause: true, prochaine_etape: "cran 2" } });
  assert.match(texte(p9), /étape pause/);
  await clientB.close();

  // ---- Client C : le serveur redémarre, l'état est reconstruit depuis le brouillon (décision 3, point 2).
  const clientC = await ouvrir("smoke-reprise", produit);
  const avantReprise = await clientC.callTool({ name: "search_kb", arguments: { tags: ["reseau"] } });
  assert.ok(!estErreur(avantReprise), "sans brouillon courant (processus neuf), aucun refus : " + texte(avantReprise));
  const rep = await clientC.callTool({ name: "resume_ticket", arguments: { ticket: "INC-SEQ-2" } });
  assert.ok(!estErreur(rep) && /load_skill\(\["reseau"\], "incident"\)/.test(texte(rep)), texte(rep));
  const dejaServie = await clientC.callTool({ name: "get_context", arguments: { sections: ["reseau/wifi"] } });
  assert.match(texte(dejaServie), /Déjà chargée/, "sections servies reconstruites depuis le brouillon");
  const lireAvantC = await clientC.callTool({ name: "read_kb", arguments: { ticket_id: id } });
  assert.ok(estErreur(lireAvantC) && /chercher d'abord/.test(texte(lireAvantC)), "recherche_faite reconstruit (faux) : " + texte(lireAvantC));
  const rechC = await clientC.callTool({ name: "search_kb", arguments: { tags: ["reseau"] } });
  assert.ok(!estErreur(rechC), "skills chargés reconstruits : le cas est instruit — " + texte(rechC));
  const luC = await clientC.callTool({ name: "read_kb", arguments: { ticket_id: id } });
  assert.ok(!estErreur(luC), texte(luC));
  const clotC = await clientC.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["reseau"], conclusion: "x", plan_action: "x", statut: "non-resolu" } });
  assert.ok(estErreur(clotC) && /charger `cloture` d'abord/.test(texte(clotC)), "brouillon courant reconstruit : " + texte(clotC));
  await clientC.callTool({ name: "load_skill", arguments: { domaines: ["systeme"], nature: "incident" } });
  await clientC.callTool({ name: "load_skill", arguments: { domaines: ["cloture"] } });
  const clotC2 = await clientC.callTool({ name: "save_ticket", arguments: { symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["reseau"], conclusion: "x", plan_action: "x", statut: "non-resolu" } });
  assert.ok(!estErreur(clotC2), texte(clotC2));
  assert.match(texte(clotC2), new RegExp(`Ticket enregistré : ${pid2}`));
  const finalC = fs.readFileSync(path.join(installation, "tickets", `${pid2}.md`), "utf8");
  assert.match(finalC, /^escalades:\n  - systeme$/m, "escalade dérivée à travers un redémarrage du serveur");
  assert.match(finalC, new RegExp(`^cas_lus:\n  - ${id}$`, "m"), "le cas lu est noté dans le ticket");
  // 8b. L'audit (décision 8) : un brouillon antidaté, un titre cassé dans le contexte, puis le rapport — calculé, écrit, injecté.
  const pAudit = await clientC.callTool({ name: "save_progress", arguments: { reference: "INC-VIEUX", symptome_initial: "Test : brouillon abandonné", nature: "incident" } });
  const idVieux = texte(pAudit).match(/Brouillon créé : (\S+) ·/)![1];
  const fVieux = path.join(installation, "en-cours", `${idVieux}.md`);
  fs.writeFileSync(fVieux, fs.readFileSync(fVieux, "utf8").replace(/^derniere_mise_a_jour: .*$/m, "derniere_mise_a_jour: 2026-01-01T00:00:00.000Z"), "utf8");
  fs.appendFileSync(path.join(installation, "contexte", "general.md"), "\n## Sites\n\nun titre sans identifiant\n", "utf8");
  const auditSkill = await clientC.callTool({ name: "load_skill", arguments: { domaines: ["audit"] } });
  assert.ok(!estErreur(auditSkill), texte(auditSkill));
  const ta = texte(auditSkill);
  assert.match(ta, /# Audit de l'installation/);
  assert.match(ta, /Rapport écrit dans [^\n]*audits/);
  // OA1 (campagne sans jeu de données) : le remplissage en information dans le volet contexte, hors constats.
  assert.match(ta, /## contexte — Volet contexte\n\n_\d+ section\(s\) vide\(s\) sur \d+ — information, pas un constat/, "sections vides annoncées en information");
  assert.equal(fs.readdirSync(path.join(installation, "audits")).length, 1, "un rapport écrit, daté");
  const depuis = (titre: string) => ta.slice(ta.indexOf(titre));
  assert.ok(/^- `\S+` \(INC-VIEUX\) : 2\d\d j/m.test(depuis("Brouillons anciens")), "brouillon de plus de 30 jours proposé à la clôture");
  assert.ok(depuis("résolus jamais publiés").includes(`\`${pid}\` (INC-PAUSE-1)`), "ticket résolu non publié proposé à la publication");
  assert.match(depuis("Santé des fichiers"), /contexte\/general\.md[^\n]*titre\(s\) sans identifiant[^\n]*## Sites/, "titre mal formé signalé");
  assert.ok(depuis("plusieurs actions").includes(`\`${pid}\` : 2 action`), "save_progress à deux actions signalé (décision 10) — " + depuis("plusieurs actions").slice(0, 300));
  assert.ok(depuis("Cas lus").includes(`\`${pid2}\` a lu \`${id}\``), "cas lu et suite donnée");
  assert.match(depuis("Jeu de test du triage"), /un-service-touche, independant-du-chemin, population-lieu-lien \| systeme > reseau \| systeme, reseau \| systeme, materiel \| identite \| \*\*oui\*\*/, "signaux cochés → calculés → validés, écart désigné");
  assert.match(depuis("Sections périmées"), /`reseau\/plan-adressage` : datée du 2020-01-01/, "section périmée proposée à confirmation");
  assert.match(depuis("Mesures (T-P7)"), /INC-TEST-42[^\n]*\| incident \| reseau \| 1 \| 3 \| — \| resolu/, "T-P7 rempli");
  fs.rmSync(fVieux);
  const remplissageC = await clientC.callTool({ name: "load_skill", arguments: { domaines: ["remplissage"] } });
  assert.match(texte(remplissageC), /Candidats au remplissage/);
  assert.match(texte(remplissageC), /`reseau\/topologie` \| question \|[^\n]*\| TEST \|/, "question journalisée sur une section vide → candidat");
  assert.match(texte(remplissageC), /`reseau\/acces-distant` \| mise-a-jour \|[^\n]*\| TEST — la section entière reprise par le ticket, puis complétée : un piège connu de plus \|/, "mise à jour proposée jamais appliquée → candidat, en entier (O11)");
  assert.match(texte(remplissageC), /`systeme\/serveurs` \| contradiction \|/, "contradiction notée → candidat");
  // EA3 (campagne sans jeu de données) : la section écrite avec le **début** du candidat (plus de 60 caractères)
  // ne le fait pas disparaître — c'est le candidat entier qui compte, pas un préfixe.
  const majDebut = await clientC.callTool({ name: "update_context", arguments: { section: "reseau/acces-distant", contenu: "TEST — la section entière reprise par le ticket, puis complétée" } });
  assert.ok(!estErreur(majDebut), texte(majDebut));
  const remplissageD = await clientC.callTool({ name: "load_skill", arguments: { domaines: ["remplissage"] } });
  assert.match(texte(remplissageD), /`reseau\/acces-distant` \| mise-a-jour \|/, "EA3 : le candidat qui étend la section reste proposé");
  const majEntier = await clientC.callTool({ name: "update_context", arguments: { section: "reseau/acces-distant", contenu: "TEST — la section entière reprise par le ticket, puis complétée : un piège connu de plus" } });
  assert.ok(!estErreur(majEntier), texte(majEntier));
  const remplissageE = await clientC.callTool({ name: "load_skill", arguments: { domaines: ["remplissage"] } });
  assert.doesNotMatch(texte(remplissageE), /`reseau\/acces-distant` \| mise-a-jour \|/, "candidat appliqué en entier → plus proposé");
  await clientC.close();

  // 8. Domaine décrit, hors bêta : refusé par load_skill, affiché tel quel au triage (produit temporaire).
  const produitTmp = produitAvecDomaineDecrit();
  const client2 = await ouvrir("smoke-decrit", produitTmp);
  const triageDecrit = await client2.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.match(texte(triageDecrit), /`exemple-decrit` — Exemple décrit \| décrit, hors bêta/);
  const horsBeta = await client2.callTool({ name: "load_skill", arguments: { domaines: ["exemple-decrit"], nature: "incident" } });
  assert.ok(estErreur(horsBeta) && /hors bêta/.test(texte(horsBeta)), texte(horsBeta));
  const majDecrit = await client2.callTool({ name: "update_context", arguments: { section: "exemple-decrit/x", contenu: "x" } });
  assert.ok(estErreur(majDecrit) && /sans gabarit/.test(texte(majDecrit)));
  await client2.close();
  fs.rmSync(produitTmp, { recursive: true, force: true });

  // 9. Rien d'écrit hors de installation/.
  const ecrits = fs.readdirSync(installation);
  assert.deepEqual(ecrits.sort(), ["audits", "contexte", "en-cours", "journal", "kb", "tags.yaml", "tickets"]);

  fs.rmSync(installation, { recursive: true, force: true });
  console.log("smoke : OK — neuf appels, six domaines, un domaine décrit synthétique, trois sessions ; ticket", id);
}

main().catch((e) => {
  console.error("smoke : ÉCHEC", e);
  fs.rmSync(installation, { recursive: true, force: true });
  process.exit(1);
});

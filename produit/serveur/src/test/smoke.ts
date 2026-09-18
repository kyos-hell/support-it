// Test de fumée : lance le serveur sur une installation temporaire et joue
// les huit appels dans l'ordre du flux, sur les six domaines livrés. Le cas
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

function texte(res: unknown): string {
  const r = res as { content: { type: string; text?: string }[]; isError?: boolean };
  return r.content.map((c) => c.text ?? "").join("\n");
}
function estErreur(res: unknown): boolean {
  return Boolean((res as { isError?: boolean }).isError);
}

async function main() {
  // Contexte : gabarits copiés, puis une section remplie pour tester l'état « ok ».
  fs.mkdirSync(path.join(installation, "contexte"), { recursive: true });
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
    ["get_context", "load_skill", "publish_kb", "resume_ticket", "save_progress", "save_ticket", "search_kb", "update_context"],
    "huit appels, ni plus ni moins",
  );

  // 1. Triage.
  const triage = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.ok(!estErreur(triage));
  assert.match(texte(triage), /Manifeste des domaines/);
  assert.match(texte(triage), /`reseau`/);
  for (const d of DOMAINES) assert.match(texte(triage), new RegExp("`" + d + "` — [^|]+\\| \\*\\*couvert\\*\\*"), `${d} couvert au manifeste`);
  assert.doesNotMatch(texte(triage), /hors bêta/, "plus aucun domaine décrit hors bêta dans le produit livré");
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
  assert.match(texte(maj1), /section remplacée/);
  assert.match(texte(maj1), /dernière mise à jour : \d{4}-\d{2}-\d{2}/);
  const reseauMd = fs.readFileSync(path.join(installation, "contexte", "reseau.md"), "utf8");
  assert.match(reseauMd, /## plan-adressage — Plan d'adressage et VLAN\n\n<!--[\s\S]*?-->\n\n\| VLAN \| Nom[\s\S]*VLAN-TEST[\s\S]*\nDernière mise à jour : \d{4}-\d{2}-\d{2}\n/, "titre, consigne, contenu, date");
  assert.doesNotMatch(reseauMd, /<numéro> \| <nom>/, "le squelette de la section a été remplacé");
  assert.match(reseauMd, /## wifi — Wifi/, "les autres sections sont intactes");
  const hist = fs.readdirSync(path.join(installation, "contexte", "historique"));
  assert.equal(hist.length, 1, "une sauvegarde de la version précédente");
  assert.match(hist[0], /^reseau-\d{8}-\d{6}\.md$/);
  const relu = await client.callTool({ name: "get_context", arguments: { sections: ["reseau/plan-adressage"] } });
  assert.match(texte(relu), /plan-adressage[^\n]*· ok[\s\S]*VLAN-TEST/);

  const maj2 = await client.callTool({
    name: "update_context",
    arguments: { section: "systeme/serveurs", contenu: "| Serveur | Rôle |\n| --- | --- |\n| SRVTEST | fichiers |" },
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
    arguments: { section: "identite/annuaires", contenu: "| Annuaire | Type |\n| --- | --- |\n| ANNUAIRE-TEST | domaine interne |" },
  });
  assert.ok(!estErreur(majV2), texte(majV2));
  assert.match(texte(majV2), /créé depuis le gabarit/);
  assert.match(fs.readFileSync(path.join(installation, "contexte", "identite.md"), "utf8"), /ANNUAIRE-TEST[\s\S]*## comptes-service — Comptes de service/);

  // C2 : une section qui ne contient que le squelette (en-tête de table + placeholders), même
  // reformulé par rapport au gabarit livré, reste « vide ».
  const majSquelette = await client.callTool({
    name: "update_context",
    arguments: { section: "reseau/wifi", contenu: "| SSID | Usage | Authentification |\n| --- | --- | --- |\n| <nom du réseau> | <qui> | <comment> |" },
  });
  assert.ok(!estErreur(majSquelette), texte(majSquelette));
  const wifiVide = await client.callTool({ name: "get_context", arguments: { sections: ["reseau/wifi"] } });
  assert.match(texte(wifiVide), /reseau\/wifi[^\n]*· vide/, "C2 : squelette seul = vide, quel que soit le gabarit");
  const majInconnue = await client.callTool({ name: "update_context", arguments: { section: "reseau/nexiste-pas", contenu: "x" } });
  assert.ok(estErreur(majInconnue) && /inconnue du fichier/.test(texte(majInconnue)));
  const majDomaine = await client.callTool({ name: "update_context", arguments: { section: "cloud/parc", contenu: "x" } });
  assert.ok(estErreur(majDomaine) && /sans gabarit/.test(texte(majDomaine)));
  const majTitre = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "## wifi — x\ntruc" } });
  assert.ok(estErreur(majTitre) && /une section à la fois/.test(texte(majTitre)));
  const majVide = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "<!-- rien -->" } });
  assert.ok(estErreur(majVide) && /contenu vide/.test(texte(majVide)));

  // 5. Base vide.
  const vide = await client.callTool({ name: "search_kb", arguments: { tags: ["reseau", "vpn"] } });
  assert.match(texte(vide), /Base de connaissances vide/);

  // 5b. Pause et reprise : brouillon créé, fusionné, rattaché par référence, listé, repris, puis clôturé sous le même id.
  const sansSymptome = await client.callTool({ name: "save_progress", arguments: { etape: "triage" } });
  assert.ok(estErreur(sansSymptome) && /symptome_initial/.test(texte(sansSymptome)));
  const p1 = await client.callTool({
    name: "save_progress",
    arguments: { etape: "triage", reference: "INC-PAUSE-1", symptome_initial: "Test : le partage ne répond plus", nature: "incident", domaines_proposes: ["systeme", "reseau"], domaines_valides: ["systeme"], skill_charge: { domaines: ["systeme"], nature: "incident" }, prochaine_etape: "cran 1 : le serveur répond-il ?" },
  });
  assert.ok(!estErreur(p1), texte(p1));
  assert.match(texte(p1), /Brouillon créé/);
  const pid = texte(p1).match(/Brouillon créé : (\S+) ·/)?.[1];
  assert.ok(pid, "id du brouillon");
  assert.ok(fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)));
  const p2 = await client.callTool({
    name: "save_progress",
    arguments: { id: pid, etape: "instruction", verifications: ["cran 1 : ping OK", "cran 2 : disque plein 100 %"], questions: [{ question: "Quel serveur porte le partage ?", reponse: "SRV-TEST", section: "systeme/serveurs" }], prochaine_etape: "cran 3 : état du service" },
  });
  assert.ok(!estErreur(p2) && /Brouillon mis à jour/.test(texte(p2)), texte(p2));
  // A6 : référence fabriquée ; A3 : domaine inconnu ; A4 : référence changée sur un brouillon qui en a une.
  const refFabriquee = await client.callTool({ name: "save_progress", arguments: { etape: "triage", reference: "SANS-REF-20260918", symptome_initial: "Test A6" } });
  assert.ok(estErreur(refFabriquee) && /ne s'invente pas/.test(texte(refFabriquee)), texte(refFabriquee));
  const domaineInconnu = await client.callTool({ name: "save_progress", arguments: { id: pid, etape: "instruction", domaines_valides: ["Systeme", "cloud"] } });
  assert.ok(estErreur(domaineInconnu) && /domaine\(s\) inconnu\(s\) du manifeste : cloud/.test(texte(domaineInconnu)), texte(domaineInconnu));
  const refChangee = await client.callTool({ name: "save_progress", arguments: { id: pid, etape: "instruction", reference: "INC-AUTRE" } });
  assert.ok(estErreur(refChangee) && /mauvais id/.test(texte(refChangee)), texte(refChangee));
  // A5 : sans id ni référence, le même symptôme rattache au lieu de créer un doublon (A2 : à la normalisation près).
  const parSymptome = await client.callTool({ name: "save_progress", arguments: { etape: "instruction", symptome_initial: "test, le partage ne repond plus !", notes: ["rattaché sans id"] } });
  assert.ok(!estErreur(parSymptome) && /rattaché par le symptôme/.test(texte(parSymptome)) && texte(parSymptome).includes(pid), texte(parSymptome));
  const p3 = await client.callTool({
    name: "save_progress",
    arguments: { reference: "inc-pause-1", etape: "pause", verifications: ["Cran 2 — disque plein 100 %."], notes: ["mis en pause pour un ticket urgent"], prochaine_etape: "libérer de l'espace puis cran 3" },
  });
  assert.ok(!estErreur(p3) && /rattaché par la référence/.test(texte(p3)), texte(p3));
  const brouillon = fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8");
  assert.match(brouillon, /^etape: pause$/m);
  assert.match(brouillon, /^reference: INC-PAUSE-1$/m, "la casse d'origine de la référence est conservée");
  assert.equal((brouillon.match(/disque plein 100 %/g) ?? []).length, 1, "vérification dédoublonnée à la clé normalisée (A2), et le corps ne répète pas l'en-tête");
  assert.match(brouillon, /## etat — Où en est le ticket[\s\S]*libérer de l'espace puis cran 3/);
  assert.doesNotMatch(brouillon, /## verifications —/, "le corps du fichier est réduit à l'état");
  assert.match(brouillon, /2 vérification\(s\), 1 question\(s\)/);
  const tropLong = await client.callTool({
    name: "save_progress",
    arguments: { id: pid, etape: "instruction", verifications: ["cran 3 : " + "x".repeat(300)], notes: ["ok"] },
  });
  assert.ok(estErreur(tropLong) && /trop longues[\s\S]*verifications \(3\d\d > 240\)/.test(texte(tropLong)), texte(tropLong));
  const apresRefus = fs.readFileSync(path.join(installation, "en-cours", `${pid}.md`), "utf8");
  assert.doesNotMatch(apresRefus, /- ok$/m, "un appel refusé n'écrit rien, même les entrées valides");
  const liste = await client.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(liste), /1 ticket\(s\) en cours[\s\S]*INC-PAUSE-1[\s\S]*pause/);
  const reprise = await client.callTool({ name: "resume_ticket", arguments: { ticket: "INC-PAUSE-1" } });
  assert.ok(!estErreur(reprise), texte(reprise));
  const trp = texte(reprise);
  assert.match(trp, /# Reprise du ticket \S+ — INC-PAUSE-1/);
  assert.match(trp, /load_skill\(\["systeme"\], "incident"\)/);
  assert.match(trp, /cran 1 : ping OK/);
  assert.match(trp, /Quel serveur porte le partage/);
  assert.doesNotMatch(trp, /^technicien: /m, "l'en-tête YAML n'est pas renvoyé au modèle");
  const inconnuRep = await client.callTool({ name: "resume_ticket", arguments: { ticket: "INC-NEXISTE-PAS" } });
  assert.ok(estErreur(inconnuRep) && /aucun ticket en cours/.test(texte(inconnuRep)));
  const triage2 = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.match(texte(triage2), /Tickets en cours[\s\S]*INC-PAUSE-1/);
  const mauvaisId = await client.callTool({ name: "save_ticket", arguments: { id: "20200101-000000-x-y", symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: [], conclusion: "x", statut: "resolu" } });
  assert.ok(estErreur(mauvaisId) && /brouillon inconnu/.test(texte(mauvaisId)));
  // Un ticket résolu sans plan d'action est refusé, rien n'est écrit.
  const sansPlan = await client.callTool({
    name: "save_ticket",
    arguments: { id: pid, symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "Test : disque plein", statut: "resolu" },
  });
  assert.ok(estErreur(sansPlan) && /plan d'action/.test(texte(sansPlan)), texte(sansPlan));
  assert.ok(fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "un refus ne retire pas le brouillon");
  // A1 : le symptôme paraphrasé à la clôture est ignoré, le brouillon est la source ; A4 à la clôture aussi.
  const clotRef = await client.callTool({
    name: "save_ticket",
    arguments: { id: pid, reference: "INC-AUTRE", symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu" },
  });
  assert.ok(estErreur(clotRef) && /mauvais id/.test(texte(clotRef)), texte(clotRef));
  const clot = await client.callTool({
    name: "save_ticket",
    arguments: { id: pid, symptome_initial: "Le partage ne répond plus (paraphrase de clôture)", nature: "incident", domaines_proposes: ["reseau"], domaines_valides: ["systeme"], conclusion: "Test : disque plein", plan_action: "Test : libérer de l'espace", statut: "resolu", duree_minutes: 999 },
  });
  assert.ok(!estErreur(clot), texte(clot));
  assert.match(texte(clot), new RegExp(`Ticket enregistré : ${pid}\\n`));
  assert.match(texte(clot), /brouillon en cours : retiré/);
  assert.ok(!fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "le brouillon est retiré à la clôture");
  const final = fs.readFileSync(path.join(installation, "tickets", `${pid}.md`), "utf8");
  assert.match(final, /^reference: INC-PAUSE-1$/m, "référence héritée du brouillon");
  assert.match(final, /Test : le partage ne répond plus/, "A1 : le symptôme du brouillon, tel qu'exprimé");
  assert.doesNotMatch(final, /paraphrase de clôture/, "A1 : la paraphrase de la clôture est ignorée");
  assert.match(final, /^domaines_proposes:\n  - systeme\n  - reseau$/m, "domaines proposés du brouillon, pas ceux de la clôture");
  assert.match(final, /^resolu_par: null$/m, "resolu_par omis → null, jamais « outil » par défaut");
  assert.match(final, /^duree_minutes: \d+$/m, "durée calculée par le serveur (création → clôture), pas la valeur donnée");
  assert.doesNotMatch(final, /^duree_minutes: 999$/m);
  assert.match(final, /Quel serveur porte le partage/, "questions du brouillon reprises");
  // A8 : un brouillon dont le ticket existe est un zombie — ignoré, et retiré au premier save_ticket.
  fs.writeFileSync(path.join(installation, "en-cours", `${pid}.md`), brouillon, "utf8");
  const listeZombie = await client.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(listeZombie), /Aucun ticket en cours/, "le zombie n'est pas listé");
  const dejaClos = await client.callTool({ name: "save_ticket", arguments: { id: pid, symptome_initial: "x", nature: "incident", domaines_proposes: [], domaines_valides: ["systeme"], conclusion: "x", plan_action: "x", statut: "resolu" } });
  assert.ok(estErreur(dejaClos) && /déjà clôturé/.test(texte(dejaClos)) && /retiré/.test(texte(dejaClos)), texte(dejaClos));
  assert.ok(!fs.existsSync(path.join(installation, "en-cours", `${pid}.md`)), "le zombie est retiré");
  // B1 : la liste du triage est plafonnée à dix ; resume_ticket() rend tout.
  const ids11: string[] = [];
  for (let i = 1; i <= 11; i++) {
    const p = await client.callTool({ name: "save_progress", arguments: { etape: "triage", symptome_initial: `Test B1 numéro ${i}` } });
    assert.ok(!estErreur(p), texte(p));
    ids11.push(texte(p).match(/Brouillon créé : (\S+) ·/)![1]);
  }
  const triage11 = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.match(texte(triage11), /11 ticket\(s\) en cours[\s\S]*… et 1 autre\(s\) : `resume_ticket\(\)`/);
  const liste11 = await client.callTool({ name: "resume_ticket", arguments: {} });
  assert.equal((texte(liste11).match(/Test B1 numéro/g) ?? []).length, 0, "la liste ne montre pas le symptôme");
  assert.equal((texte(liste11).match(/^\| — \| `/gm) ?? []).length, 11, "resume_ticket() rend les onze");
  for (const i of ids11) fs.rmSync(path.join(installation, "en-cours", `${i}.md`));
  const journalPid = path.join(installation, "journal", `${pid}.md`);
  assert.ok(fs.existsSync(journalPid), "journal écrit depuis les questions du brouillon");
  const tj = fs.readFileSync(journalPid, "utf8");
  assert.match(tj, /^questions: 1$/m);
  assert.match(tj, /^sections_candidates:\n  - systeme\/serveurs$/m, "sections candidates dans l'en-tête");
  assert.match(tj, /## q01 — Question 1[\s\S]*Quel serveur porte le partage[\s\S]*Section candidate : `systeme\/serveurs`/);
  assert.match(texte(clot), /journal : [^\n]*\(1 question\(s\)\)/);
  const listeVide = await client.callTool({ name: "resume_ticket", arguments: {} });
  assert.match(texte(listeVide), /Aucun ticket en cours/);

  // 6. Clôture.
  const cloture = await client.callTool({ name: "load_skill", arguments: { domaines: ["cloture"] } });
  assert.ok(!estErreur(cloture) && /save_ticket/.test(texte(cloture)));
  const sauve = await client.callTool({
    name: "save_ticket",
    arguments: {
      symptome_initial: "Test de fumée : lenteur uniquement via VPN",
      nature: "incident",
      domaines_proposes: ["reseau", "identite"],
      domaines_valides: ["reseau"],
      signaux: ["uniquement via VPN", "tous les services touchés"],
      conclusion: "Test : concentrateur VPN saturé",
      plan_action: "Test : rien",
      questions: [{ question: "Quelle est la passerelle du site ?", reponse: "TEST", section: "reseau/topologie" }],
      mises_a_jour_contexte: [{ section: "reseau/acces-distant", contenu: "TEST" }],
      statut: "resolu",
      tags: ["VPN", "lenteur"],
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
  assert.match(ticket, /^reference: INC-TEST-42$/m, "référence dans l'en-tête");
  assert.match(ticket, /^# Ticket \S+ — INC-TEST-42$/m, "référence dans le titre");
  assert.match(ticket, /- inc-test-42\n/, "référence dans les tags");

  // 7. Non publié : invisible en recherche. Publication, puis visible.
  const avant = await client.callTool({ name: "search_kb", arguments: { tags: ["vpn"] } });
  assert.match(texte(avant), /Base de connaissances vide/);
  const pub = await client.callTool({ name: "publish_kb", arguments: { ticket_id: id, tags: ["concentrateur"] } });
  assert.ok(!estErreur(pub), texte(pub));
  const rePub = await client.callTool({ name: "publish_kb", arguments: { ticket_id: id } });
  assert.ok(estErreur(rePub) && /déjà publié/.test(texte(rePub)));
  const apres = await client.callTool({ name: "search_kb", arguments: { tags: ["vpn", "dns"] } });
  assert.match(texte(apres), /1 cas similaire/);
  assert.match(texte(apres), /score 1/);
  assert.match(texte(apres), /concentrateur/);
  const parRef = await client.callTool({ name: "search_kb", arguments: { tags: ["inc-test-42"] } });
  assert.match(texte(parRef), /— INC-TEST-42 · score 1/);
  const rien = await client.callTool({ name: "search_kb", arguments: { tags: ["imprimante"] } });
  assert.match(texte(rien), /Aucun cas ne partage/);
  const inexistant = await client.callTool({ name: "publish_kb", arguments: { ticket_id: "20200101-000000-x-y" } });
  assert.ok(estErreur(inexistant) && /introuvable/.test(texte(inexistant)));
  assert.match(texte(pub), /symptôme : Test de fumée : lenteur uniquement via VPN/, "la réponse de publish_kb cite ce qui a été publié");
  // Seul un ticket résolu se publie.
  const nonResolu = await client.callTool({
    name: "save_ticket",
    arguments: { symptome_initial: "Test : devis câblage", nature: "demande", domaines_proposes: [], domaines_valides: [], conclusion: "Test : hors domaines", statut: "hors-domaines-couverts" },
  });
  assert.ok(!estErreur(nonResolu), texte(nonResolu));
  const idNonResolu = texte(nonResolu).match(/Ticket enregistré : (\S+)/)![1];
  const pubRefusee = await client.callTool({ name: "publish_kb", arguments: { ticket_id: idNonResolu } });
  assert.ok(estErreur(pubRefusee) && /seul un ticket résolu/.test(texte(pubRefusee)), texte(pubRefusee));
  assert.ok(!fs.existsSync(path.join(installation, "kb", `${idNonResolu}.md`)));

  // 8. Domaine décrit, hors bêta : refusé par load_skill, affiché tel quel au triage (produit temporaire).
  const produitTmp = produitAvecDomaineDecrit();
  const client2 = new Client({ name: "smoke-decrit", version: "0" });
  await client2.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(dist, "index.js")],
      env: { ...process.env, SUPPORT_IT_PRODUIT: produitTmp, SUPPORT_IT_INSTALLATION: installation } as Record<string, string>,
      stderr: "pipe",
    }),
  );
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
  assert.deepEqual(ecrits.sort(), ["contexte", "en-cours", "journal", "kb", "tickets"]);

  await client.close();
  fs.rmSync(installation, { recursive: true, force: true });
  console.log("smoke : OK — huit appels, six domaines, un domaine décrit synthétique ; ticket", id);
}

main().catch((e) => {
  console.error("smoke : ÉCHEC", e);
  fs.rmSync(installation, { recursive: true, force: true });
  process.exit(1);
});

// Test de fumée : lance le serveur sur une installation temporaire et joue
// les cinq appels dans l'ordre du flux. Aucune écriture hors du dossier
// temporaire.
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
    ["get_context", "load_skill", "publish_kb", "save_ticket", "search_kb", "update_context"],
    "six appels, ni plus ni moins",
  );

  // 1. Triage.
  const triage = await client.callTool({ name: "load_skill", arguments: { domaines: ["triage"] } });
  assert.ok(!estErreur(triage));
  assert.match(texte(triage), /Manifeste des domaines/);
  assert.match(texte(triage), /`reseau`/);

  // 2. Domaine inconnu, domaine hors bêta, nature manquante, trois domaines.
  const inconnu = await client.callTool({ name: "load_skill", arguments: { domaines: ["cloud"], nature: "incident" } });
  assert.ok(estErreur(inconnu) && /domaine inconnu/.test(texte(inconnu)));
  const horsBeta = await client.callTool({ name: "load_skill", arguments: { domaines: ["materiel"], nature: "incident" } });
  assert.ok(estErreur(horsBeta) && /hors bêta/.test(texte(horsBeta)));
  const sansNature = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau"] } });
  assert.ok(estErreur(sansNature) && /nature/.test(texte(sansNature)));
  const trop = await client.callTool({ name: "load_skill", arguments: { domaines: ["reseau", "systeme", "reseau"], nature: "incident" } });
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

  const majInconnue = await client.callTool({ name: "update_context", arguments: { section: "reseau/nexiste-pas", contenu: "x" } });
  assert.ok(estErreur(majInconnue) && /inconnue du fichier/.test(texte(majInconnue)));
  const majDomaine = await client.callTool({ name: "update_context", arguments: { section: "materiel/parc", contenu: "x" } });
  assert.ok(estErreur(majDomaine) && /sans gabarit/.test(texte(majDomaine)));
  const majTitre = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "## wifi — x\ntruc" } });
  assert.ok(estErreur(majTitre) && /une section à la fois/.test(texte(majTitre)));
  const majVide = await client.callTool({ name: "update_context", arguments: { section: "reseau/wifi", contenu: "<!-- rien -->" } });
  assert.ok(estErreur(majVide) && /contenu vide/.test(texte(majVide)));

  // 5. Base vide.
  const vide = await client.callTool({ name: "search_kb", arguments: { tags: ["reseau", "vpn"] } });
  assert.match(texte(vide), /Base de connaissances vide/);

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
  assert.ok(fs.existsSync(path.join(installation, "journal", `${id}-q01.md`)));
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

  // 8. Rien d'écrit hors de installation/.
  const ecrits = fs.readdirSync(installation);
  assert.deepEqual(ecrits.sort(), ["contexte", "journal", "kb", "tickets"]);

  await client.close();
  fs.rmSync(installation, { recursive: true, force: true });
  console.log("smoke : OK — six appels exercés, ticket", id);
}

main().catch((e) => {
  console.error("smoke : ÉCHEC", e);
  fs.rmSync(installation, { recursive: true, force: true });
  process.exit(1);
});

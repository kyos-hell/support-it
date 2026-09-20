#!/usr/bin/env bash
# Installe ou met à jour la boîte à outils IA pour le support IT sur ce poste (Linux, macOS).
# Mêmes étapes, dans le même ordre, que install.ps1 :
#   1. prérequis (Node.js >= 18, npm : proposés à l'installation si absents, après un oui explicite ; Claude Code signalé)
#   2. construction du serveur MCP
#   3. validation du produit livré, puis test de fumée du serveur construit
#   4. installation/ : initialiser (premier poste), rejoindre (existant) ou mettre à jour (nouvelle version)
#   5. enregistrement du serveur MCP auprès de Claude Code + point d'entrée /support
#   6. état de remplissage du contexte
# Ne bloque jamais sur un contexte vide. N'écrase jamais un fichier de installation/.
# Mise à jour : remplacer produit/ (ou git pull), relancer ce script — les nouveaux
# gabarits sont copiés, les fichiers remplis ne sont pas touchés.
#
# Usage : ./install.sh [--installation <chemin>] [--sans-claude] [--sans-build] [--sans-test] [--jeu-de-test]
#   --jeu-de-test : phase de test seulement (plan-after-beta.md §3) — après l'étape 4, VIDE
#   l'installation et la remplace par le jeu fictif « Exemple SAS » (outils/jeu-de-test.mjs,
#   dépôt de développement uniquement). Jamais sur une installation réelle.
set -euo pipefail

PRODUIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVEUR="$PRODUIT/serveur"
INSTALLATION=""
SANS_CLAUDE=0
SANS_BUILD=0
SANS_TEST=0
JEU_DE_TEST=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --installation) INSTALLATION="$2"; shift 2 ;;
    --sans-claude) SANS_CLAUDE=1; shift ;;
    --sans-build) SANS_BUILD=1; shift ;;
    --sans-test) SANS_TEST=1; shift ;;
    --jeu-de-test) JEU_DE_TEST=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
done
if [[ -z "$INSTALLATION" ]]; then INSTALLATION="$(dirname "$PRODUIT")/installation"; fi
mkdir -p "$INSTALLATION"
INSTALLATION="$(cd "$INSTALLATION" && pwd)"

etape() { echo; echo "[$1/6] $2"; }
echec() { echo "ECHEC : $1" >&2; exit 1; }

VERSION="$(head -n1 "$PRODUIT/VERSION" | tr -d '[:space:]')"
echo "== support-it $VERSION — installation =="
echo "produit      : $PRODUIT"
echo "installation : $INSTALLATION"

# L'étape 1 est la seule logique qui vit dans les scripts et non dans dist/cli.js :
# tant que Node.js n'est pas là, aucun CLI ne peut tourner (etat-d-avancement.md §4.7).
demander() {
  # Réponse « o » explicite ; tout le reste (dont une entrée non interactive) vaut non.
  if [[ ! -t 0 ]]; then echo "  (entrée non interactive : réponse non)"; return 1; fi
  local r; read -r -p "$1 [o/N] " r; [[ "$r" =~ ^[oO]$ ]]
}
version_node() { if command -v node >/dev/null 2>&1; then node --version | sed 's/^v//'; fi; }
node_ok() { [[ -n "$1" && "${1%%.*}" -ge 18 ]]; }
# Le gestionnaire de paquets du poste, et la commande annoncée telle qu'elle sera lancée.
# Rien si aucun n'est reconnu : jamais de « curl | bash ».
commande_installation() {
  case "$(uname -s)" in
    Darwin) command -v brew >/dev/null 2>&1 && echo "brew install node" ;;
    MINGW*|MSYS*|CYGWIN*) command -v winget.exe >/dev/null 2>&1 && echo "winget.exe install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements" ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then echo "sudo apt-get install -y nodejs npm"
      elif command -v dnf >/dev/null 2>&1; then echo "sudo dnf install -y nodejs npm"; fi ;;
  esac
  return 0
}
recharger_path() {
  hash -r
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      # winget écrit le PATH dans le registre, pas dans cette console : on ajoute le dossier standard de Node.js.
      local p
      for p in "/c/Program Files/nodejs" "$(cygpath -u "${LOCALAPPDATA:-}" 2>/dev/null)/Programs/nodejs"; do
        [[ -d "$p" ]] && PATH="$p:$PATH"
      done ;;
  esac
  return 0
}

etape 1 "Prérequis"
NODE_VERSION="$(version_node)"
if [[ -n "$NODE_VERSION" ]]; then echo "  node $NODE_VERSION"; else echo "  node : absent"; fi
if command -v npm >/dev/null 2>&1; then echo "  npm $(npm --version)"; else echo "  npm  : absent"; fi
if ! node_ok "$NODE_VERSION" || ! command -v npm >/dev/null 2>&1; then
  if [[ -z "$NODE_VERSION" ]]; then MANQUE="Node.js absent"
  elif ! node_ok "$NODE_VERSION"; then MANQUE="Node.js $NODE_VERSION trop ancien (18 minimum)"
  else MANQUE="npm absent (livré avec Node.js)"; fi
  COMMANDE="$(commande_installation)"
  [[ -n "$COMMANDE" ]] || echec "$MANQUE. Aucun gestionnaire de paquets reconnu : installer Node.js LTS depuis https://nodejs.org puis relancer ce script."
  echo "  $MANQUE. Ce script peut l'installer avec le gestionnaire du poste :"
  echo "    $COMMANDE"
  demander "  Installer maintenant ?" || echec "$MANQUE. Lancer la commande ci-dessus (ou https://nodejs.org, LTS) puis relancer ce script."
  $COMMANDE || echec "l'installation a échoué : installer Node.js LTS depuis https://nodejs.org puis relancer ce script."
  recharger_path
  NODE_VERSION="$(version_node)"
  if ! node_ok "$NODE_VERSION" || ! command -v npm >/dev/null 2>&1; then
    echec "Node.js installé mais introuvable ou trop ancien dans cette console (node ${NODE_VERSION:-absent}) : ouvrir une nouvelle console, ou https://nodejs.org (LTS), puis relancer ce script."
  fi
  echo "  node $NODE_VERSION, npm $(npm --version) : installés"
fi
if command -v claude >/dev/null 2>&1; then
  echo "  claude CLI présent : $(command -v claude)"
else
  echo "  claude CLI absent du PATH : le serveur s'enregistre dans .mcp.json (portée projet), sans lui"
fi

etape 2 "Construction du serveur MCP"
if [[ "$SANS_BUILD" -eq 1 ]]; then
  echo "  ignorée (--sans-build)"
else
  (cd "$SERVEUR" && npm install --no-audit --no-fund && npm run build) || echec "construction du serveur en échec"
fi
CLI="$SERVEUR/dist/cli.js"
[[ -f "$CLI" ]] || echec "serveur non construit : $CLI absent"

export SUPPORT_IT_PRODUIT="$PRODUIT"
export SUPPORT_IT_INSTALLATION="$INSTALLATION"

etape 3 "Validation du produit livré et test de fumée"
node "$CLI" valider || echec "le produit livré ne passe pas la validation : ne pas installer une livraison invalide"
if [[ "$SANS_TEST" -eq 1 ]]; then
  echo "  test de fumée ignoré (--sans-test)"
else
  node "$CLI" tester || echec "le test de fumée échoue sur ce poste : ne pas installer un serveur qui ne répond pas"
fi

etape 4 "Arborescence client"
node "$CLI" init || echec "initialisation de installation/ en échec"
if [[ "$JEU_DE_TEST" -eq 1 ]]; then
  JEU="$(dirname "$PRODUIT")/outils/jeu-de-test.mjs"
  [[ -f "$JEU" ]] || echec "jeu de test introuvable : $JEU (option réservée au dépôt de développement, outils/ n'est pas livré)"
  echo "  JEU DE TEST : l'installation est VIDÉE puis remplacée par le jeu fictif « Exemple SAS »"
  node "$JEU" --reinitialiser || echec "génération du jeu de test en échec"
fi

etape 5 "Claude Code : serveur MCP et point d'entrée /support"
if [[ "$SANS_CLAUDE" -eq 1 ]]; then
  echo "  ignorée (--sans-claude)"
else
  node "$CLI" enregistrer || echec "enregistrement du serveur MCP en échec"
  node "$CLI" entree || echec "installation du point d'entrée en échec"
  node "$CLI" hote || echec "dépôt des permissions Claude Code (.claude/settings.json) en échec"
fi

etape 6 "État de remplissage du contexte et audit"
node "$CLI" etat
node "$CLI" audit || echo "  audit : des constats de santé des fichiers sont à corriger à la main (voir installation/audits/)"

echo
echo "Installation terminée ($VERSION)."
echo "  - Remplir le contexte : $INSTALLATION/contexte/*.md (recommandé, pas obligatoire),"
echo "    ou laisser l'outil le faire par conversation : /support remplis le contexte."
echo "  - Redémarrer Claude Code, vérifier /mcp (support-it, neuf outils), puis taper /support suivi du ticket."
echo "  - Lancer Claude Code depuis le dossier parent de produit/ : .claude/settings.json y interdit au modèle"
echo "    d'écrire dans installation/, de lire kb/ et en-cours/ directement, et d'exécuter une commande (Bash, PowerShell)."
echo "    La règle « l'IA n'exécute rien, le technicien exécute » est tenue par ce fichier, pas par le mode de permission."

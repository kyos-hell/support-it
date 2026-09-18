#!/usr/bin/env bash
# Installe ou met à jour la boîte à outils IA pour le support IT sur ce poste (Linux, macOS).
# Mêmes étapes, dans le même ordre, que install.ps1 :
#   1. prérequis (Node.js >= 18, npm ; Claude Code signalé)
#   2. construction du serveur MCP
#   3. validation du produit livré, puis test de fumée du serveur construit
#   4. installation/ : initialiser (premier poste), rejoindre (existant) ou mettre à jour (nouvelle version)
#   5. enregistrement du serveur MCP auprès de Claude Code + point d'entrée /support
#   6. état de remplissage du contexte
# Ne bloque jamais sur un contexte vide. N'écrase jamais un fichier de installation/.
# Mise à jour : remplacer produit/ (ou git pull), relancer ce script — les nouveaux
# gabarits sont copiés, les fichiers remplis ne sont pas touchés.
#
# Usage : ./install.sh [--installation <chemin>] [--sans-claude] [--sans-build] [--sans-test]
set -euo pipefail

PRODUIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVEUR="$PRODUIT/serveur"
INSTALLATION=""
SANS_CLAUDE=0
SANS_BUILD=0
SANS_TEST=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --installation) INSTALLATION="$2"; shift 2 ;;
    --sans-claude) SANS_CLAUDE=1; shift ;;
    --sans-build) SANS_BUILD=1; shift ;;
    --sans-test) SANS_TEST=1; shift ;;
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

etape 1 "Prérequis"
command -v node >/dev/null 2>&1 || echec "Node.js introuvable. Claude Code l'installe normalement ; sinon https://nodejs.org (LTS)."
NODE_VERSION="$(node --version | sed 's/^v//')"
MAJOR="${NODE_VERSION%%.*}"
[[ "$MAJOR" -ge 18 ]] || echec "Node.js $NODE_VERSION trop ancien : 18 minimum."
echo "  node $NODE_VERSION"
command -v npm >/dev/null 2>&1 || echec "npm introuvable (livré avec Node.js)."
echo "  npm $(npm --version)"
if command -v claude >/dev/null 2>&1; then
  echo "  claude CLI présent : $(command -v claude)"
else
  echo "  claude CLI absent du PATH : l'enregistrement écrira directement ~/.claude.json"
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

etape 5 "Claude Code : serveur MCP et point d'entrée /support"
if [[ "$SANS_CLAUDE" -eq 1 ]]; then
  echo "  ignorée (--sans-claude)"
else
  node "$CLI" enregistrer || echec "enregistrement du serveur MCP en échec"
  node "$CLI" entree || echec "installation du point d'entrée en échec"
  node "$CLI" hote || echec "dépôt des permissions Claude Code (.claude/settings.json) en échec"
fi

etape 6 "État de remplissage du contexte"
node "$CLI" etat

echo
echo "Installation terminée ($VERSION)."
echo "  - Remplir le contexte : $INSTALLATION/contexte/*.md (recommandé, pas obligatoire),"
echo "    ou laisser l'outil le faire par conversation : /support remplis le contexte."
echo "  - Redémarrer Claude Code, vérifier /mcp (support-it, neuf outils), puis taper /support suivi du ticket."
echo "  - Lancer Claude Code depuis le dossier parent de produit/ : .claude/settings.json y interdit au modèle"
echo "    d'écrire dans installation/, de lire kb/ et en-cours/ directement, et d'exécuter une commande (Bash, PowerShell)."
echo "    La règle « l'IA n'exécute rien, le technicien exécute » est tenue par ce fichier, pas par le mode de permission."

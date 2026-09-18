<#
.SYNOPSIS
  Installe ou met à jour la boîte à outils IA pour le support IT sur ce poste (Windows).
.DESCRIPTION
  Mêmes étapes, dans le même ordre, que install.sh :
    1. prérequis (Node.js >= 18, npm ; Claude Code signalé)
    2. construction du serveur MCP
    3. validation du produit livré, puis test de fumée du serveur construit
    4. installation/ : initialiser (premier poste), rejoindre (existant) ou mettre à jour (nouvelle version)
    5. enregistrement du serveur MCP auprès de Claude Code + point d'entrée /support
    6. état de remplissage du contexte
  Ne bloque jamais sur un contexte vide. N'écrase jamais un fichier de installation/.
  Mise à jour : remplacer produit/ (ou git pull), relancer ce script — les nouveaux
  gabarits sont copiés, les fichiers remplis ne sont pas touchés.
  Si PowerShell refuse d'exécuter le script (politique d'exécution) :
    powershell -ExecutionPolicy Bypass -File .\install.ps1
.PARAMETER Installation
  Racine de l'arborescence client (installation/). Défaut : à côté de produit/.
  Pour un partage : -Installation \\serveur\support-it\installation
.PARAMETER SansClaude
  N'enregistre ni le serveur ni /support (tests, ou poste sans Claude Code).
.PARAMETER SansBuild
  Ne relance ni npm install ni la compilation (déjà faits).
.PARAMETER SansTest
  Ne lance pas le test de fumée à l'étape 3 (poste très lent, ou test déjà joué).
#>
param(
  [string]$Installation = "",
  [switch]$SansClaude,
  [switch]$SansBuild,
  [switch]$SansTest
)

$ErrorActionPreference = "Stop"
# Les messages du script et de node sont en UTF-8 : sans cela, la console
# Windows affiche les accents en mojibake. Sans effet ailleurs.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Produit = $PSScriptRoot
$Serveur = Join-Path $Produit "serveur"
if (-not $Installation) { $Installation = Join-Path (Split-Path $Produit -Parent) "installation" }
$Installation = [System.IO.Path]::GetFullPath($Installation)

function Etape($n, $titre) { Write-Host ""; Write-Host "[$n/6] $titre" -ForegroundColor Cyan }
function Echec($msg) { Write-Host "ECHEC : $msg" -ForegroundColor Red; exit 1 }

$Version = (Get-Content (Join-Path $Produit 'VERSION') -TotalCount 1).Trim()
Write-Host "== support-it $Version — installation =="
Write-Host "produit      : $Produit"
Write-Host "installation : $Installation"

Etape 1 "Prérequis"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Echec "Node.js introuvable. Claude Code l'installe normalement ; sinon https://nodejs.org (LTS)." }
$nodeVersion = (& node --version).TrimStart("v")
$major = [int]($nodeVersion.Split(".")[0])
if ($major -lt 18) { Echec "Node.js $nodeVersion trop ancien : 18 minimum." }
Write-Host "  node $nodeVersion"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Echec "npm introuvable (livré avec Node.js)." }
Write-Host "  npm $(& npm --version)"
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) { Write-Host "  claude CLI présent : $($claude.Source)" } else { Write-Host "  claude CLI absent du PATH : l'enregistrement écrira directement ~/.claude.json" }

Etape 2 "Construction du serveur MCP"
if ($SansBuild) {
  Write-Host "  ignorée (-SansBuild)"
} else {
  Push-Location $Serveur
  try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Echec "npm install a échoué" }
    & npm run build
    if ($LASTEXITCODE -ne 0) { Echec "compilation TypeScript en échec" }
  } finally { Pop-Location }
}
$Cli = Join-Path $Serveur "dist\cli.js"
if (-not (Test-Path $Cli)) { Echec "serveur non construit : $Cli absent" }

$env:SUPPORT_IT_PRODUIT = $Produit
$env:SUPPORT_IT_INSTALLATION = $Installation

Etape 3 "Validation du produit livré et test de fumée"
& node $Cli valider
if ($LASTEXITCODE -ne 0) { Echec "le produit livré ne passe pas la validation : ne pas installer une livraison invalide" }
if ($SansTest) {
  Write-Host "  test de fumée ignoré (-SansTest)"
} else {
  & node $Cli tester
  if ($LASTEXITCODE -ne 0) { Echec "le test de fumée échoue sur ce poste : ne pas installer un serveur qui ne répond pas" }
}

Etape 4 "Arborescence client"
& node $Cli init
if ($LASTEXITCODE -ne 0) { Echec "initialisation de installation/ en échec" }

Etape 5 "Claude Code : serveur MCP et point d'entrée /support"
if ($SansClaude) {
  Write-Host "  ignorée (-SansClaude)"
} else {
  & node $Cli enregistrer
  if ($LASTEXITCODE -ne 0) { Echec "enregistrement du serveur MCP en échec" }
  & node $Cli entree
  if ($LASTEXITCODE -ne 0) { Echec "installation du point d'entrée en échec" }
  & node $Cli hote
  if ($LASTEXITCODE -ne 0) { Echec "dépôt des permissions Claude Code (.claude/settings.json) en échec" }
}

Etape 6 "État de remplissage du contexte et audit"
& node $Cli etat
& node $Cli audit
if ($LASTEXITCODE -ne 0) { Write-Host "  audit : des constats de santé des fichiers sont à corriger à la main (voir installationaudits)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Installation terminée ($Version)." -ForegroundColor Green
Write-Host "  - Remplir le contexte : $Installation\contexte\*.md (recommandé, pas obligatoire),"
Write-Host "    ou laisser l'outil le faire par conversation : /support remplis le contexte."
Write-Host "  - Redémarrer Claude Code, vérifier /mcp (support-it, neuf outils), puis taper /support suivi du ticket."
Write-Host "  - Lancer Claude Code depuis le dossier parent de produit/ : .claude/settings.json y interdit au modèle"
Write-Host "    d'écrire dans installation/, de lire kb/ et en-cours/ directement, et d'exécuter une commande (Bash, PowerShell)."
Write-Host "    La règle « l'IA n'exécute rien, le technicien exécute » est tenue par ce fichier, pas par le mode de permission."

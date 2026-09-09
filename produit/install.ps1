<#
.SYNOPSIS
  Installe la boîte à outils IA pour le support IT sur ce poste (Windows).
.DESCRIPTION
  Mêmes étapes, dans le même ordre, que install.sh :
    1. prérequis (Node.js >= 18, npm ; Claude Code signalé)
    2. construction du serveur MCP
    3. validation du produit livré
    4. installation/ : initialiser (premier poste) ou rejoindre (existant)
    5. enregistrement du serveur MCP auprès de Claude Code + point d'entrée /support
    6. état de remplissage du contexte
  Ne bloque jamais sur un contexte vide. N'écrase jamais un fichier de installation/.
.PARAMETER Installation
  Racine de l'arborescence client (installation/). Défaut : à côté de produit/.
  Pour un partage : -Installation \\serveur\support-it\installation
.PARAMETER SansClaude
  N'enregistre ni le serveur ni /support (tests, ou poste sans Claude Code).
.PARAMETER SansBuild
  Ne relance ni npm install ni la compilation (déjà faits).
#>
param(
  [string]$Installation = "",
  [switch]$SansClaude,
  [switch]$SansBuild
)

$ErrorActionPreference = "Stop"
$Produit = $PSScriptRoot
$Serveur = Join-Path $Produit "serveur"
if (-not $Installation) { $Installation = Join-Path (Split-Path $Produit -Parent) "installation" }
$Installation = [System.IO.Path]::GetFullPath($Installation)

function Etape($n, $titre) { Write-Host ""; Write-Host "[$n/6] $titre" -ForegroundColor Cyan }
function Echec($msg) { Write-Host "ECHEC : $msg" -ForegroundColor Red; exit 1 }

Write-Host "== support-it $(Get-Content (Join-Path $Produit 'VERSION') -TotalCount 1) — installation =="
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

Etape 3 "Validation du produit livré"
& node $Cli valider
if ($LASTEXITCODE -ne 0) { Echec "le produit livré ne passe pas la validation : ne pas installer une livraison invalide" }

Etape 4 "Arborescence client"
if (Test-Path (Join-Path $Installation "contexte")) {
  Write-Host "  mode : REJOINDRE une installation existante (rien n'y sera écrasé)"
} else {
  Write-Host "  mode : INITIALISER une nouvelle installation"
}
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
}

Etape 6 "État de remplissage du contexte"
& node $Cli etat

Write-Host ""
Write-Host "Installation terminée." -ForegroundColor Green
Write-Host "  - Remplir le contexte : $Installation\contexte\*.md (recommandé, pas obligatoire)."
Write-Host "  - Redémarrer Claude Code, puis taper /support suivi de la description du ticket."
Write-Host "  - Mode de permission : garder le mode par défaut (confirmation avant chaque commande)."
Write-Host "    La règle « l'IA n'exécute rien, le technicien exécute » n'est tenue que par ce mode."

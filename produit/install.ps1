<#
.SYNOPSIS
  Installe ou met à jour la boîte à outils IA pour le support IT sur ce poste (Windows).
.DESCRIPTION
  Mêmes étapes, dans le même ordre, que install.sh :
    1. prérequis (Node.js >= 18, npm : proposés à l'installation si absents, après un oui explicite ; Claude Code signalé)
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
.PARAMETER JeuDeTest
  Phase de test seulement (plan-after-beta.md §3) : après l'étape 4, VIDE l'installation et la
  remplace par le jeu de données fictif « Exemple SAS » (outils/jeu-de-test.mjs, dépôt de
  développement uniquement — outils/ n'est pas livré). Jamais sur une installation réelle.
#>
param(
  [string]$Installation = "",
  [switch]$SansClaude,
  [switch]$SansBuild,
  [switch]$SansTest,
  [switch]$JeuDeTest
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

# L'étape 1 est la seule logique qui vit dans les scripts et non dans dist/cli.js :
# tant que Node.js n'est pas là, aucun CLI ne peut tourner (etat-d-avancement.md §4.7).
function Demander($question) {
  # Réponse « o » explicite ; tout le reste (dont une entrée non interactive) vaut non.
  if ([Console]::IsInputRedirected) { Write-Host "  (entrée non interactive : réponse non)"; return $false }
  $r = Read-Host "$question [o/N]"
  return ($r -match '^[oO]$')
}
function VersionNode() {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $null }
  return (& node --version).TrimStart("v")
}
function NodeOk($v) { if (-not $v) { return $false }; return ([int]($v.Split(".")[0]) -ge 18) }
function RechargerPath() {
  # winget écrit le PATH dans le registre, pas dans cette console : on le relit.
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Etape 1 "Prérequis"
$nodeVersion = VersionNode
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($nodeVersion) { Write-Host "  node $nodeVersion" } else { Write-Host "  node : absent" }
if ($npmCmd) { Write-Host "  npm $(& npm --version)" } else { Write-Host "  npm  : absent" }
if (-not (NodeOk $nodeVersion) -or -not $npmCmd) {
  if (-not $nodeVersion) { $manque = "Node.js absent" }
  elseif (-not (NodeOk $nodeVersion)) { $manque = "Node.js $nodeVersion trop ancien (18 minimum)" }
  else { $manque = "npm absent (livré avec Node.js)" }
  $commande = "winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements"
  if (-not $winget) { Echec "$manque. Aucun gestionnaire de paquets reconnu : installer Node.js LTS depuis https://nodejs.org puis relancer ce script." }
  Write-Host "  $manque. Ce script peut l'installer avec le gestionnaire du poste :" -ForegroundColor Yellow
  Write-Host "    $commande"
  if (-not (Demander "  Installer maintenant ?")) { Echec "$manque. Lancer la commande ci-dessus (ou https://nodejs.org, LTS) puis relancer ce script." }
  & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Echec "l'installation a échoué (winget, code $LASTEXITCODE) : installer Node.js LTS depuis https://nodejs.org puis relancer ce script." }
  RechargerPath
  $nodeVersion = VersionNode
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if (-not (NodeOk $nodeVersion) -or -not $npmCmd) {
    if ($nodeVersion) { $vu = "node $nodeVersion" } else { $vu = "node absent" }
    Echec "Node.js installé mais introuvable ou trop ancien dans cette console ($vu) : ouvrir une nouvelle console, ou https://nodejs.org (LTS), puis relancer ce script."
  }
  Write-Host "  node $nodeVersion, npm $(& npm --version) : installés"
}
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) { Write-Host "  claude CLI présent : $($claude.Source)" } else { Write-Host "  claude CLI absent du PATH : le serveur s'enregistre dans .mcp.json (portée projet), sans lui" }

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
if ($JeuDeTest) {
  $Jeu = Join-Path (Split-Path $Produit -Parent) "outils\jeu-de-test.mjs"
  if (-not (Test-Path $Jeu)) { Echec "jeu de test introuvable : $Jeu (option réservée au dépôt de développement, outils/ n'est pas livré)" }
  Write-Host "  JEU DE TEST : l'installation est VIDÉE puis remplacée par le jeu fictif « Exemple SAS »" -ForegroundColor Yellow
  & node $Jeu --reinitialiser
  if ($LASTEXITCODE -ne 0) { Echec "génération du jeu de test en échec" }
}

Etape 5 "Claude Code : serveur MCP et point d'entrée /support"
if ($SansClaude) {
  Write-Host "  ignorée (-SansClaude)"
} else {
  & node $Cli enregistrer
  if ($LASTEXITCODE -ne 0) { Echec "enregistrement du serveur MCP en échec" }
  & node $Cli entree
  if ($LASTEXITCODE -ne 0) { Echec "installation du point d'entrée en échec" }
  # Décision 50 : /support en portée projet, et aucun skill « support » global qui le masque.
  $EntreeProjet = Join-Path (Split-Path $Produit -Parent) ".claude\skills\support\SKILL.md"
  if (-not (Test-Path $EntreeProjet)) { Echec "point d'entrée absent après installation : $EntreeProjet" }
  $EntreeGlobale = Join-Path $HOME ".claude\skills\support\SKILL.md"
  if (Test-Path $EntreeGlobale) {
    Write-Host "  ATTENTION : $EntreeGlobale existe encore. Claude Code le fait passer avant celui du projet, et il se charge hors du dossier support-it : le renommer ou le retirer à la main." -ForegroundColor Yellow
  } else {
    Write-Host "  vérifié : /support en portée projet seulement ($EntreeProjet), aucun skill « support » global"
  }
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
Write-Host "  - Redémarrer Claude Code, puis taper /support : le premier appel (triage) prouve que le serveur répond."
Write-Host "    (/mcp est peu lisible dans l'app desktop : il mêle ses propres serveurs et ouvre parfois le catalogue.)"
Write-Host "  - Ouvrir Claude Code DANS le dossier support-it ($(Split-Path $Produit -Parent)), le parent de produit/."
Write-Host "    Hors de ce dossier, /support et le serveur n'existent pas : c'est voulu."
Write-Host "    .claude/settings.json y interdit au modèle"
Write-Host "    d'écrire dans installation/, de lire kb/ et en-cours/ directement, et d'exécuter une commande (Bash, PowerShell)."
Write-Host "    La règle « l'IA n'exécute rien, le technicien exécute » est tenue par ce fichier, pas par le mode de permission."

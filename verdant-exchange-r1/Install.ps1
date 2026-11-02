param([string]$TtsRoot = '')
$ErrorActionPreference = 'Stop'
try {
 if ([string]::IsNullOrWhiteSpace($TtsRoot)) { $TtsRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\Tabletop Simulator' }
 $saves = Join-Path $TtsRoot 'Saves'
 if (-not (Test-Path -LiteralPath $saves -PathType Container)) { throw 'TTS Saves folder not found. Pass your Tabletop Simulator folder to Install.cmd.' }
 $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Install-Manifest.json') -Raw | ConvertFrom-Json
 foreach ($entry in $manifest) { if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $entry.path) -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Package verification failed: ' + $entry.path) } }
 $bagRoot = Join-Path $saves 'Saved Objects'
 $backup = Join-Path $TtsRoot ('Lobo Map Backups\Verdant-Exchange-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
 $null = New-Item -ItemType Directory -Path $backup -Force
 $null = New-Item -ItemType Directory -Path $bagRoot -Force
 foreach ($entry in $manifest) {
  if ($entry.path.StartsWith('Map-Bags')) {
   $destination = Join-Path $bagRoot (Split-Path $entry.path -Leaf)
   if (Test-Path -LiteralPath $destination) { Copy-Item -LiteralPath $destination -Destination $backup -Force }
   Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.path) -Destination $destination -Force
   if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Installed file verification failed: ' + $destination) }
  }
 }
 foreach ($legacyName in @('Verdant-Exchange-Uplink-Center-R1.json','Verdant-Exchange-Uplink-Center-R1.png')) {
  $legacyPath = Join-Path $bagRoot $legacyName
  if (Test-Path -LiteralPath $legacyPath) {
   Copy-Item -LiteralPath $legacyPath -Destination $backup -Force
   Remove-Item -LiteralPath $legacyPath -Force
  }
 }
 Write-Host 'Installed Verdant Exchange R2 as Verdant-Exchange-Uplink-Center-R2 in the main Saved Objects folder.' -ForegroundColor Green
 Write-Host 'In TTS, open Objects > Saved Objects and choose Verdant-Exchange-Uplink-Center-R2. Drop its bag on the Infinity map deployment stage.'
 Write-Host 'This installer does not publish to Steam.'
 exit 0
} catch { Write-Host ('Installation failed: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }

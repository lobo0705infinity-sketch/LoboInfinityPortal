param([string]$TTSDataPath = '')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$tts = if ($TTSDataPath) { $TTSDataPath } else { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\Tabletop Simulator' }
$saves = Join-Path $tts 'Saves'
$source = Join-Path $root 'Clash-of-Empires-Workshop-Release.json'
$preview = Join-Path $root 'Workshop-Thumbnail.png'
$manifestPath = Join-Path $root 'Asset-Cache.json'
foreach ($path in @($source,$preview,$manifestPath)) {
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Extract the complete installer ZIP before running Install.' }
}
$manifest = ConvertFrom-Json -InputObject (Get-Content -Raw -LiteralPath $manifestPath)
if ($manifest.revision -ne 'R12' -or @($manifest.assets).Count -lt 700) { throw 'The asset cache manifest is incomplete.' }
if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $manifest.save_sha256) { throw 'The save file failed verification. Extract the ZIP again.' }
# Use the native Unicode file-copy API so long TTS cache paths also work under
# Windows PowerShell 5.1. Payload hashes are checked before any files are copied.
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class LoboCacheCopy {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CopyFileW(string source, string destination, bool failIfExists);
}
'@
function Get-ExtendedPath([string]$path) {
    $full = [IO.Path]::GetFullPath($path)
    if ($full.StartsWith('\\')) { return '\\?\UNC\' + $full.Substring(2) }
    return '\\?\' + $full
}
$verified = @{}
foreach ($entry in $manifest.assets) {
    if ($entry.file -notmatch '^[a-f0-9]{64}\.(obj|jpg|png)$' -or
        $entry.sha256 -notmatch '^[a-f0-9]{64}$' -or
        $entry.cache -notmatch '^https[A-Za-z0-9]+\.(obj|jpg|png)$') { throw 'Invalid asset cache entry.' }
    if (!$verified.ContainsKey($entry.file)) {
        $payload = Join-Path (Join-Path $root 'Assets') $entry.file
        if ((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Asset verification failed: $($entry.file)" }
        $verified[$entry.file] = $true
    }
}
Write-Host "Verified $($verified.Count) asset payloads. Installing the TTS cache..."
foreach ($entry in $manifest.assets) {
    $folder = if ($entry.file.EndsWith('.obj')) { 'Mods\Models' } else { 'Mods\Images' }
    $cache = Join-Path $tts $folder
    New-Item -Path $cache -ItemType Directory -Force | Out-Null
    $payload = Join-Path (Join-Path $root 'Assets') $entry.file
    $target = Join-Path $cache $entry.cache
    if (![LoboCacheCopy]::CopyFileW((Get-ExtendedPath $payload), (Get-ExtendedPath $target), $false)) {
        $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Asset cache copy failed (Windows error $code)."
    }
}
New-Item -Path $saves -ItemType Directory -Force | Out-Null
$hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$length = (Get-Item -LiteralPath $source).Length
$slot = 1
foreach ($existing in Get-ChildItem -LiteralPath $saves -File) {
    if ($existing.Name -notmatch '^TS_Save_(\d+)\.(json|png)$') { continue }
    $slot = [Math]::Max($slot, [long]$Matches[1] + 1)
    if ($existing.Extension -eq '.json' -and $existing.Length -eq $length -and
        (Get-FileHash -LiteralPath $existing.FullName -Algorithm SHA256).Hash -eq $hash) {
        Write-Host 'Already installed: Clash of Empires - Full Collection R12 - Original 13 Audit.'
        exit 0
    }
}
$destination = Join-Path $saves ("TS_Save_${slot}.json")
$thumbnail = Join-Path $saves ("TS_Save_${slot}.png")
$token = [Guid]::NewGuid().ToString('N')
$stagedSave = Join-Path $saves ("lobo-${token}.tmp")
$stagedThumbnail = Join-Path $saves ("lobo-${token}-preview.tmp")
$thumbnailInstalled = $false
try {
    [IO.File]::Copy($source, $stagedSave)
    [IO.File]::Copy($preview, $stagedThumbnail)
    if ((Get-FileHash -LiteralPath $stagedSave -Algorithm SHA256).Hash -ne $hash) { throw 'Save copy verification failed.' }
    [IO.File]::Move($stagedThumbnail, $thumbnail)
    $thumbnailInstalled = $true
    [IO.File]::Move($stagedSave, $destination)
} catch {
    if ($thumbnailInstalled) { Remove-Item -LiteralPath $thumbnail -ErrorAction SilentlyContinue }
    throw
} finally {
    Remove-Item -LiteralPath $stagedSave, $stagedThumbnail -ErrorAction SilentlyContinue
}
Write-Host 'Installed Clash of Empires - Full Collection R12 - Original 13 Audit.'
Write-Host 'Open it in Games > Save & Load. Use Update Workshop to publish this save to your existing entry.'

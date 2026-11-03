# Запуск VTT (хост Мастера) в собранном виде, без консольного окна.
# Скрипт рассчитан на Windows PowerShell 5.1; вызывается ярлыком VTT.lnk.
#
# Важно: Electron не стартует, если в пути к electron.exe есть кириллица
# (например, «Проект по умолчанию»), поэтому лаунчер держит его ASCII-копию
# в %LOCALAPPDATA%\VTT\electron-<версия>.

$ErrorActionPreference = 'Stop'

# Унаследованные от других Electron-приложений переменные ломают запуск
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:CHROME_CRASHPAD_PIPE_NAME -ErrorAction SilentlyContinue

$root = Split-Path -Parent $PSScriptRoot
$hostDir = Join-Path $root 'desktop-host'
$mainBundle = Join-Path $hostDir 'out\main\index.js'
$clientIndex = Join-Path $root 'web-client\dist\index.html'
$logDir = Join-Path $hostDir 'out'
$logFile = Join-Path $logDir 'launcher.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Log([string]$message) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Show-Error([string]$message) {
  Write-Log ('ОШИБКА: ' + $message)
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      $message,
      'VTT — не удалось запустить',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    # Если MessageBox недоступен, ошибка останется только в логе
  }
}

function Invoke-Build {
  Write-Log 'Сборка не найдена — выполняю npm run build (это может занять минуту)…'
  Push-Location $root
  try {
    & npm.cmd run build 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
      throw 'Сборка завершилась с ошибкой. Подробности: desktop-host\out\launcher.log'
    }
  } finally {
    Pop-Location
  }
}

function Find-ElectronDist {
  $candidates = @(
    (Join-Path $root 'node_modules\electron\dist'),
    (Join-Path $hostDir 'node_modules\electron\dist')
  )
  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate 'electron.exe')) { return $candidate }
  }
  return $null
}

function Get-AsciiRoot {
  # Кириллица в пути к electron.exe не даёт Chromium стартовать — держим копии
  # в ASCII-папке. Если имя пользователя тоже не ASCII, используем общую папку.
  $targetRoot = Join-Path $env:LOCALAPPDATA 'VTT'
  if ($targetRoot -match '[^\x20-\x7E]') {
    $publicRoot = Join-Path $env:PUBLIC 'VTT'
    if ($publicRoot -notmatch '[^\x20-\x7E]') { $targetRoot = $publicRoot }
  }
  New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
  return $targetRoot
}

function Get-AsciiElectron([string]$sourceDist) {
  $sourceVersion = 'unknown'
  $versionFile = Join-Path $sourceDist 'version'
  if (Test-Path $versionFile) {
    $sourceVersion = (Get-Content $versionFile -Raw).Trim()
  }

  $targetRoot = Get-AsciiRoot
  $targetDir = Join-Path $targetRoot ('electron-' + $sourceVersion)
  $targetExe = Join-Path $targetDir 'electron.exe'

  if (-not (Test-Path $targetExe)) {
    Write-Log ('Копирую Electron ' + $sourceVersion + ' в ' + $targetDir)
    $robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
    & $robocopy $sourceDist $targetDir /E /NFL /NDL /NJH /NJS /NP /XF vtt-host.exe | Out-Null
    if ($LASTEXITCODE -ge 8) {
      throw ('Не удалось скопировать Electron (robocopy, код ' + $LASTEXITCODE + ')')
    }
  }

  if (-not (Test-Path $targetExe)) {
    throw 'Не удалось подготовить Electron в ASCII-папке'
  }
  return $targetExe
}

try {
  if (-not (Test-Path $mainBundle) -or -not (Test-Path $clientIndex)) {
    Invoke-Build
  }

  $sourceDist = Find-ElectronDist
  if (-not $sourceDist) {
    throw 'Electron не установлен. Выполните: npm install --ignore-scripts, затем node node_modules/electron/install.js'
  }

  $electron = Get-AsciiElectron $sourceDist

  # Свежая копия иконки в ASCII-путь: её читает окно Electron и ярлык
  $iconSource = Join-Path $root 'desktop-host\build\icon.ico'
  if (Test-Path -LiteralPath $iconSource) {
    try {
      Copy-Item -LiteralPath $iconSource -Destination (Join-Path (Get-AsciiRoot) 'vtt.ico') -Force
    } catch {
      Write-Log ('Не удалось обновить иконку: ' + $_.Exception.Message)
    }
  }

  $port = 3001
  if ($env:VTT_PORT) {
    $parsedPort = 0
    if ([int]::TryParse($env:VTT_PORT, [ref]$parsedPort)) { $port = $parsedPort }
  }

  $arguments = '"{0}"' -f $hostDir

  # Приложение уже открыто — второй экземпляр только сфокусирует его окно.
  # Ошибки кэша в этом случае ожидаемы и не должны показывать диалог.
  $vttWindow = Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*VTT*' }
  $portBusy = $false
  try {
    $portBusy = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop).Count -gt 0
  } catch {
    $portBusy = $false
  }

  if ($vttWindow -or $portBusy) {
    Write-Log 'VTT уже запущен — открываю существующее окно'
    Start-Process -FilePath $electron -ArgumentList $arguments -WorkingDirectory $hostDir
    exit 0
  }

  Write-Log 'Запуск VTT'
  $stdoutLog = Join-Path $logDir 'electron.log'
  $stderrLog = Join-Path $logDir 'electron-error.log'
  $process = Start-Process `
    -FilePath $electron `
    -ArgumentList $arguments `
    -WorkingDirectory $hostDir `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
  Write-Log ('Electron PID {0}' -f $process.Id)

  # Если приложение упало сразу (нет прав, антивирус, битая сборка) — покажем причину
  Start-Sleep -Seconds 3
  if ($process.HasExited) {
    $details = ''
    if (Test-Path -LiteralPath $stderrLog) {
      $details = (Get-Content -LiteralPath $stderrLog -Tail 6 | Out-String).Trim()
    }
    if ($details) {
      throw ('Electron завершился сразу после запуска. ' + $details)
    }
  }
} catch {
  Show-Error $_.Exception.Message
  exit 1
}

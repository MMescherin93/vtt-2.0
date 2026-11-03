# Создаёт ярлык «VTT» на рабочем столе и в папке проекта.
# Запуск: npm run shortcut  (или powershell -ExecutionPolicy Bypass -File scripts\make-shortcut.ps1)
#
# Ярлык создаётся через COM-интерфейс IShellLinkW (Unicode), потому что
# WScript.Shell портит кириллицу в путях вида «Проект по умолчанию».

param([switch]$SkipDesktop)

$ErrorActionPreference = 'Stop'

$csharp = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
internal class ShellLinkComObject { }

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
internal interface IShellLinkW
{
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
    void GetIDList(out IntPtr ppidl);
    void SetIDList(IntPtr pidl);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
    void GetHotkey(out short pwHotkey);
    void SetHotkey(short wHotkey);
    void GetShowCmd(out int piShowCmd);
    void SetShowCmd(int iShowCmd);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
    void Resolve(IntPtr hwnd, uint fFlags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
internal interface IPersistFile
{
    void GetClassID(out Guid pClassID);
    [PreserveSig] int IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
    void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
}

public static class VttShortcut
{
    public static void Create(string linkPath, string target, string arguments, string workingDirectory, string iconPath, int iconIndex, string description)
    {
        var link = (IShellLinkW)new ShellLinkComObject();
        link.SetPath(target);
        link.SetArguments(arguments);
        link.SetWorkingDirectory(workingDirectory);
        link.SetDescription(description);
        if (!string.IsNullOrEmpty(iconPath)) link.SetIconLocation(iconPath, iconIndex);
        ((IPersistFile)link).Save(linkPath, true);
    }

    public static string ReadArguments(string linkPath)
    {
        var link = (IShellLinkW)new ShellLinkComObject();
        ((IPersistFile)link).Load(linkPath, 0);
        var args = new StringBuilder(4096);
        link.GetArguments(args, args.Capacity);
        return args.ToString();
    }
}
'@

Add-Type -TypeDefinition $csharp -Language CSharp

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root 'scripts\launch-vtt.ps1'
$icon = Join-Path $root 'desktop-host\build\icon.ico'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $powershell)) { $powershell = 'powershell.exe' }

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Не найден лаунчер: $launcher"
}

$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $launcher

function New-Shortcut([string]$path) {
  $directory = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  [VttShortcut]::Create(
    $path,
    $powershell,
    $arguments,
    $root,
    $icon,
    0,
    'VTT — виртуальный стол для НРИ (хост Мастера)'
  )
  $saved = [VttShortcut]::ReadArguments($path)
  if ($saved -ne $arguments) {
    Write-Warning ('Ярлык создан, но аргументы прочитались иначе: ' + $saved)
  }
  Write-Host ('Ярлык создан: ' + $path)
}

New-Shortcut (Join-Path $root 'VTT.lnk')

if (-not $SkipDesktop) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  if ($desktop -and (Test-Path -LiteralPath $desktop)) {
    try {
      New-Shortcut (Join-Path $desktop 'VTT.lnk')
    } catch {
      Write-Warning ('Не удалось создать ярлык на рабочем столе: ' + $_.Exception.Message)
    }
  } else {
    Write-Warning 'Не удалось определить папку рабочего стола'
  }
}

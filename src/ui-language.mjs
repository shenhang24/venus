import {spawnSync} from 'node:child_process';

export function selectUILanguage(systemLanguage, browserLanguages = []) {
  const requested = systemLanguage || browserLanguages.find(Boolean) || 'en';
  return /^zh(?:-|$)/i.test(requested) ? 'zh' : 'en';
}

export function readWindowsDisplayLanguage() {
  if (process.platform !== 'win32') return null;
  const command = "$override=Get-WinUILanguageOverride; if($override){$override.Name}else{Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class VenusUILanguage { [DllImport(\"kernel32.dll\")] public static extern ushort GetUserDefaultUILanguage(); }'; [Globalization.CultureInfo]::GetCultureInfo([int][VenusUILanguage]::GetUserDefaultUILanguage()).Name}";
  const result = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',command], {encoding:'utf8',windowsHide:true,timeout:8000});
  const language = result.status === 0 ? result.stdout.trim().split(/\r?\n/).at(-1) : '';
  return /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(language) ? language : null;
}

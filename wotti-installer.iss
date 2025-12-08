; Wotti Installer Script
; Inno Setup Script for Wotti Application
; This script creates a professional installer for Wotti

#define MyAppName "Wotti"
#define MyAppVersion "1.0.6"
#define MyAppPublisher "Wotti"
#define MyAppURL "https://github.com/depaxton/Wotti"
#define MyAppExeName "launch-wotti-visible.vbs"
#define MyAppId "{{12345678-1234-1234-1234-123456789012}}"

[Setup]
; NOTE: The value of AppId uniquely identifies this application. Do not use the same AppId value in installers for other applications.
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
OutputDir=installer
OutputBaseFilename=Wotti-Setup-{#MyAppVersion}
SetupIconFile=assets\images\wotti-ico.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\assets\images\wotti-ico.ico
UninstallDisplayName={#MyAppName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} - WhatsApp Integration Application

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"

[Tasks]
; No tasks - desktop icon is created automatically

[Files]
; Main application files
Source: "app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "script.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "version.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "START.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "UPDATE-PROCESS.md"; DestDir: "{app}"; Flags: ignoreversion

; Launcher files
Source: "launch-wotti.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "launch-wotti-visible.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "launch-wotti.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "launch-wotti.bat"; DestDir: "{app}"; Flags: ignoreversion

; Directories
Source: "assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "components\*"; DestDir: "{app}\components"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "controllers\*"; DestDir: "{app}\controllers"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "routes\*"; DestDir: "{app}\routes"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "services\*"; DestDir: "{app}\services"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "styles\*"; DestDir: "{app}\styles"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "utils\*"; DestDir: "{app}\utils"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs

; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; IconFilename: "{app}\assets\images\wotti-ico.ico"; Comment: "Wotti - WhatsApp Integration"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; IconFilename: "{app}\assets\images\wotti-ico.ico"; Comment: "Wotti - WhatsApp Integration"

[Run]
; Check for Node.js
Filename: "{cmd}"; Parameters: "/c node --version >nul 2>&1"; StatusMsg: "Checking for Node.js..."; Flags: runhidden
Filename: "{cmd}"; Parameters: "/c if errorlevel 1 (echo Node.js not found! Please install Node.js from nodejs.org && pause && exit /b 1)"; StatusMsg: "Verifying Node.js installation..."; Flags: runhidden
; Run npm install
Filename: "{cmd}"; Parameters: "/c cd /d ""{app}"" && npm install"; StatusMsg: "Installing dependencies (npm install)... This may take a few minutes."; Flags: runhidden waituntilterminated
; Launch application after installation (using visible launcher to show any errors)
Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent; StatusMsg: "Launching {#MyAppName}..."

[Code]
var
  NodeInstalled: Boolean;

function InitializeSetup(): Boolean;
var
  NodeVersion: String;
  ErrorCode: Integer;
  ResultCode: Integer;
begin
  Result := True;
  NodeInstalled := False;
  
  // Check if Node.js is installed
  if Exec('node', '--version', '', SW_HIDE, ewWaitUntilTerminated, ErrorCode) then
  begin
    NodeInstalled := True;
  end
  else
  begin
    // Node.js not found
    if MsgBox('Node.js לא נמצא במחשב שלך.' + #13#10 + #13#10 +
              'Wotti דורש Node.js כדי לפעול.' + #13#10 +
              'האם אתה רוצה לפתוח את אתר Node.js להורדה עכשיו?' + #13#10 + #13#10 +
              'אם תבחר "לא", ההתקנה תמשיך, אבל תצטרך להתקין Node.js ידנית לפני השימוש.', 
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://nodejs.org/', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    end;
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // After installation, check if Node.js is available for npm install
    if not NodeInstalled then
    begin
      if Exec('node', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      begin
        NodeInstalled := True;
      end
      else
      begin
        MsgBox('Node.js עדיין לא מותקן.' + #13#10 +
               'אנא התקן Node.js מ-nodejs.org ולאחר מכן הרץ "npm install" בתיקיית ההתקנה.', 
               mbError, MB_OK);
      end;
    end;
  end;
end;


' Wotti Launcher VBScript - Visible Window Version
' Shows console window so errors are visible

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to the PowerShell script
psScript = scriptDir & "\launch-wotti.ps1"

' Check if PowerShell script exists
If Not fso.FileExists(psScript) Then
    MsgBox "Error: launch-wotti.ps1 not found in " & scriptDir, vbCritical, "Wotti Launcher Error"
    WScript.Quit
End If

' Run PowerShell script (NORMAL window - errors will be visible)
' 1 = normal window, True = wait for completion so user can see errors
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Normal -File """ & psScript & """", 1, True


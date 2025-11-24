' Wotti Launcher VBScript
' Runs the launcher without showing a console window

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

' Run PowerShell script (hidden window)
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """", 0, False


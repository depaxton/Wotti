Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' מצא את התיקייה שבה נמצא הקובץ VBS הזה (תיקיית הפרויקט)
Dim scriptPath
scriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' בנה את הנתיב המלא לקובץ restartApp.js
Dim restartAppPath
restartAppPath = objFSO.BuildPath(scriptPath, "services\restartApp.js")

' שנה לתיקיית הפרויקט (חשוב שה-working directory יהיה נכון)
objShell.CurrentDirectory = scriptPath

' הרץ את restartApp.js עם node בצורה בלתי נראית לחלוטין
' windowStyle = 0 = hidden window (בלתי נראה לחלוטין)
' bWaitOnReturn = False = אל תחכה לסיום (רץ ברקע)
' שימוש ישיר ב-node ללא cmd כדי למנוע חלון CMD
Dim command
command = "node " & Chr(34) & restartAppPath & Chr(34)
objShell.Run command, 0, False

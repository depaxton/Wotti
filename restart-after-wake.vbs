On Error Resume Next

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' מצא את התיקייה שבה נמצא הקובץ VBS הזה (תיקיית הפרויקט)
Dim scriptPath
scriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' בנה את הנתיב המלא לקובץ index.js (הקובץ הראשי)
Dim indexPath
indexPath = scriptPath & "\index.js"

' וודא שהקובץ קיים
If Not objFSO.FileExists(indexPath) Then
    WScript.Quit 1
End If

' ===== שלב 1: סגור את כל תהליכי Node.js הקיימים =====
objShell.Run "taskkill /F /IM node.exe", 0, True

' ===== שלב 2: סגור את כל תהליכי Chromium (של WhatsApp Web) =====
objShell.Run "taskkill /F /IM chromium.exe", 0, True

' ===== שלב 3: המתן שכל התהליכים ייסגרו =====
WScript.Sleep 3000

' ===== שלב 4: שנה לתיקיית הפרויקט והפעל מחדש =====
objShell.CurrentDirectory = scriptPath

' הרץ את node דרך cmd עם windowStyle=0 (מוסתר לחלוטין)
' הפרמטר השני (0) מסתיר את החלון לגמרי
' הפרמטר השלישי (False) אומר לא לחכות לסיום
objShell.Run "cmd /c node """ & indexPath & """", 0, False

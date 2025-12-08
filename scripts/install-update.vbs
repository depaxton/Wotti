' ============================================
' Wotti Update Installer VBScript
' ============================================
' סקריפט זה מבצע את ההתקנה בפועל של העדכון
' הוא רץ אחרי שהאפליקציה נסגרת כדי למנוע בעיות EBUSY
' ============================================

On Error Resume Next

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' מצא את התיקייה שבה נמצא הקובץ VBS הזה
Dim scriptPath, projectRoot
scriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
' תיקיית הפרויקט היא תיקייה אחת למעלה (scripts -> project root)
projectRoot = objFSO.GetParentFolderName(scriptPath)

' נתיבים חשובים
Dim pendingDir, updateInfoFile, logFile, indexPath
pendingDir = projectRoot & "\updates\pending"
updateInfoFile = pendingDir & "\update-info.json"
logFile = projectRoot & "\logs\update-installer.log"
indexPath = projectRoot & "\index.js"

' פונקציה לכתיבה ללוג
Sub WriteLog(message)
    On Error Resume Next
    Dim logFolder, logStream
    logFolder = objFSO.GetParentFolderName(logFile)
    
    ' ודא שתיקיית הלוגים קיימת
    If Not objFSO.FolderExists(logFolder) Then
        objFSO.CreateFolder(logFolder)
    End If
    
    ' כתוב ללוג
    Set logStream = objFSO.OpenTextFile(logFile, 8, True) ' 8 = ForAppending
    logStream.WriteLine Now & " - " & message
    logStream.Close
End Sub

' ===== שלב 0: בדוק אם יש עדכון ממתין =====
WriteLog "========== Starting Update Installation =========="
WriteLog "Project root: " & projectRoot
WriteLog "Pending dir: " & pendingDir

If Not objFSO.FolderExists(pendingDir) Then
    WriteLog "ERROR: Pending folder does not exist. Exiting."
    WScript.Quit 1
End If

If Not objFSO.FileExists(updateInfoFile) Then
    WriteLog "ERROR: update-info.json not found. Exiting."
    WScript.Quit 1
End If

WriteLog "Update files found. Proceeding with installation..."

' ===== שלב 1: סגור את כל תהליכי Node.js הקיימים =====
WriteLog "Step 1: Killing existing Node.js processes..."
objShell.Run "taskkill /F /IM node.exe", 0, True
WScript.Sleep 1000

' ===== שלב 2: סגור את כל תהליכי Chromium (של WhatsApp Web) =====
WriteLog "Step 2: Killing Chromium processes..."
objShell.Run "taskkill /F /IM chromium.exe", 0, True
WScript.Sleep 2000

' ===== שלב 3: המתן נוסף לוודא שכל הקבצים שוחררו =====
WriteLog "Step 3: Waiting for file handles to be released..."
WScript.Sleep 3000

' ===== שלב 4: העתק את הקבצים מתיקיית pending לתיקייה הראשית =====
WriteLog "Step 4: Copying update files..."

' רשימת הפריטים להעתקה
Dim itemsToInstall
itemsToInstall = Array("app.js", "index.js", "package.json", "package-lock.json", _
                       "script.js", "index.html", "components", "config", _
                       "controllers", "routes", "services", "styles", "utils", "assets")

Dim item, sourcePath, destPath, copySuccess
copySuccess = True

For Each item In itemsToInstall
    sourcePath = pendingDir & "\" & item
    destPath = projectRoot & "\" & item
    
    If objFSO.FileExists(sourcePath) Then
        ' זה קובץ - העתק אותו
        WriteLog "Copying file: " & item
        
        ' מחק את הקובץ הישן אם קיים
        If objFSO.FileExists(destPath) Then
            objFSO.DeleteFile destPath, True
            If Err.Number <> 0 Then
                WriteLog "WARNING: Could not delete old file: " & item & " - " & Err.Description
                Err.Clear
            End If
        End If
        
        ' העתק את הקובץ החדש
        objFSO.CopyFile sourcePath, destPath, True
        If Err.Number <> 0 Then
            WriteLog "ERROR: Could not copy file: " & item & " - " & Err.Description
            copySuccess = False
            Err.Clear
        Else
            WriteLog "SUCCESS: Copied " & item
        End If
        
    ElseIf objFSO.FolderExists(sourcePath) Then
        ' זו תיקייה - העתק אותה
        WriteLog "Copying folder: " & item
        
        ' מחק את התיקייה הישנה אם קיימת
        If objFSO.FolderExists(destPath) Then
            objFSO.DeleteFolder destPath, True
            If Err.Number <> 0 Then
                WriteLog "WARNING: Could not delete old folder: " & item & " - " & Err.Description
                Err.Clear
                ' נסה להמתין ולנסות שוב
                WScript.Sleep 2000
                objFSO.DeleteFolder destPath, True
                Err.Clear
            End If
        End If
        
        ' העתק את התיקייה החדשה
        objFSO.CopyFolder sourcePath, destPath, True
        If Err.Number <> 0 Then
            WriteLog "ERROR: Could not copy folder: " & item & " - " & Err.Description
            copySuccess = False
            Err.Clear
        Else
            WriteLog "SUCCESS: Copied " & item
        End If
    Else
        WriteLog "SKIP: Item not found in pending: " & item
    End If
Next

' ===== שלב 5: הרץ npm install =====
WriteLog "Step 5: Running npm install..."
objShell.CurrentDirectory = projectRoot
objShell.Run "cmd /c npm install > """ & projectRoot & "\logs\npm-install.log"" 2>&1", 0, True
If Err.Number <> 0 Then
    WriteLog "WARNING: npm install may have failed - " & Err.Description
    Err.Clear
Else
    WriteLog "npm install completed"
End If

' ===== שלב 6: נקה את תיקיית pending =====
WriteLog "Step 6: Cleaning up pending folder..."
If objFSO.FolderExists(pendingDir) Then
    objFSO.DeleteFolder pendingDir, True
    If Err.Number <> 0 Then
        WriteLog "WARNING: Could not delete pending folder - " & Err.Description
        Err.Clear
    Else
        WriteLog "Pending folder cleaned up"
    End If
End If

' ===== שלב 7: הפעל מחדש את האפליקציה =====
WriteLog "Step 7: Restarting application..."

If copySuccess Then
    WriteLog "Update installation completed successfully!"
Else
    WriteLog "Update installation completed with some errors. Check log for details."
End If

' המתן רגע לפני הפעלה מחדש
WScript.Sleep 2000

' הפעל את האפליקציה מחדש
objShell.CurrentDirectory = projectRoot
objShell.Run "cmd /c node """ & indexPath & """", 0, False

WriteLog "Application restart initiated. Update process complete."
WriteLog "=========================================="

WScript.Quit 0


import { spawn, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function restartApp() {
  const parentDir = path.join(__dirname, "..");
  const currentPid = process.pid;

  // שלב 1: סגור את כל התהליכים הישנים קודם
  // סגור תהליכי Chrome/Chromium
  exec(`taskkill /F /IM chromium.exe`, () => {});
  exec("wmic process where \"commandline like '%chromium%'\" get ProcessId /format:value", (error, stdout) => {
    if (stdout) {
      const lines = stdout.split("\n");
      lines.forEach((line) => {
        const match = line.match(/ProcessId=(\d+)/);
        if (match) {
          exec(`taskkill /F /T /PID ${match[1]}`);
        }
      });
    }
  });

  // המתן קצת ואז סגור תהליכי Node.js הישנים (חוץ מהתהליך הנוכחי)
  setTimeout(() => {
    exec("wmic process where \"name='node.exe' and ProcessId!=" + currentPid + '" get ProcessId /format:value', (error, stdout) => {
      if (stdout) {
        const lines = stdout.split("\n");
        lines.forEach((line) => {
          const match = line.match(/ProcessId=(\d+)/);
          if (match) {
            const pid = match[1];
            // אל תהרוג את restartApp.js עצמו
            exec(`taskkill /F /T /PID ${pid}`, () => {});
          }
        });
      }

      // המתן מספיק זמן שכל התהליכים ייסגרו לגמרי
      setTimeout(() => {
        // שלב 3: עכשיו התחל את התהליך החדש
        startNewProcess(parentDir);
      }, 5000); // המתן 5 שניות שהכל ייסגר
    });
  }, 2000);
}

function startNewProcess(parentDir) {
  const isWindows = process.platform === "win32";
  const indexPath = path.join(parentDir, "index.js");

  if (isWindows) {
    // בWindows - השתמש ב-wscript עם VBS כדי להריץ node באופן בלתי נראה לחלוטין
    const vbsScript = `
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "${parentDir.replace(/\\/g, "\\\\")}"
objShell.Run "node ""${indexPath.replace(/\\/g, "\\\\")}"" ", 0, False
    `.trim();

    const vbsPath = path.join(parentDir, "temp-restart.vbs");

    // כתוב את קובץ ה-VBS הזמני
    import("fs").then((fs) => {
      fs.writeFileSync(vbsPath, vbsScript);

      // הרץ את ה-VBS עם wscript (בלתי נראה לחלוטין)
      const vbsProcess = spawn("wscript", [vbsPath], {
        stdio: "ignore",
        detached: true,
        windowsHide: true,
      });

      vbsProcess.on("spawn", () => {
        vbsProcess.unref();
        // מחק את קובץ ה-VBS הזמני אחרי 5 שניות
        setTimeout(() => {
          try {
            fs.unlinkSync(vbsPath);
          } catch (e) {}
          process.exit(0);
        }, 3000);
      });

      vbsProcess.on("error", () => {
        // Fallback אם VBS נכשל
        startWithPowershell(parentDir, indexPath);
      });
    });
  } else {
    // Linux/Mac - הרץ ישירות עם node
    const newProcess = spawn("node", [indexPath], {
      stdio: "ignore",
      detached: true,
      cwd: parentDir,
    });

    newProcess.on("spawn", () => {
      newProcess.unref();
      setTimeout(() => process.exit(0), 1000);
    });
  }
}

function startWithPowershell(parentDir, indexPath) {
  // Fallback - השתמש ב-PowerShell עם -WindowStyle Hidden
  const psCommand = `Start-Process -FilePath 'node' -ArgumentList '"${indexPath}"' -WorkingDirectory '${parentDir}' -WindowStyle Hidden`;

  const psProcess = spawn("powershell", ["-WindowStyle", "Hidden", "-Command", psCommand], {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });

  psProcess.on("spawn", () => {
    psProcess.unref();
    setTimeout(() => process.exit(0), 1000);
  });

  psProcess.on("error", () => {
    process.exit(1);
  });
}

restartApp();

export { restartApp };

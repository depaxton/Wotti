// Process cleanup utility
// Ensures all processes and ports are properly cleaned up on shutdown

import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { logInfo, logWarn, logError } from "./logger.js";
import { PORT } from "../config/serverConfig.js";

const execAsync = promisify(exec);

/**
 * Kills all Puppeteer/Chrome processes related to this application
 * @returns {Promise<void>}
 */
export async function killPuppeteerProcesses() {
  const platform = os.platform();
  
  try {
    if (platform === "win32") {
      // Windows: Kill Chrome/Chromium processes
      // Find processes with "chrome" or "chromium" in the name that are related to Puppeteer
      const commands = [
        // Kill Chrome processes (Puppeteer uses Chrome)
        `taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq *WhatsApp*" 2>nul`,
        `taskkill /F /IM chrome.exe /FI "COMMANDLINE eq *--remote-debugging-port*" 2>nul`,
        // Kill any Chrome processes with Puppeteer arguments
        `wmic process where "name='chrome.exe' and commandline like '%--remote-debugging-port%'" delete 2>nul`,
      ];
      
      for (const cmd of commands) {
        try {
          await execAsync(cmd);
        } catch (error) {
          // Ignore errors - process might not exist
        }
      }
      
      logInfo("Puppeteer/Chrome processes cleanup attempted");
    } else {
      // Linux/Mac: Kill Chrome/Chromium processes
      const commands = [
        `pkill -f "chrome.*--remote-debugging-port" 2>/dev/null`,
        `pkill -f "chromium.*--remote-debugging-port" 2>/dev/null`,
      ];
      
      for (const cmd of commands) {
        try {
          await execAsync(cmd);
        } catch (error) {
          // Ignore errors - process might not exist
        }
      }
      
      logInfo("Puppeteer/Chrome processes cleanup attempted");
    }
  } catch (error) {
    logWarn(`Error killing Puppeteer processes (may not exist): ${error.message}`);
  }
}

/**
 * Kills all Node.js processes related to this application
 * @returns {Promise<void>}
 */
export async function killNodeProcesses() {
  const platform = os.platform();
  const scriptName = "index.js";
  
  try {
    if (platform === "win32") {
      // Windows: Find and kill Node processes running index.js
      const command = `wmic process where "name='node.exe' and commandline like '%${scriptName}%'" get processid /format:value`;
      
      try {
        const { stdout } = await execAsync(command);
        const processIds = stdout
          .split("\n")
          .filter(line => line.includes("ProcessId="))
          .map(line => line.replace("ProcessId=", "").trim())
          .filter(id => id && id !== process.pid.toString()); // Don't kill current process yet
        
        for (const pid of processIds) {
          try {
            await execAsync(`taskkill /F /PID ${pid} 2>nul`);
            logInfo(`Killed Node process: ${pid}`);
          } catch (error) {
            // Process might already be dead
          }
        }
      } catch (error) {
        // No processes found or command failed
      }
    } else {
      // Linux/Mac: Kill Node processes running index.js
      const command = `pkill -f "node.*${scriptName}" 2>/dev/null`;
      try {
        await execAsync(command);
      } catch (error) {
        // No processes found
      }
    }
    
    logInfo("Node.js processes cleanup attempted");
  } catch (error) {
    logWarn(`Error killing Node processes: ${error.message}`);
  }
}

/**
 * Ensures port is released by killing any process using it
 * @param {number} port - Port number to check
 * @returns {Promise<void>}
 */
export async function releasePort(port) {
  const platform = os.platform();
  
  try {
    if (platform === "win32") {
      // Windows: Find process using the port and kill it
      const findPortCommand = `netstat -ano | findstr :${port}`;
      
      try {
        const { stdout } = await execAsync(findPortCommand);
        const lines = stdout.split("\n").filter(line => line.trim());
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          
          if (pid && pid !== "0" && pid !== process.pid.toString()) {
            try {
              await execAsync(`taskkill /F /PID ${pid} 2>nul`);
              logInfo(`Killed process ${pid} using port ${port}`);
            } catch (error) {
              // Process might already be dead
            }
          }
        }
      } catch (error) {
        // No process found using the port
      }
    } else {
      // Linux/Mac: Find and kill process using the port
      const findPortCommand = `lsof -ti :${port}`;
      
      try {
        const { stdout } = await execAsync(findPortCommand);
        const pids = stdout.trim().split("\n").filter(pid => pid && pid !== process.pid.toString());
        
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid} 2>/dev/null`);
            logInfo(`Killed process ${pid} using port ${port}`);
          } catch (error) {
            // Process might already be dead
          }
        }
      } catch (error) {
        // No process found using the port
      }
    }
    
    logInfo(`Port ${port} cleanup attempted`);
  } catch (error) {
    logWarn(`Error releasing port ${port}: ${error.message}`);
  }
}

/**
 * Comprehensive cleanup of all processes and ports
 * @returns {Promise<void>}
 */
export async function cleanupAllProcesses() {
  logInfo("Starting comprehensive process cleanup...");
  
  // Wait a bit for graceful shutdown to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Kill Puppeteer/Chrome processes
  await killPuppeteerProcesses();
  
  // Wait a bit more
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Release the port
  await releasePort(PORT);
  
  // Wait a bit more
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Kill any remaining Node processes (this should be last, as it might kill current process)
  await killNodeProcesses();
  
  logInfo("Process cleanup complete");
}


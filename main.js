const { init } = require('@sentry/electron/main');
init({ dsn: 'https://57cc2a4b0febf8db4ea33052e61e976e@o4511831642603520.ingest.us.sentry.io/4511831646470144' });

const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const msmc = require('msmc');
const { ProgressMonitor, versionRoadmap, availableVersions, loadRoadmap, saveRoadmap } = require('./progress-monitor.js');
const ServerManager = require('./server-manager.js');
const pidusage = require('pidusage');

let statsInterval = null;

const DiscordRPC = require('discord-rpc');
const clientId = '1532438058526441622';
DiscordRPC.register(clientId);

let rpc = new DiscordRPC.Client({ transport: 'ipc' });
let discordReady = false;

rpc.on('ready', () => {
  discordReady = true;
  setDiscordActivity('In Launcher', 'Idle');
});

rpc.login({ clientId }).catch((err) => { console.log('Discord RPC Failed:', err.message || err); });

let currentDiscordDetails = 'In Launcher';
function setDiscordActivity(details, state) {
  if (details) currentDiscordDetails = details;
  if (!discordReady) return;
  rpc.setActivity({
    details: currentDiscordDetails,
    state: state,
    startTimestamp: new Date(),
    largeImageKey: 'icon',
    largeImageText: 'Minecraft TTA',
    instance: false,
  }).catch(console.error);
}



let activeProfileId = 'default';
function getProfileDir() {
  return path.join(app.getPath("appData"), "mc-tta-launcher", "profiles", activeProfileId);
}

const launcherDataDir = path.join(app.getPath("appData"), "mc-tta-launcher");
const profilesJsonPath = path.join(launcherDataDir, "profiles.json");

function migrateToProfiles() {
  if (!fs.existsSync(launcherDataDir)) fs.mkdirSync(launcherDataDir, { recursive: true });
  const profilesDir = path.join(launcherDataDir, "profiles");
  const defaultProfileDir = path.join(profilesDir, "default");

  // Check if we need to migrate
  if (!fs.existsSync(defaultProfileDir)) {
    const dirsToMove = ['instances', 'servers', 'backups'];
    let needsMigration = false;
    for (const d of dirsToMove) {
      if (fs.existsSync(path.join(launcherDataDir, d))) needsMigration = true;
    }
    if (fs.existsSync(path.join(launcherDataDir, 'state.json'))) needsMigration = true;

    if (needsMigration) {
      fs.mkdirSync(defaultProfileDir, { recursive: true });
      for (const d of dirsToMove) {
        const src = path.join(launcherDataDir, d);
        if (fs.existsSync(src)) fs.renameSync(src, path.join(defaultProfileDir, d));
      }
      for (const f of ['state.json', 'whitelist.json']) {
        const src = path.join(launcherDataDir, f);
        if (fs.existsSync(src)) fs.renameSync(src, path.join(defaultProfileDir, f));
      }
    }
  }

  // Initialize profiles.json
  if (!fs.existsSync(profilesJsonPath)) {
    fs.writeFileSync(profilesJsonPath, JSON.stringify([{ id: "default", name: "My Playthrough" }]));
  }
}


function getSettings() {
  const settingsPath = path.join(launcherDataDir, "settings.json");
  if (fs.existsSync(settingsPath)) {
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) { }
  }
  return { ramMin: '2G', ramMax: '4G', betacraft: true, java8: '', java17: '', java21: '' };
}
ipcMain.handle('get-settings', () => getSettings());
ipcMain.on('save-settings', (e, settings) => {
  fs.writeFileSync(path.join(launcherDataDir, "settings.json"), JSON.stringify(settings, null, 2));
});

function getRequiredJavaVersion(versionId) {
  if (!versionId) return 8;
  if (versionId.startsWith('1.20.5') || versionId.startsWith('1.21')) return 21;
  if (versionId.startsWith('1.17') || versionId.startsWith('1.18') || versionId.startsWith('1.19') || versionId.startsWith('1.20')) return 17;
  return 8;
}


async function resolveJava(javaVer) {
  if (javaVer === 8) {
    let bundledJrePath = path.join(__dirname, 'jre8', 'jdk8u412-b08-jre', 'bin', 'java.exe');
    if (bundledJrePath.includes('app.asar')) {
      bundledJrePath = bundledJrePath.replace('app.asar', 'app.asar.unpacked');
    }
    if (fs.existsSync(bundledJrePath)) return bundledJrePath;
  }
  const settings = getSettings();
  if (javaVer === 8 && settings.java8 && fs.existsSync(settings.java8)) return settings.java8;
  if (javaVer === 17 && settings.java17 && fs.existsSync(settings.java17)) return settings.java17;
  if (javaVer === 21 && settings.java21 && fs.existsSync(settings.java21)) return settings.java21;

  const commonPaths = [
    "C:\\Program Files\\Java",
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files\\AdoptOpenJDK"
  ];
  for (const cp of commonPaths) {
    if (fs.existsSync(cp)) {
      const dirs = fs.readdirSync(cp);
      for (const d of dirs) {
        if ((javaVer === 8 && (d.includes('jre1.8') || d.includes('jdk-8'))) ||
          (javaVer === 17 && d.includes('17')) ||
          (javaVer === 21 && d.includes('21'))) {
          const exe = path.join(cp, d, 'bin', 'java.exe');
          if (fs.existsSync(exe)) return exe;
        }
      }
    }
  }

  const localJavaDir = path.join(app.getPath("appData"), "mc-tta-launcher", "jre" + javaVer);
  if (fs.existsSync(localJavaDir)) {
    const dirs = fs.readdirSync(localJavaDir);
    for (const d of dirs) {
      const exe = path.join(localJavaDir, d, 'bin', 'java.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }

  if (mainWindow) mainWindow.webContents.send('launch-data', "Downloading Java " + javaVer + " (this may take a few minutes)...");

  let dlUrl = "";
  if (javaVer === 8) dlUrl = "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u412-b08/OpenJDK8U-jre_x64_windows_hotspot_8u412b08.zip";
  if (javaVer === 17) dlUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jre_x64_windows_hotspot_17.0.11_9.zip";
  if (javaVer === 21) dlUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_x64_windows_hotspot_21.0.3_9.zip";

  try {
    const zipFile = path.join(app.getPath("appData"), "mc-tta-launcher", "jre" + javaVer + ".zip");
    require('child_process').execSync('powershell -Command "Invoke-WebRequest -Uri ' + "'" + dlUrl + "'" + ' -OutFile ' + "'" + zipFile + "'" + '; Expand-Archive -Path ' + "'" + zipFile + "'" + ' -DestinationPath ' + "'" + localJavaDir + "'" + ' -Force"');
    if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

    const dirs = fs.readdirSync(localJavaDir);
    for (const d of dirs) {
      const exe = path.join(localJavaDir, d, 'bin', 'java.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch (e) {
    if (mainWindow) mainWindow.webContents.send('launch-error', "Failed to download Java " + javaVer + ": " + e.message);
  }

  return 'java';
}


function getProfiles() {
  try {
    return JSON.parse(fs.readFileSync(profilesJsonPath, 'utf8'));
  } catch (e) {
    return [];
  }
}

ipcMain.handle('get-profiles', () => getProfiles());
ipcMain.handle('create-profile', (e, name) => {
  const profiles = getProfiles();
  const id = Date.now().toString();
  profiles.push({ id, name });
  fs.writeFileSync(profilesJsonPath, JSON.stringify(profiles));
  return profiles;
});
ipcMain.on('select-profile', (e, id) => {
  activeProfileId = id;
  loadRoadmap(getProfileDir());
});

ipcMain.handle('get-roadmap', () => {
  return versionRoadmap;
});

ipcMain.handle('get-default-roadmap', () => {
  return availableVersions;
});

ipcMain.handle('save-roadmap', (e, newRoadmap) => {
  saveRoadmap(getProfileDir(), newRoadmap);
  return true;
});

let mainWindow;
const launcher = new Client();
let progressMonitor = null;
let serverManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Send initial version roadmap data and saved state
  mainWindow.webContents.on('did-finish-load', () => {
    let savedVersion = 'b1.5';
    const statePath = path.join(getProfileDir(), "state.json");
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.currentVersion) savedVersion = state.currentVersion;
      } catch (e) { }
    }

    mainWindow.webContents.send('init-data', { versionRoadmap, savedVersion });
  });
}

app.whenReady().then(() => {
  migrateToProfiles();
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('auto-login', async (event) => {
  const authPath = path.join(app.getPath("appData"), "mc-tta-launcher", "auth.json");
  if (fs.existsSync(authPath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      return { success: true, profile: profile };
    } catch (e) { }
  }
  return { success: false };
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// IPC Handlers

ipcMain.on('request-playtime', (e) => {
  const statePath = path.join(getProfileDir(), "state.json");
  let totalPlaytime = 0;
  if (fs.existsSync(statePath)) {
    try { 
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8')); 
      if (state.totalPlaytime) totalPlaytime = state.totalPlaytime;
    } catch(err) {}
  }
  if (mainWindow) mainWindow.webContents.send('playtime-update', totalPlaytime);
});

ipcMain.handle('import-resourcepack', (e, { version, filePath }) => {
  try {
    const rpDir = path.join(getProfileDir(), "instances", version, "resourcepacks");
    if (!fs.existsSync(rpDir)) fs.mkdirSync(rpDir, { recursive: true });
    
    const fileName = path.basename(filePath);
    const destPath = path.join(rpDir, fileName);
    fs.copyFileSync(filePath, destPath);
    
    // Auto-enable logic
    const optionsPath = path.join(getProfileDir(), "instances", version, "options.txt");
    if (fs.existsSync(optionsPath)) {
      let optsText = fs.readFileSync(optionsPath, 'utf8');
      if (optsText.includes('resourcePacks:[')) {
         optsText = optsText.replace(/resourcePacks:\[(.*?)\]/, (match, p1) => {
            let packs = p1 ? p1.split(',').map(s => s.trim()) : [];
            const packStr = `"${fileName}"`;
            if (!packs.includes(packStr)) packs.push(packStr);
            return `resourcePacks:[${packs.join(',')}]`;
         });
      } else {
         optsText += `\nresourcePacks:["${fileName}"]\n`;
      }
      fs.writeFileSync(optionsPath, optsText);
    }

    return { success: true };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-resourcepacks', (e, version) => {
  const rpDir = path.join(getProfileDir(), "instances", version, "resourcepacks");
  if (!fs.existsSync(rpDir)) return [];
  try {
    const files = fs.readdirSync(rpDir);
    return files.filter(f => f.endsWith('.zip')).map(f => ({ name: f }));
  } catch (err) {
    return [];
  }
});

ipcMain.handle('login', async (event) => {
  try {
    const authPath = path.join(app.getPath("appData"), "mc-tta-launcher", "auth.json");
    if (fs.existsSync(authPath)) {
      try {
        const profile = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        // Optionally, you could use MSMC's refresh features here, 
        // but for offline servers a cached profile works fine indefinitely.
        return { success: true, profile: profile };
      } catch (e) { }
    }

    const authManager = new msmc.Auth("select_account");
    const xboxManager = await authManager.launch("electron");
    const token = await xboxManager.getMinecraft();
    const profile = token.mclc();

    const authDir = path.dirname(authPath);
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(authPath, JSON.stringify(profile));

    return { success: true, profile: profile };
  } catch (error) {
    console.error("Login failed:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('save-state', (event, state) => {
  const stateDir = getProfileDir();
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(state));
});

ipcMain.on('reset-state', (event) => {
  const statePath = path.join(getProfileDir(), "state.json");
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }

  // Ensure the progress monitor also resets its internal state back to b1.5 (index 0)
  if (progressMonitor) {
    progressMonitor.currentVersionIndex = 0;
  }

  // Delete all stats files across all instances so progress genuinely resets
  const instancesDir = path.join(getProfileDir(), "instances");
  if (fs.existsSync(instancesDir)) {
    const instances = fs.readdirSync(instancesDir);
    for (const instance of instances) {
      const instancePath = path.join(instancesDir, instance);
      if (fs.statSync(instancePath).isDirectory()) {
        // Delete stats_*.dat in root
        const files = fs.readdirSync(instancePath);
        for (const file of files) {
          if (file.includes('stats_') && file.endsWith('.dat')) {
            try { fs.unlinkSync(path.join(instancePath, file)); } catch (e) { console.error(e); }
          }
        }

        // Empty stats/ and advancements/ directories if they exist
        const statsDir = path.join(instancePath, 'stats');
        try { if (fs.existsSync(statsDir)) fs.rmSync(statsDir, { recursive: true, force: true }); } catch (e) { console.error(e); }

        const advDir = path.join(instancePath, 'advancements');
        try { if (fs.existsSync(advDir)) fs.rmSync(advDir, { recursive: true, force: true }); } catch (e) { console.error(e); }

        // Delete world saves
        const savesDir = path.join(instancePath, 'saves');
        try { if (fs.existsSync(savesDir)) fs.rmSync(savesDir, { recursive: true, force: true }); } catch (e) { console.error(e); }
      }
    }
  }

  // Delete server worlds
  const serversDir = path.join(getProfileDir(), "servers");
  if (fs.existsSync(serversDir)) {
    const servers = fs.readdirSync(serversDir);
    for (const server of servers) {
      const serverPath = path.join(serversDir, server);
      if (fs.statSync(serverPath).isDirectory()) {
        const worldDir = path.join(serverPath, 'world');
        try { if (fs.existsSync(worldDir)) fs.rmSync(worldDir, { recursive: true, force: true }); } catch (e) { console.error(e); }
      }
    }
  }
});

ipcMain.on('skip-version', (event) => {
  if (progressMonitor) {
    if (progressMonitor.currentVersionIndex < versionRoadmap.length - 1) {
      const currentVersion = progressMonitor.getCurrentVersion();
      progressMonitor.currentVersionIndex++;
      const nextVersion = progressMonitor.getCurrentVersion();
      if (progressMonitor.onGoalReached) {
        progressMonitor.onGoalReached(currentVersion, nextVersion);
      }
    }
  } else {
    const statePath = path.join(getProfileDir(), "state.json");
    let savedVersion = 'b1.5';
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.currentVersion) savedVersion = state.currentVersion;
      } catch (e) { }
    }
    const currentIndex = versionRoadmap.findIndex(v => v.id === savedVersion);
    if (currentIndex !== -1 && currentIndex < versionRoadmap.length - 1) {
      const currentVersion = versionRoadmap[currentIndex];
      const nextVersion = versionRoadmap[currentIndex + 1];
      if (mainWindow) mainWindow.webContents.send('goal-reached', { currentVersion: currentVersion, nextVersion: nextVersion });
    }
  }
});



ipcMain.on('host-server', async (event, { version }) => {
  if (!serverManager) serverManager = new ServerManager();
  const versionInfo = versionRoadmap.find(v => v.id === version);

  // Migrate global server folder to profile if it exists and profile doesn't have it yet
  const globalServerDir = path.join(app.getPath("appData"), "mc-tta-launcher", "servers", version);
  const profileServerDir = path.join(getProfileDir(), "servers", version);
  if (fs.existsSync(globalServerDir) && !fs.existsSync(profileServerDir)) {
    if (!fs.existsSync(path.dirname(profileServerDir))) fs.mkdirSync(path.dirname(profileServerDir), { recursive: true });
    fs.cpSync(globalServerDir, profileServerDir, { recursive: true });
  }

  const idx = versionRoadmap.findIndex(v => v.id === version);
  if (idx > 0) {
    const prevVersion = versionRoadmap[idx - 1].id;
    const newRootDir = path.join(getProfileDir(), "servers", version);
    const prevRootDir = path.join(getProfileDir(), "servers", prevVersion);
    const newWorldDir = path.join(newRootDir, 'world');
    const prevWorldDir = path.join(prevRootDir, 'world');
    
    if (!fs.existsSync(newWorldDir) && fs.existsSync(prevWorldDir)) {
      if (!fs.existsSync(newRootDir)) fs.mkdirSync(newRootDir, { recursive: true });
      fs.cpSync(prevWorldDir, newWorldDir, { recursive: true });
    }
  }

  if (version === '1.12' || version.startsWith('1.12')) {
    const worldDir = path.join(getProfileDir(), "servers", version, "world");
    if (fs.existsSync(worldDir) && !fs.existsSync(path.join(worldDir, 'data', 'advancements', 'legacy', 'root.json'))) {
      migrateAdvancements(worldDir);
    }
  }

  if (version === '1.7.2' || version.startsWith('1.7')) {
    const worldDir = path.join(getProfileDir(), "servers", version, "world");
    const clientRootDir = path.join(getProfileDir(), "instances", version);
    migrateStatsTo17(worldDir, clientRootDir);
  }

  syncWhitelistToServer(version);

  try {
    setDiscordActivity('Hosting Server ' + versionInfo.id, 'Multiplayer');
    await serverManager.startServer(
      getProfileDir(),
      versionInfo,
      await resolveJava(getRequiredJavaVersion(version)),
      (log) => {
        if (mainWindow) mainWindow.webContents.send('server-log', log);
      }
    );

    // Start monitoring (we monitor the host's client stats to progress the server!)
    if (!progressMonitor) {
      setupProgressMonitor();
    }

    const idx = versionRoadmap.findIndex(v => v.id === version);
    if (idx !== -1) progressMonitor.currentVersionIndex = idx;

    // Note: we need the username of the host to monitor their stats. 
    // For simplicity, we just look for any stats file in the instance directory.
    progressMonitor.startWatching('host');
    
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(() => {
      if (serverManager && serverManager.serverProcess && serverManager.serverProcess.pid) {
        pidusage(serverManager.serverProcess.pid, (err, stats) => {
          if (!err && mainWindow) {
            stats.ip = serverManager.publicIp;
            mainWindow.webContents.send('server-stats', stats);
          }
        });
      }
    }, 2000);

  } catch (err) {
    if (mainWindow) mainWindow.webContents.send('server-log', `Error: ${err.message}`);
    if (mainWindow) mainWindow.webContents.send('server-stopped');
  }
});

ipcMain.on('stop-server', async (event) => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (serverManager) {
    await serverManager.stopServer();
  }
  if (progressMonitor) {
    progressMonitor.stopWatching();
  }
  if (mainWindow) mainWindow.webContents.send('server-stopped');
});

ipcMain.on('server-command', (event, cmd) => {
  if (serverManager && serverManager.serverProcess && serverManager.serverProcess.stdin) {
    serverManager.serverProcess.stdin.write(cmd + '\n');
  }
});

ipcMain.on('request-initial-progress', (event, username) => {
  if (!progressMonitor) {
    setupProgressMonitor();
  }
  
  // Ensure we are checking the correct version based on state.json
  const statePath = path.join(getProfileDir(), "state.json");
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.currentVersion) {
        const idx = versionRoadmap.findIndex(v => v.id === state.currentVersion);
        if (idx !== -1) progressMonitor.currentVersionIndex = idx;
      }
    } catch (e) {}
  }
  
  progressMonitor.username = username;
  progressMonitor.checkProgress();
});

function setupProgressMonitor() {
  progressMonitor = new ProgressMonitor(
    getProfileDir(),
    async (currentVersion, nextVersion) => {
      const statePath = path.join(getProfileDir(), "state.json");
      fs.writeFileSync(statePath, JSON.stringify({ currentVersion: nextVersion.id }));

      if (mainWindow) mainWindow.webContents.send('goal-reached', { oldVersion: currentVersion, newVersion: nextVersion });

      // If hosting, automatically restart server in new version
      if (serverManager && serverManager.serverProcess) {
        if (mainWindow) mainWindow.webContents.send('server-log', `Advancing server to ${nextVersion.id}...`);
        await serverManager.stopServer();

        // Wait a moment, copy world, then start
        const prevRootDir = path.join(getProfileDir(), "servers", currentVersion.id);
        const newRootDir = path.join(getProfileDir(), "servers", nextVersion.id);
        const prevWorldDir = path.join(prevRootDir, 'world');
        const newWorldDir = path.join(newRootDir, 'world');

        if (!fs.existsSync(newRootDir)) fs.mkdirSync(newRootDir, { recursive: true });

        if (fs.existsSync(prevWorldDir)) {
          if (mainWindow) mainWindow.webContents.send('server-log', `Migrating world data...`);

          const backupDir = path.join(getProfileDir(), "backups");
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(backupDir, `server_${currentVersion.id}_${timestamp}.zip`);

          if (mainWindow) mainWindow.webContents.send('server-log', `Backing up world to ${backupFile}...`);
          try {
            require('child_process').execSync(`powershell -Command "Compress-Archive -Path '${prevWorldDir}' -DestinationPath '${backupFile}'"`);
          } catch (err) {
            if (mainWindow) mainWindow.webContents.send('server-log', `Backup failed: ${err.message}`);
          }

          fs.cpSync(prevWorldDir, newWorldDir, { recursive: true });
        }

        const configFiles = ['server.properties', 'ops.json', 'ops.txt', 'whitelist.json', 'white-list.txt', 'banned-players.json', 'banned-ips.json'];
        for (const file of configFiles) {
          const oldPath = path.join(prevRootDir, file);
          if (fs.existsSync(oldPath)) {
            fs.copyFileSync(oldPath, path.join(newRootDir, file));
          }
        }

        if (nextVersion.id === '1.12' || nextVersion.id.startsWith('1.12')) {
          if (fs.existsSync(newWorldDir) && !fs.existsSync(path.join(newWorldDir, 'data', 'advancements', 'legacy', 'root.json'))) {
            migrateAdvancements(newWorldDir);
          }
        }

        if (nextVersion.id === '1.7.2' || nextVersion.id.startsWith('1.7')) {
          const clientRootDir = path.join(getProfileDir(), "instances", nextVersion.id);
          migrateStatsTo17(newWorldDir, clientRootDir);
        }

        // Start new server
        setDiscordActivity('Hosting Server ' + versionInfo.id, 'Multiplayer');
        await serverManager.startServer(nextVersion, await resolveJava(getRequiredJavaVersion(nextVersion.id)), (log) => {
          if (mainWindow) mainWindow.webContents.send('server-log', log);
        });
        progressMonitor.startWatching('host');
      }
    },
    (count, goal, earned) => {
      if (mainWindow) mainWindow.webContents.send('progress-update', { count, goal, earned });
      setDiscordActivity(null, `Achievements: ${count}/${goal}`);
    },
    (currentVersion, nextVersion) => {
      if (mainWindow) mainWindow.webContents.send('goal-ready', { currentVersion, nextVersion });
    }
  );
}

ipcMain.on('launch', async (event, { profile, version }) => {
  // We will expand on this to handle instances correctly.
  const rootDir = path.join(getProfileDir(), "instances", version);

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  // Check if we need to copy saves and stats from the previous version
  const versionIndex = versionRoadmap.findIndex(v => v.id === version);
  if (versionIndex > 0) {
    const prevVersion = versionRoadmap[versionIndex - 1].id;
    const prevRootDir = path.join(getProfileDir(), "instances", prevVersion);
    const prevSavesDir = path.join(prevRootDir, 'saves');
    const newSavesDir = path.join(rootDir, 'saves');

    // If the new version doesn't have a saves folder yet, it's either a first-time launch 
    // or a fresh reset. We should migrate data from the previous version.
    if (!fs.existsSync(newSavesDir) && fs.existsSync(prevSavesDir)) {
      console.log(`Copying worlds from ${prevVersion} to ${version}...`);

      const backupDir = path.join(getProfileDir(), "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `client_${prevVersion}_${timestamp}.zip`);
      console.log(`Backing up ${prevVersion} worlds to ${backupFile}...`);
      try {
        require('child_process').execSync(`powershell -Command "Compress-Archive -Path '${prevSavesDir}' -DestinationPath '${backupFile}'"`);
      } catch (err) {
        console.error("Backup failed:", err);
      }

      fs.cpSync(prevSavesDir, newSavesDir, { recursive: true });

      // Also copy old stats files (stats_*.dat) and stats/ folder
      console.log(`Copying stats from ${prevVersion} to ${version}...`);
      if (fs.existsSync(prevRootDir)) {
        const files = fs.readdirSync(prevRootDir);
        for (const file of files) {
          if (file.includes('stats_') && file.endsWith('.dat')) {
            // Copy to root
            fs.copyFileSync(path.join(prevRootDir, file), path.join(rootDir, file));

            // Also copy to stats folder in case the new version expects it there (like Beta 1.6)
            const newStatsDir = path.join(rootDir, 'stats');
            if (!fs.existsSync(newStatsDir)) fs.mkdirSync(newStatsDir, { recursive: true });
            fs.copyFileSync(path.join(prevRootDir, file), path.join(newStatsDir, file.toLowerCase())); // Beta 1.6 lowered the case
          }
        }
        const prevStatsDir = path.join(prevRootDir, 'stats');
        if (fs.existsSync(prevStatsDir)) {
          fs.cpSync(prevStatsDir, path.join(rootDir, 'stats'), { recursive: true });
        }
      }

      if (fs.existsSync(path.join(prevRootDir, 'options.txt'))) {
        fs.copyFileSync(path.join(prevRootDir, 'options.txt'), path.join(rootDir, 'options.txt'));
      }
      if (fs.existsSync(path.join(prevRootDir, 'servers.dat'))) {
        fs.copyFileSync(path.join(prevRootDir, 'servers.dat'), path.join(rootDir, 'servers.dat'));
      }
    }
  }

  if (version === '1.12' || version.startsWith('1.12')) {
    const savesDir = path.join(rootDir, 'saves');
    if (fs.existsSync(savesDir)) {
      const worlds = fs.readdirSync(savesDir);
      for (const world of worlds) {
        const worldDir = path.join(savesDir, world);
        if (!fs.existsSync(path.join(worldDir, 'data', 'advancements', 'legacy', 'root.json'))) {
          migrateAdvancements(worldDir);
        }
      }
    }
  }

  if (version === '1.7.2' || version.startsWith('1.7')) {
    const savesDir = path.join(rootDir, 'saves');
    if (fs.existsSync(savesDir)) {
      const worlds = fs.readdirSync(savesDir);
      for (const world of worlds) {
        const worldDir = path.join(savesDir, world);
        migrateStatsTo17(worldDir, rootDir, profile.id, profile.name);
      }
    }
  }

  const optionsPath = path.join(rootDir, 'options.txt');
  if (fs.existsSync(optionsPath)) {
    let optsText = fs.readFileSync(optionsPath, 'utf8');
    if (optsText.includes('lang:')) {
      optsText = optsText.replace(/^lang:.*$/gm, 'lang:en_US');
      fs.writeFileSync(optionsPath, optsText);
    }
  }

  let opts = {
    clientPackage: null,
    authorization: profile,
    root: rootDir,
    version: {
      number: version,
      type: "release"
    },
    memory: {
      max: "4G",
      min: "2G"
    }
  };

  // Check if we have the portable JRE 8 installed
  const localJrePath = await resolveJava(getRequiredJavaVersion(version));
  if (localJrePath) {
    opts.javaPath = localJrePath;
    console.log("Using portable Java 8 at:", localJrePath);
  } else {
    console.log("Portable Java 8 not found, falling back to system Java.");
  }

  if (version.startsWith('b')) {
    opts.version.type = 'old_beta';
  } else if (version.startsWith('a')) {
    opts.version.type = 'old_alpha';
  }

  console.log("Starting Minecraft", version);

  let launchStartTime = 0;

  try {
    setDiscordActivity('Playing ' + version, 'Client');
    launchStartTime = Date.now();
    launcher.launch(opts);
  } catch (err) {
    console.error("Failed to start launcher:", err);
    if (mainWindow) mainWindow.webContents.send('launch-error', err.message);
  }

  launcher.removeAllListeners('debug');
  launcher.removeAllListeners('data');
  launcher.removeAllListeners('error');
  launcher.removeAllListeners('close');

  launcher.on('debug', (e) => {
    console.log(e);
    if (mainWindow) mainWindow.webContents.send('launch-debug', e);
  });
  launcher.on('data', (e) => {
    console.log(e);
    if (mainWindow) mainWindow.webContents.send('launch-data', e);
  });
  launcher.on('error', (e) => {
    console.error('Launcher Error:', e);
    if (mainWindow) mainWindow.webContents.send('launch-error', e.toString());
  });

  // Start monitoring (only if not already started by server host)
  if (!progressMonitor) {
    setupProgressMonitor();
  }

  // Find current index
  const idx = versionRoadmap.findIndex(v => v.id === version);
  if (idx !== -1) progressMonitor.currentVersionIndex = idx;

  progressMonitor.startWatching(profile.name);

  launcher.on('close', (e) => {
    if (launchStartTime > 0) {
      const sessionMinutes = Math.floor((Date.now() - launchStartTime) / 60000);
      const statePath = path.join(getProfileDir(), "state.json");
      let state = {};
      if (fs.existsSync(statePath)) {
        try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch(err) {}
      }
      state.totalPlaytime = (state.totalPlaytime || 0) + sessionMinutes;
      fs.writeFileSync(statePath, JSON.stringify(state));
      if (mainWindow) mainWindow.webContents.send('playtime-update', state.totalPlaytime);
    }

    // Only stop if we aren't hosting
    if (!serverManager || !serverManager.serverProcess) {
      progressMonitor.stopWatching();
    }
  });
});

function migrateAdvancements(worldDir) {
  const statsDir = path.join(worldDir, 'stats');
  if (!fs.existsSync(statsDir)) return;

  const legacyAchievements = new Set();
  const uuids = new Set();

  const files = fs.readdirSync(statsDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      uuids.add(file.replace('.json', ''));
      try {
        const content = JSON.parse(fs.readFileSync(path.join(statsDir, file), 'utf8'));
        for (const key in content) {
          if (key.startsWith('achievement.')) {
            legacyAchievements.add(key);
          }
        }
      } catch (e) { }
    }
  }

  if (legacyAchievements.size === 0) return;

  const advDir = path.join(worldDir, 'data', 'advancements', 'legacy');
  if (!fs.existsSync(advDir)) {
    fs.mkdirSync(advDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0] + " +0000";

  fs.writeFileSync(path.join(advDir, 'root.json'), JSON.stringify({
    display: {
      icon: { item: "minecraft:book" },
      title: "Through The Ages",
      description: "Achievements from previous eras",
      background: "minecraft:textures/gui/advancements/backgrounds/stone.png",
      show_toast: false,
      announce_to_chat: false
    },
    criteria: { impossible: { trigger: "minecraft:impossible" } }
  }, null, 2));

  const advancementsFileContent = {
    "legacy:root": { criteria: { impossible: timestamp }, done: true },
    "minecraft:story/root": { criteria: { crafting_table: timestamp }, done: true }
  };

  for (const ach of legacyAchievements) {
    const id = ach.replace('achievement.', '');
    const safeId = id.toLowerCase().replace(/[^a-z0-9_]/g, '');

    fs.writeFileSync(path.join(advDir, `${safeId}.json`), JSON.stringify({
      display: {
        icon: { item: "minecraft:paper" },
        title: `Legacy: ${id}`,
        description: "Earned in a previous era",
        show_toast: false,
        announce_to_chat: false
      },
      parent: "legacy:root",
      criteria: { impossible: { trigger: "minecraft:impossible" } }
    }, null, 2));

    advancementsFileContent[`legacy:${safeId}`] = {
      criteria: { impossible: timestamp },
      done: true
    };
  }

  const playerAdvDir = path.join(worldDir, 'advancements');
  if (!fs.existsSync(playerAdvDir)) fs.mkdirSync(playerAdvDir, { recursive: true });

  for (const uuid of uuids) {
    const targetFile = path.join(playerAdvDir, `${uuid}.json`);
    let playerAdv = { ...advancementsFileContent };

    if (fs.existsSync(targetFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        playerAdv = { ...existing, ...playerAdv };
      } catch (e) { }
    }
    fs.writeFileSync(targetFile, JSON.stringify(playerAdv, null, 2));
  }
}

const betaAchievementMap = {
  "5242880": "achievement.openInventory",
  "5242881": "achievement.mineWood",
  "5242882": "achievement.buildWorkBench",
  "5242883": "achievement.buildPickaxe",
  "5242884": "achievement.buildFurnace",
  "5242885": "achievement.acquireIron",
  "5242886": "achievement.buildHoe",
  "5242887": "achievement.makeBread",
  "5242888": "achievement.bakeCake",
  "5242889": "achievement.buildBetterPickaxe",
  "5242890": "achievement.cookFish",
  "5242891": "achievement.onARail",
  "5242892": "achievement.buildSword",
  "5242893": "achievement.killEnemy",
  "5242894": "achievement.killCow",
  "5242895": "achievement.flyPig",
  "5242896": "achievement.snipeSkeleton",
  "5242897": "achievement.diamonds",
  "5242898": "achievement.portal",
  "5242899": "achievement.ghast",
  "5242900": "achievement.blazeRod",
  "5242901": "achievement.potion",
  "5242902": "achievement.theEnd",
  "5242903": "achievement.theEnd2",
  "5242904": "achievement.enchantments",
  "5242905": "achievement.overkill",
  "5242906": "achievement.bookcase",
  "5242907": "achievement.exploreAllBiomes",
  "5242908": "achievement.spawnWither",
  "5242909": "achievement.killWither",
  "5242910": "achievement.fullBeacon",
  "5242911": "achievement.breedCow",
  "5242912": "achievement.diamondsToYou"
};

function formatUUID(uuid) {
  if (uuid && uuid.length === 32) {
    return `${uuid.substr(0, 8)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}-${uuid.substr(16, 4)}-${uuid.substr(20)}`;
  }
  return uuid;
}

function getWhitelist() {
  const whitelistPath = path.join(getProfileDir(), "whitelist.json");
  if (fs.existsSync(whitelistPath)) {
    try {
      return JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
    } catch (e) { }
  }
  return [];
}

function saveWhitelist(users) {
  const whitelistPath = path.join(getProfileDir(), "whitelist.json");
  fs.writeFileSync(whitelistPath, JSON.stringify(users, null, 2));
}

function syncWhitelistToServer(version) {
  const users = getWhitelist();
  const serverDir = path.join(getProfileDir(), "servers", version);
  if (!fs.existsSync(serverDir)) fs.mkdirSync(serverDir, { recursive: true });

  fs.writeFileSync(path.join(serverDir, 'whitelist.json'), JSON.stringify(users, null, 2));
  const txt = users.map(u => u.name).join('\n');
  const txtLower = users.map(u => u.name.toLowerCase()).join('\n');
  // Write all variations to cover different legacy versions and case sensitivity bugs
  fs.writeFileSync(path.join(serverDir, 'white-list.txt'), txt + '\n' + txtLower);
  fs.writeFileSync(path.join(serverDir, 'whitelist.txt'), txt + '\n' + txtLower);
}

ipcMain.on('get-whitelist', (event) => {
  event.reply('whitelist-data', getWhitelist());
});

ipcMain.on('add-whitelist', async (event, name) => {
  const users = getWhitelist();
  if (!users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
    let uuid = "";
    try {
      const res = await new Promise((resolve) => {
        require('https').get(`https://api.mojang.com/users/profiles/minecraft/${name}`, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            if (response.statusCode === 200) resolve(JSON.parse(data));
            else resolve(null);
          });
        });
      });
      if (res && res.id) {
        uuid = formatUUID(res.id);
      }
    } catch (e) { }

    users.push({ uuid: uuid, name: name });
    saveWhitelist(users);

    if (serverManager && serverManager.serverProcess) {
      serverManager.serverProcess.stdin.write(`whitelist add ${name}\n`);
      serverManager.serverProcess.stdin.write(`whitelist reload\n`);
    }
  }
  event.reply('whitelist-data', getWhitelist());
});

ipcMain.on('remove-whitelist', (event, name) => {
  let users = getWhitelist();
  users = users.filter(u => u.name.toLowerCase() !== name.toLowerCase());
  saveWhitelist(users);

  if (serverManager && serverManager.serverProcess) {
    serverManager.serverProcess.stdin.write(`whitelist remove ${name}\n`);
    serverManager.serverProcess.stdin.write(`whitelist reload\n`);
  }
  event.reply('whitelist-data', users);
});

function migrateStatsTo17(worldDir, rootDir, knownUuid = null, knownUsername = null) {
  if (!fs.existsSync(rootDir)) return;

  const crypto = require('crypto');
  const generateOfflineUUID = (name) => {
      const hash = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
      hash[6] = (hash[6] & 0x0f) | 0x30;
      hash[8] = (hash[8] & 0x3f) | 0x80;
      return hash.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  };

  const files = fs.readdirSync(rootDir);
  for (const file of files) {
    if (file.includes('stats_') && file.endsWith('.dat')) {
      let statsData = {};
      let parsedUsername = knownUsername;
      try {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
        const data = JSON.parse(content);
        if (!parsedUsername && data && data.user && data.user.name) parsedUsername = data.user.name;

        if (data && data['stats-change']) {
          for (const statObj of data['stats-change']) {
            for (const key in statObj) {
              if (betaAchievementMap[key]) {
                statsData[betaAchievementMap[key]] = statObj[key];
              }
            }
          }
        }
      } catch (e) { continue; }

      if (Object.keys(statsData).length > 0 && parsedUsername) {
        const statsDir = path.join(worldDir, 'stats');
        if (!fs.existsSync(statsDir)) fs.mkdirSync(statsDir, { recursive: true });

        const targetFileUser = path.join(statsDir, `${parsedUsername}.json`);
        let targetUuid = knownUuid ? formatUUID(knownUuid) : generateOfflineUUID(parsedUsername);
        const targetFileUuid = path.join(statsDir, `${targetUuid}.json`);

        let playerStats = { ...statsData };
        if (fs.existsSync(targetFileUser)) {
          try {
            const existing = JSON.parse(fs.readFileSync(targetFileUser, 'utf8'));
            playerStats = { ...existing, ...playerStats };
          } catch (e) { }
        }

        fs.writeFileSync(targetFileUser, JSON.stringify(playerStats, null, 2));
        fs.writeFileSync(targetFileUuid, JSON.stringify(playerStats, null, 2));
      }
    }
  }
}

// Screenshots IPC
ipcMain.handle('get-screenshots', (e, version) => {
  const screenshotsDir = path.join(getProfileDir(), "instances", version, "screenshots");
  if (!fs.existsSync(screenshotsDir)) return [];
  try {
    const files = fs.readdirSync(screenshotsDir);
    return files
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
      .map(f => path.join(screenshotsDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  } catch (err) {
    return [];
  }
});

ipcMain.on('delete-screenshot', (e, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Failed to delete screenshot:", err);
  }
});

// News IPC
ipcMain.handle('get-news', () => {
  const newsPath = path.join(__dirname, 'news.txt');
  if (!fs.existsSync(newsPath)) return [];
  
  try {
    const content = fs.readFileSync(newsPath, 'utf8');
    const newsItems = [];
    let currentItem = null;
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line.startsWith('Title: ')) {
        if (currentItem) newsItems.push(currentItem);
        currentItem = { title: line.substring(7).trim(), date: '', body: '' };
      } else if (line.startsWith('Date: ') && currentItem) {
        currentItem.date = line.substring(6).trim();
      } else if (line.startsWith('Body: ') && currentItem) {
        currentItem.body = line.substring(6).trim();
      } else if (line && currentItem) {
        // Handle multi-line body
        if (currentItem.body) currentItem.body += ' ' + line;
        else currentItem.body = line;
      }
    });
    if (currentItem) newsItems.push(currentItem);
    
    return newsItems;
  } catch (err) {
    return [];
  }
});

// Remote Player Stats Sync
const http = require('http');
const natUpnp = require('nat-upnp');
let statsServer = null;
let statsUpnpClient = natUpnp.createClient();

ipcMain.handle('start-stats-server', (e) => {
  if (statsServer) return { success: false, error: 'Already running' };
  
  return new Promise((resolve) => {
    statsServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.method === 'POST' && req.url === '/sync-stats') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { username, statsData } = data;
            
            if (username && statsData) {
              const crypto = require('crypto');
              const generateOfflineUUID = (name) => {
                  const hash = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
                  hash[6] = (hash[6] & 0x0f) | 0x30;
                  hash[8] = (hash[8] & 0x3f) | 0x80;
                  return hash.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
              };
              
              const targetUuid = generateOfflineUUID(username);
              const worldDir = path.join(getProfileDir(), "servers", "1.7.2", "world");
              const statsDir = path.join(worldDir, 'stats');
              
              if (!fs.existsSync(statsDir)) fs.mkdirSync(statsDir, { recursive: true });
              
              const targetFileUser = path.join(statsDir, `${username}.json`);
              const targetFileUuid = path.join(statsDir, `${targetUuid}.json`);
              
              // Apply beta achievement map
              let convertedStats = {};
              for (const key in statsData) {
                if (betaAchievementMap[key]) convertedStats[betaAchievementMap[key]] = statsData[key];
                else convertedStats[key] = statsData[key]; // Keep generic stats
              }
              
              let playerStats = { ...convertedStats };
              if (fs.existsSync(targetFileUser)) {
                try {
                  const existing = JSON.parse(fs.readFileSync(targetFileUser, 'utf8'));
                  playerStats = { ...existing, ...playerStats };
                } catch (e) { }
              }
              
              fs.writeFileSync(targetFileUser, JSON.stringify(playerStats, null, 2));
              fs.writeFileSync(targetFileUuid, JSON.stringify(playerStats, null, 2));
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Missing username or statsData' }));
            }
          } catch(err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    statsServer.listen(25566, () => {
      statsUpnpClient.portMapping({
          public: 25566,
          private: 25566,
          ttl: 0
      }, (err) => {
          if (err) resolve({ success: true, warning: 'UPnP Failed. Friends may need VPN (Hamachi/Radmin) or manual port forward.' });
          else resolve({ success: true });
      });
    });
  });
});

ipcMain.handle('stop-stats-server', (e) => {
  return new Promise((resolve) => {
    if (statsServer) {
      statsUpnpClient.portUnmapping({ public: 25566 });
      statsServer.close(() => {
        statsServer = null;
        resolve({ success: true });
      });
    } else {
      resolve({ success: true });
    }
  });
});

ipcMain.handle('send-stats-to-host', async (e, hostIp) => {
  try {
    const instancesDir = path.join(getProfileDir(), "instances");
    let latestFile = null;
    let latestTime = 0;
    
    if (fs.existsSync(instancesDir)) {
      const instances = fs.readdirSync(instancesDir);
      for (const instance of instances) {
        const instancePath = path.join(instancesDir, instance);
        if (fs.statSync(instancePath).isDirectory()) {
          const files = fs.readdirSync(instancePath);
          for (const file of files) {
            if (file.includes('stats_') && file.endsWith('.dat')) {
              const fullPath = path.join(instancePath, file);
              const mtime = fs.statSync(fullPath).mtimeMs;
              if (mtime > latestTime) {
                latestTime = mtime;
                latestFile = fullPath;
              }
            }
          }
        }
      }
    }
    
    if (!latestFile) return { success: false, error: "No pre-1.7 stats file found locally." };
    
    const content = fs.readFileSync(latestFile, 'utf8');
    const data = JSON.parse(content);
    
    let username = "Player";
    if (data && data.user && data.user.name) username = data.user.name;
    
    let extractedStats = {};
    if (data && data['stats-change']) {
      for (const statObj of data['stats-change']) {
        for (const key in statObj) {
          extractedStats[key] = statObj[key];
        }
      }
    }
    
    const payload = JSON.stringify({
      username: username,
      statsData: extractedStats
    });
    
    return new Promise((resolve) => {
      const req = http.request({
        hostname: hostIp,
        port: 25566,
        path: '/sync-stats',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          try {
             resolve(JSON.parse(resBody));
          } catch(e) {
             resolve({ success: false, error: "Invalid response from host" });
          }
        });
      });
      
      req.on('error', (e) => {
        resolve({ success: false, error: "Could not connect to host: " + e.message });
      });
      
      req.write(payload);
      req.end();
    });

  } catch(err) {
    return { success: false, error: err.message };
  }
});

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const natUpnp = require('nat-upnp');

class ServerManager {
    constructor() {
        this.serverProcess = null;
        this.upnpClient = natUpnp.createClient();
        this.publicIp = null;
        this.backupInterval = null;
    }

    async downloadServer(profileDir, versionId, url) {
        const rootDir = path.join(profileDir, "servers", versionId);
        if (!fs.existsSync(rootDir)) {
            fs.mkdirSync(rootDir, { recursive: true });
        }
        
        const jarPath = path.join(rootDir, 'server.jar');
        
        if (fs.existsSync(jarPath)) {
            const stats = fs.statSync(jarPath);
            if (stats.size < 1000000) {
                fs.unlinkSync(jarPath);
            } else {
                return jarPath; // Already downloaded
            }
        }
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(jarPath);
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                     // Handle redirects
                     https.get(response.headers.location, (res2) => {
                         if (res2.statusCode !== 200) {
                             file.close();
                             fs.unlinkSync(jarPath);
                             return reject(new Error(`Failed to download server: HTTP ${res2.statusCode}`));
                         }
                         res2.pipe(file);
                         file.on('finish', () => { file.close(); resolve(jarPath); });
                     }).on('error', (err) => {
                         file.close();
                         fs.unlinkSync(jarPath);
                         reject(err);
                     });
                } else if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(jarPath);
                    return reject(new Error(`Failed to download server: HTTP ${response.statusCode}`));
                } else {
                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(jarPath); });
                }
            }).on('error', (err) => {
                file.close();
                fs.unlinkSync(jarPath);
                reject(err);
            });
        });
    }

    async startServer(profileDir, versionInfo, javaPath, onLog) {
        if (this.serverProcess) {
            throw new Error("A server is already running.");
        }
        
        if (!versionInfo.serverUrl) {
            throw new Error("No server URL configured for this version.");
        }

        onLog("Downloading server jar...");
        const jarPath = await this.downloadServer(profileDir, versionInfo.id, versionInfo.serverUrl);
        const serverDir = path.dirname(jarPath);

        // Accept EULA for newer versions
        fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true');
        
        // Force offline mode because legacy auth servers are dead
        const propsPath = path.join(serverDir, 'server.properties');
        let props = "";
        if (fs.existsSync(propsPath)) {
            props = fs.readFileSync(propsPath, 'utf8');
        }
        if (!props.includes('online-mode=')) {
            props += '\nonline-mode=false\n';
        } else {
            props = props.replace(/online-mode=true/g, 'online-mode=false');
        }
        
        // Disable spawn protection so the host can actually build near spawn
        if (!props.includes('spawn-protection=')) {
            props += '\nspawn-protection=0\n';
        } else {
            props = props.replace(/spawn-protection=\d+/g, 'spawn-protection=0');
        }
        
        // Enforce whitelist
        if (!props.includes('white-list=')) {
            props += '\nwhite-list=true\n';
        } else {
            props = props.replace(/white-list=false/g, 'white-list=true');
        }
        
        fs.writeFileSync(propsPath, props);

        onLog("Starting server process...");
        this.serverProcess = spawn(javaPath || 'java', ['-Xmx2G', '-Xms1G', '-jar', 'server.jar', 'nogui'], {
            cwd: serverDir
        });

        this.serverProcess.stdout.on('data', (data) => {
            onLog(data.toString());
        });

        this.serverProcess.stderr.on('data', (data) => {
            onLog(data.toString());
        });

        this.serverProcess.on('close', (code) => {
            onLog(`Server closed with code ${code}`);
            this.serverProcess = null;
            if (this.backupInterval) { clearInterval(this.backupInterval); this.backupInterval = null; }
        });

        // UPnP Mapping
        onLog("Attempting UPnP port mapping for 25565...");
        this.upnpClient.portMapping({
            public: 25565,
            private: 25565,
            ttl: 0
        }, (err) => {
            if (err) {
                onLog("UPnP Mapping Failed: " + err);
            } else {
                onLog("UPnP Mapping Successful! Port 25565 is open.");
                this.upnpClient.externalIp((err, ip) => {
                    if (!err) this.publicIp = ip;
                });
            }
        });

        // Routine Backups (every 60 minutes)
        if (this.backupInterval) clearInterval(this.backupInterval);
        this.backupInterval = setInterval(() => {
            this.runBackup(serverDir, onLog);
        }, 60 * 60 * 1000);
    }

    runBackup(serverDir, onLog) {
        if (!this.serverProcess) return;
        onLog("Starting routine backup...");
        this.serverProcess.stdin.write('save-off\n');
        this.serverProcess.stdin.write('save-all\n');
        
        setTimeout(() => {
            try {
                const worldDir = path.join(serverDir, 'world');
                if (fs.existsSync(worldDir)) {
                    const backupDir = path.join(serverDir, '..', '..', 'backups');
                    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const backupFile = path.join(backupDir, `routine_backup_${timestamp}.zip`);
                    
                    require('child_process').execSync(`powershell -Command "Compress-Archive -Path '${worldDir}' -DestinationPath '${backupFile}'"`);
                    onLog("Routine backup completed: " + backupFile);
                }
            } catch (err) {
                onLog("Routine backup failed: " + err.message);
            } finally {
                this.serverProcess.stdin.write('save-on\n');
            }
        }, 5000);
    }

    stopServer() {
        return new Promise((resolve) => {
            if (this.backupInterval) { clearInterval(this.backupInterval); this.backupInterval = null; }
            this.upnpClient.portUnmapping({ public: 25565 });
            
            if (!this.serverProcess) {
                resolve();
                return;
            }
            
            // Send save-all and stop commands
            this.serverProcess.stdin.write('save-all\n');
            setTimeout(() => {
                this.serverProcess.stdin.write('stop\n');
            }, 1000);
            
            this.serverProcess.on('close', () => {
                resolve();
            });
        });
    }
}

module.exports = ServerManager;

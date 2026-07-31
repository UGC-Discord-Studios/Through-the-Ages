const fs = require('fs');
const path = require('path');

// Defines the progression sequence
const defaultRoadmap = [
  { id: 'b1.5', targetAchievements: 15, serverUrl: 'https://vault.omniarchive.uk/archive/java/server-beta/b1.5/b1.5.jar' },
  { id: 'b1.8', targetAchievements: 16, serverUrl: 'https://vault.omniarchive.uk/archive/java/server-beta/b1.8/b1.8.jar' },
  { id: '1.0', targetAchievements: 21, serverUrl: 'https://vault.omniarchive.uk/archive/java/server-release/1.0.0/1.0.0.jar' },
  { id: '1.5', targetAchievements: 25, serverUrl: 'https://launcher.mojang.com/v1/objects/aedad5159ef56d69c5bcf77ed141f53430af43c3/server.jar' },
  { id: '1.7.2', targetAchievements: 29, serverUrl: 'https://launcher.mojang.com/v1/objects/3716cac82982e7c2eb09f83028b555e9ea606002/server.jar' },
  { id: '1.10', targetAchievements: 30, serverUrl: 'https://piston-data.mojang.com/v1/objects/a96617ffdf5dabbb718ab11a9a68e50545fc5bee/server.jar' },
  { id: '1.12', targetAchievements: 45, serverUrl: 'https://piston-data.mojang.com/v1/objects/8494e844e911ea0d63878f64da9dcc21f53a3463/server.jar' },
  { id: '1.13', targetAchievements: 50, serverUrl: 'https://piston-data.mojang.com/v1/objects/d0caafb8438ebd206f99930cfaecfa6c9a13dca0/server.jar' },
  { id: '1.14', targetAchievements: 60, serverUrl: 'https://piston-data.mojang.com/v1/objects/f1a0073671057f01aa843443fef34330281333ce/server.jar' },
  { id: '1.15', targetAchievements: 65, serverUrl: 'https://piston-data.mojang.com/v1/objects/e9f105b3c5c7e85c7b445249a93362a22f62442d/server.jar' },
  { id: '1.16', targetAchievements: 80, serverUrl: 'https://piston-data.mojang.com/v1/objects/a0d03225615ba897619220e256a266cb33a44b6b/server.jar' },
  { id: '1.17', targetAchievements: 85, serverUrl: 'https://piston-data.mojang.com/v1/objects/0a269b5f2c5b93b1712d0f5dc43b6182b9ab254e/server.jar' },
  { id: '1.18', targetAchievements: 90, serverUrl: 'https://piston-data.mojang.com/v1/objects/3cf24a8694aca6267883b17d934efacc5e44440d/server.jar' },
  { id: '1.19', targetAchievements: 100, serverUrl: 'https://piston-data.mojang.com/v1/objects/e00c4052dac1d59a1188b2aa9d5a87113aaf1122/server.jar' },
  { id: '1.20', targetAchievements: 110, serverUrl: 'https://piston-data.mojang.com/v1/objects/15c777e2cfe0556eef19aab534b186c0c6f277e1/server.jar' },
  { id: '1.21', targetAchievements: 120, serverUrl: 'https://piston-data.mojang.com/v1/objects/450698d1863ab5180c25d7c804ef0fe6369dd1ba/server.jar' },
  { id: '1.21.6', targetAchievements: 125, serverUrl: 'https://piston-data.mojang.com/v1/objects/6e64dcabba3c01a7271b4fa6bd898483b794c59b/server.jar' },
  { id: '1.21.11', targetAchievements: 130, serverUrl: 'https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar' },
  { id: '26.2', targetAchievements: 135, serverUrl: 'https://piston-data.mojang.com/v1/objects/823e2250d24b3ddac457a60c92a6a941943fcd6a/server.jar' }
];

const versionRoadmap = JSON.parse(JSON.stringify(defaultRoadmap));

const availableVersions = [
  ...defaultRoadmap,
  { id: '1.1', targetAchievements: 15, serverUrl: 'https://vault.omniarchive.uk/archive/java/server-release/1.1/1.1.jar' },
  { id: '1.2.5', targetAchievements: 20, serverUrl: 'https://launcher.mojang.com/v1/objects/d8321edc9470e56b8ad5c67bbd16beba25843336/server.jar' },
  { id: '1.3.2', targetAchievements: 25, serverUrl: 'https://launcher.mojang.com/v1/objects/3de2ae6c488135596e073a9589842800c9f53bfe/server.jar' },
  { id: '1.4.2', targetAchievements: 30, serverUrl: 'https://launcher.mojang.com/v1/objects/5be700523a729bb78ef99206fb480a63dcd09825/server.jar' },
  { id: '1.5.2', targetAchievements: 35, serverUrl: 'https://launcher.mojang.com/v1/objects/f9ae3f651319151ce99a0bfad6b34fa16eb6775f/server.jar' },
  { id: '1.6.4', targetAchievements: 40, serverUrl: 'https://launcher.mojang.com/v1/objects/050f93c1f3fe9e2052398f7bd6aca10c63d64a87/server.jar' },
  { id: '1.8', targetAchievements: 45, serverUrl: 'https://launcher.mojang.com/v1/objects/a028f00e678ee5c6aef0e29656dca091b5df11c7/server.jar' },
  { id: '1.9', targetAchievements: 50, serverUrl: 'https://piston-data.mojang.com/v1/objects/b4d449cf2918e0f3bd8aa18954b916a4d1880f0d/server.jar' },
  { id: '1.11', targetAchievements: 55, serverUrl: 'https://piston-data.mojang.com/v1/objects/48820c84cb1ed502cb5b2fe23b8153d5e4fa61c0/server.jar' }
].sort((a, b) => {
  // Rough sort by ID to group things reasonably, keeping beta first
  if (a.id.startsWith('b') && !b.id.startsWith('b')) return -1;
  if (!a.id.startsWith('b') && b.id.startsWith('b')) return 1;
  return a.targetAchievements - b.targetAchievements;
});

// Remove duplicates based on ID (since defaultRoadmap is included)
const uniqueAvailableVersions = Array.from(new Map(availableVersions.map(item => [item.id, item])).values());

class ProgressMonitor {
  constructor(appDataPath, onGoalReached, onProgressUpdate, onGoalReady) {
    this.appDataPath = appDataPath;
    this.onGoalReached = onGoalReached;
    this.onProgressUpdate = onProgressUpdate;
    this.onGoalReady = onGoalReady;
    this.currentVersionIndex = 0;
    this.watchInterval = null;
    this.username = null;
  }

  getCurrentVersion() {
    return versionRoadmap[this.currentVersionIndex];
  }

  startWatching(username) {
    this.username = username;
    if (this.watchInterval) clearInterval(this.watchInterval);

    // Poll every 5 seconds
    this.watchInterval = setInterval(() => {
      this.checkProgress();
    }, 5000);
  }

  stopWatching() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  advanceVersion() {
    if (this.currentVersionIndex < versionRoadmap.length - 1) {
      const oldVersion = this.getCurrentVersion();
      this.currentVersionIndex++;
      const nextVersion = this.getCurrentVersion();
      if (this.onGoalReached) {
        this.onGoalReached(oldVersion, nextVersion);
      }
    }
  }

  checkProgress() {
    if (!this.username) return;

    const versionInfo = this.getCurrentVersion();
    const instanceDir = path.join(this.appDataPath, "instances", versionInfo.id);
    const serverDir = path.join(this.appDataPath, "servers", versionInfo.id);

    let result = this.estimateAchievementCount([instanceDir, serverDir]);
    let achievementCount = typeof result === 'number' ? result : result.count;
    let earned = typeof result === 'object' ? result.earned : [];

    if (this.onProgressUpdate) {
      this.onProgressUpdate(achievementCount, versionInfo.targetAchievements, earned);
    }

    if (achievementCount >= versionInfo.targetAchievements) {
      this.stopWatching();

      if (this.currentVersionIndex < versionRoadmap.length - 1) {
        const nextVersion = versionRoadmap[this.currentVersionIndex + 1];
        if (this.onGoalReady) {
          this.onGoalReady(versionInfo, nextVersion);
        }
      }
    }
  }

  estimateAchievementCount(baseDirs) {
    const legacyBetaAchievements = new Set();
    const legacyJsonAchievements = new Set();
    const modernAdvancements = new Set();

    const allSavesDirs = [];
    const allJsonStatsDirs = [];
    const allSearchDirs = [];
    const allAdvDirs = [];

    for (const baseDir of baseDirs) {
      const savesDir = path.join(baseDir, 'saves'); // Client saves
      const worldDir = path.join(baseDir, 'world'); // Server world
      
      allSavesDirs.push(savesDir);
      allSearchDirs.push(baseDir, path.join(baseDir, 'stats'));
      allJsonStatsDirs.push(path.join(baseDir, 'stats'));

      // Add single-player worlds
      if (fs.existsSync(savesDir)) {
        const worlds = fs.readdirSync(savesDir);
        for (const world of worlds) {
          allJsonStatsDirs.push(path.join(savesDir, world, 'stats'));
          allAdvDirs.push(path.join(savesDir, world, 'advancements'));
          allAdvDirs.push(path.join(savesDir, world, 'data', 'advancements', 'legacy')); // 1.12 legacy datapack fallback
        }
      }
      
      // Add server world
      if (fs.existsSync(worldDir)) {
          allJsonStatsDirs.push(path.join(worldDir, 'stats'));
          allAdvDirs.push(path.join(worldDir, 'advancements'));
          allAdvDirs.push(path.join(worldDir, 'data', 'advancements', 'legacy')); // 1.12 legacy datapack fallback
      }
    }

    // 1. Check 1.7-1.11 JSON stats
    for (const dir of allJsonStatsDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
              for (const key in content) {
                if (key.startsWith('achievement.')) {
                  let isDone = false;
                  if (typeof content[key] === 'number' && content[key] > 0) isDone = true;
                  else if (typeof content[key] === 'object' && content[key].value > 0) isDone = true;
                  
                  if (isDone) {
                    legacyJsonAchievements.add(key);
                  }
                }
              }
            } catch (e) {}
          }
        }
      }
    }

    // 2. Check old pre-1.7 stats (.dat)
    for (const dir of allSearchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.includes('stats_') && file.includes('.dat')) {
            try {
              const content = fs.readFileSync(path.join(dir, file), 'utf8');
              const data = JSON.parse(content);
              if (data && data['stats-change']) {
                for (const statObj of data['stats-change']) {
                  for (const key in statObj) {
                    if (key.startsWith('52428') || key.startsWith('52429')) {
                      if (statObj[key] > 0) {
                        legacyBetaAchievements.add(key);
                      }
                    }
                  }
                }
              }
            } catch (e) {
            }
          }
        }
      }
    }

    // 3. Check modern advancements (JSON)
    let hasModernAdvancements = false;
    for (const advDir of allAdvDirs) {
        if (fs.existsSync(advDir)) {
          const advFiles = fs.readdirSync(advDir);
          for (const file of advFiles) {
            try {
              if (file.endsWith('.json')) {
                  const content = JSON.parse(fs.readFileSync(path.join(advDir, file), 'utf8'));
                  for (const key in content) {
                    if (content[key].done && !key.startsWith('minecraft:recipes/')) {
                        modernAdvancements.add(key);
                        hasModernAdvancements = true;
                    }
                  }
              }
            } catch (e) { }
          }
        }
    }

    const legacyCount = legacyJsonAchievements.size > 0 ? legacyJsonAchievements.size : legacyBetaAchievements.size;
    
    let earned = new Set();
    if (legacyJsonAchievements.size > 0) {
        legacyJsonAchievements.forEach(a => earned.add(a));
    } else {
        legacyBetaAchievements.forEach(a => earned.add(a));
    }
    
    let modernCount = 0;
    for (const adv of modernAdvancements) {
        if (!adv.startsWith('legacy:')) {
            modernCount++;
            earned.add(adv);
        }
    }

    return { count: legacyCount + modernCount, earned: Array.from(earned) };
  }
}

function loadRoadmap(profileDir) {
  const p = path.join(profileDir, 'roadmap.json');
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      versionRoadmap.length = 0;
      versionRoadmap.push(...data);
    } catch(e) { console.error('Failed to load roadmap', e); }
  } else {
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    fs.writeFileSync(p, JSON.stringify(versionRoadmap, null, 2));
  }
}

function saveRoadmap(profileDir, newRoadmap) {
  versionRoadmap.length = 0;
  versionRoadmap.push(...newRoadmap);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  fs.writeFileSync(path.join(profileDir, 'roadmap.json'), JSON.stringify(versionRoadmap, null, 2));
}

module.exports = { ProgressMonitor, versionRoadmap, defaultRoadmap, availableVersions: uniqueAvailableVersions, loadRoadmap, saveRoadmap };

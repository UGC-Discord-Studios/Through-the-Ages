const { ipcRenderer } = require('electron');
const { version } = require('./package.json');

const appVersionLabel = document.getElementById('app-version-label');
if (appVersionLabel) appVersionLabel.innerText = 'v' + version;
// Title bar controls
document.getElementById('window-minimize').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('window-maximize').addEventListener('click', () => ipcRenderer.send('window-maximize'));
document.getElementById('window-close').addEventListener('click', () => ipcRenderer.send('window-close'));


const loginBtn = document.getElementById('login-btn');
const launchBtn = document.getElementById('launch-btn');
const loginSection = document.getElementById('login-section');
const launcherSection = document.getElementById('launcher-section');
const usernameSpan = document.getElementById('username');
const statusMsg = document.getElementById('status-msg');

let currentProfile = null;
let currentVersion = 'b1.5';

loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  loginBtn.innerText = 'Logging in...';

  const result = await ipcRenderer.invoke('login');

  if (result.success) {
    currentProfile = result.profile;
    usernameSpan.innerText = currentProfile.name;
    loginSection.classList.add('hidden');
    launcherSection.classList.remove('hidden');
    ipcRenderer.send('request-initial-progress', currentProfile.name);
  } else {
    loginBtn.disabled = false;
    loginBtn.innerText = 'Log In';
    alert('Login failed: ' + result.error);
  }
});

launchBtn.addEventListener('click', () => {
  if (!currentProfile) return;

  launchBtn.disabled = true;
  launchBtn.innerText = 'Launching...';
  statusMsg.innerText = 'Downloading assets and launching game...';

  ipcRenderer.send('launch', {
    profile: currentProfile,
    version: currentVersion
  });

  // Basic reset after a few seconds (in a real app, listen for launch events)
  setTimeout(() => {
    launchBtn.disabled = false;
    launchBtn.innerText = 'Play';
    statusMsg.innerText = 'Game is running...';
  }, 5000);
});

const resetBtn = document.getElementById('reset-btn');
const advanceBtn = document.getElementById('advance-btn');

advanceBtn.addEventListener('click', () => {
    ipcRenderer.send('advance-version');
});

resetBtn.addEventListener('click', () => {
  if (confirm("Are you sure you want to completely reset your progress back to Beta 1.5? (WARNING: Your world saves will also be deleted!)")) {
      ipcRenderer.send('reset-state');
      currentVersion = 'b1.5';
      document.getElementById('current-version').innerText = 'b1.5';
      document.getElementById('progress-text').innerText = `0 / 15 Achievements`;
      document.getElementById('achievement-progress').max = 15;
      document.getElementById('achievement-progress').value = 0;
      document.getElementById('status-msg').innerText = "Progress reset.";
      advanceBtn.classList.add('hidden');
  }
});

const skipBtn = document.getElementById('skip-btn');
skipBtn.addEventListener('click', () => {
  if (confirm("Debug: Are you sure you want to skip to the next version?")) {
    ipcRenderer.send('skip-version');
  }
});

const hostBtn = document.getElementById('host-btn');
const stopServerBtn = document.getElementById('stop-server-btn');
const serverConsole = document.getElementById('dash-console');

hostBtn.addEventListener('click', () => {
  hostBtn.disabled = true;
  hostBtn.innerText = 'Hosting...';
  stopServerBtn.disabled = false;
  serverConsole.innerHTML = '';

  ipcRenderer.send('host-server', { version: currentVersion });
});

stopServerBtn.addEventListener('click', () => {
  stopServerBtn.disabled = true;
  ipcRenderer.send('stop-server');
});

ipcRenderer.on('server-log', (event, msg) => {
  const p = document.createElement('div');
  p.innerText = msg;
  serverConsole.appendChild(p);
  serverConsole.scrollTop = serverConsole.scrollHeight;
});

ipcRenderer.on('server-stopped', () => {
  hostBtn.disabled = false;
  hostBtn.innerText = 'Start Server';
  stopServerBtn.disabled = true;
});

// IPC Listeners for progress
ipcRenderer.on('init-data', (event, data) => {
  if (data.versionRoadmap && data.versionRoadmap.length > 0) {
    currentVersion = data.savedVersion || data.versionRoadmap[0].id;
    const versionInfo = data.versionRoadmap.find(v => v.id === currentVersion) || data.versionRoadmap[0];

    document.getElementById('current-version').innerText = currentVersion;
    document.getElementById('progress-text').innerText = `0 / ${versionInfo.targetAchievements}`;
    document.getElementById('achievement-progress').max = versionInfo.targetAchievements;
  }
});

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

const legacyAchievementsList = [
    "achievement.openInventory", "achievement.mineWood", "achievement.buildWorkBench",
    "achievement.buildPickaxe", "achievement.buildFurnace", "achievement.acquireIron",
    "achievement.buildHoe", "achievement.makeBread", "achievement.bakeCake",
    "achievement.buildBetterPickaxe", "achievement.cookFish", "achievement.onARail",
    "achievement.buildSword", "achievement.killEnemy", "achievement.killCow",
    "achievement.flyPig", "achievement.snipeSkeleton", "achievement.diamonds",
    "achievement.portal", "achievement.ghast", "achievement.blazeRod",
    "achievement.potion", "achievement.theEnd", "achievement.theEnd2",
    "achievement.enchantments", "achievement.overkill", "achievement.bookcase",
    "achievement.exploreAllBiomes", "achievement.spawnWither", "achievement.killWither",
    "achievement.fullBeacon", "achievement.breedCow", "achievement.diamondsToYou"
];

const achievementNames = {
    "achievement.openInventory": { name: "Taking Inventory", icon: "🎒", version: "Beta 1.5" },
    "achievement.mineWood": { name: "Getting Wood", icon: "🪵", version: "Beta 1.5" },
    "achievement.buildWorkBench": { name: "Benchmarking", icon: "🛠️", version: "Beta 1.5" },
    "achievement.buildPickaxe": { name: "Time to Mine!", icon: "⛏️", version: "Beta 1.5" },
    "achievement.buildFurnace": { name: "Hot Topic", icon: "🔥", version: "Beta 1.5" },
    "achievement.acquireIron": { name: "Acquire Hardware", icon: "🪨", version: "Beta 1.5" },
    "achievement.buildHoe": { name: "Time to Farm!", icon: "🌾", version: "Beta 1.5" },
    "achievement.makeBread": { name: "Bake Bread", icon: "🍞", version: "Beta 1.5" },
    "achievement.bakeCake": { name: "The Lie", icon: "🍰", version: "Beta 1.5" },
    "achievement.buildBetterPickaxe": { name: "Getting an Upgrade", icon: "⛏️", version: "Beta 1.5" },
    "achievement.cookFish": { name: "Delicious Fish", icon: "🐟", version: "Beta 1.5" },
    "achievement.onARail": { name: "On A Rail", icon: "🛒", version: "Beta 1.5" },
    "achievement.buildSword": { name: "Time to Strike!", icon: "🗡️", version: "Beta 1.5" },
    "achievement.killEnemy": { name: "Monster Hunter", icon: "🧟", version: "Beta 1.5" },
    "achievement.killCow": { name: "Cow Tipper", icon: "🐄", version: "Beta 1.5" },
    "achievement.flyPig": { name: "When Pigs Fly", icon: "🐷", version: "Beta 1.5" },
    "achievement.snipeSkeleton": { name: "Sniper Duel", icon: "🏹", version: "Release 1.0" },
    "achievement.diamonds": { name: "DIAMONDS!", icon: "💎", version: "Release 1.0" },
    "achievement.portal": { name: "We Need to Go Deeper", icon: "🟣", version: "Release 1.0" },
    "achievement.ghast": { name: "Return to Sender", icon: "🔥", version: "Release 1.0" },
    "achievement.blazeRod": { name: "Into Fire", icon: "🔥", version: "Release 1.0" },
    "achievement.potion": { name: "Local Brewery", icon: "🧪", version: "Release 1.0" },
    "achievement.theEnd": { name: "The End?", icon: "👁️", version: "Release 1.0" },
    "achievement.theEnd2": { name: "The End.", icon: "🐉", version: "Release 1.0" },
    "achievement.enchantments": { name: "Enchanter", icon: "✨", version: "Release 1.0" },
    "achievement.overkill": { name: "Overkill", icon: "💥", version: "Release 1.0" },
    "achievement.bookcase": { name: "Librarian", icon: "📚", version: "Release 1.0" },
    "achievement.exploreAllBiomes": { name: "Adventuring Time", icon: "🗺️", version: "Release 1.7" },
    "achievement.spawnWither": { name: "The Beginning?", icon: "💀", version: "Release 1.4" },
    "achievement.killWither": { name: "The Beginning.", icon: "🌟", version: "Release 1.4" },
    "achievement.fullBeacon": { name: "Beaconator", icon: "📡", version: "Release 1.4" },
    "achievement.breedCow": { name: "Repopulation", icon: "💖", version: "Release 1.7" },
    "achievement.diamondsToYou": { name: "Diamonds to you!", icon: "💎", version: "Release 1.7" }
    ,
    // 1.12
    "minecraft:story/root": { name: "Minecraft", icon: "🌍", version: "Release 1.12" },
    "minecraft:story/mine_stone": { name: "Stone Age", icon: "⛏️", version: "Release 1.12" },
    "minecraft:story/upgrade_tools": { name: "Getting an Upgrade", icon: "⛏️", version: "Release 1.12" },
    "minecraft:story/smelt_iron": { name: "Acquire Hardware", icon: "🪨", version: "Release 1.12" },
    "minecraft:story/obtain_armor": { name: "Suit Up", icon: "🛡️", version: "Release 1.12" },
    "minecraft:story/lava_bucket": { name: "Hot Stuff", icon: "🔥", version: "Release 1.12" },
    "minecraft:story/iron_tools": { name: "Isn't It Iron Pick", icon: "⛏️", version: "Release 1.12" },
    "minecraft:story/deflect_arrow": { name: "Not Today, Thank You", icon: "🛡️", version: "Release 1.12" },
    "minecraft:story/form_obsidian": { name: "Ice Bucket Challenge", icon: "🧊", version: "Release 1.12" },
    "minecraft:story/mine_diamond": { name: "Diamonds!", icon: "💎", version: "Release 1.12" },
    "minecraft:story/enter_the_nether": { name: "We Need to Go Deeper", icon: "🟣", version: "Release 1.12" },
    "minecraft:story/shiny_gear": { name: "Cover Me With Diamonds", icon: "💎", version: "Release 1.12" },
    "minecraft:story/enchant_item": { name: "Enchanter", icon: "✨", version: "Release 1.12" },
    "minecraft:story/cure_zombie_villager": { name: "Zombie Doctor", icon: "🍎", version: "Release 1.12" },
    "minecraft:story/follow_ender_eye": { name: "Eye Spy", icon: "👁️", version: "Release 1.12" },
    "minecraft:story/enter_the_end": { name: "The End?", icon: "👁️", version: "Release 1.12" },
    "minecraft:nether/root": { name: "Nether", icon: "🔥", version: "Release 1.12" },
    "minecraft:nether/return_to_sender": { name: "Return to Sender", icon: "🔥", version: "Release 1.12" },
    "minecraft:nether/find_fortress": { name: "A Terrible Fortress", icon: "🏰", version: "Release 1.12" },
    "minecraft:nether/get_wither_skull": { name: "Spooky Scary Skeleton", icon: "💀", version: "Release 1.12" },
    "minecraft:nether/obtain_blaze_rod": { name: "Into Fire", icon: "🔥", version: "Release 1.12" },
    "minecraft:nether/brew_potion": { name: "Local Brewery", icon: "🧪", version: "Release 1.12" },
    "minecraft:nether/create_beacon": { name: "Bring Home the Beacon", icon: "📡", version: "Release 1.12" },
    "minecraft:nether/create_full_beacon": { name: "Beaconator", icon: "📡", version: "Release 1.12" },
    "minecraft:nether/summon_wither": { name: "Withering Heights", icon: "💀", version: "Release 1.12" },
    "minecraft:nether/uneasy_alliance": { name: "Uneasy Alliance", icon: "👻", version: "Release 1.12" },
    "minecraft:end/root": { name: "The End", icon: "🐉", version: "Release 1.12" },
    "minecraft:end/kill_dragon": { name: "Free the End", icon: "🗡️", version: "Release 1.12" },
    "minecraft:end/enter_end_gateway": { name: "Remote Getaway", icon: "🌌", version: "Release 1.12" },
    "minecraft:end/find_end_city": { name: "The City at the End of the Game", icon: "🏙️", version: "Release 1.12" },
    "minecraft:end/elytra": { name: "Sky's the Limit", icon: "🦋", version: "Release 1.12" },
    "minecraft:end/levitate": { name: "Great View From Up Here", icon: "🎈", version: "Release 1.12" },
    "minecraft:end/dragon_breath": { name: "You Need a Mint", icon: "💨", version: "Release 1.12" },
    "minecraft:end/dragon_egg": { name: "The Next Generation", icon: "🥚", version: "Release 1.12" },
    "minecraft:adventure/root": { name: "Adventure", icon: "🗺️", version: "Release 1.12" },
    "minecraft:adventure/kill_a_mob": { name: "Monster Hunter", icon: "🧟", version: "Release 1.12" },
    "minecraft:adventure/shoot_arrow": { name: "Take Aim", icon: "🏹", version: "Release 1.12" },
    "minecraft:adventure/sniper_duel": { name: "Sniper Duel", icon: "🏹", version: "Release 1.12" },
    "minecraft:adventure/totem_of_undying": { name: "Postmortal", icon: "🗿", version: "Release 1.12" },
    "minecraft:adventure/summon_iron_golem": { name: "Hired Help", icon: "🤖", version: "Release 1.12" },
    "minecraft:adventure/trade": { name: "What a Deal!", icon: "🤝", version: "Release 1.12" },
    "minecraft:adventure/kill_all_mobs": { name: "Monsters Hunted", icon: "🧟", version: "Release 1.12" },
    "minecraft:adventure/adventuring_time": { name: "Adventuring Time", icon: "🗺️", version: "Release 1.12" },
    "minecraft:husbandry/root": { name: "Husbandry", icon: "🌾", version: "Release 1.12" },
    "minecraft:husbandry/breed_an_animal": { name: "The Parrots and the Bats", icon: "💖", version: "Release 1.12" },
    "minecraft:husbandry/tame_an_animal": { name: "Best Friends Forever", icon: "🐾", version: "Release 1.12" },
    "minecraft:husbandry/plant_seed": { name: "A Seedy Place", icon: "🌱", version: "Release 1.12" },
    "minecraft:husbandry/bred_all_animals": { name: "Two by Two", icon: "💖", version: "Release 1.12" },
    "minecraft:husbandry/balanced_diet": { name: "A Balanced Diet", icon: "🍎", version: "Release 1.12" },
    // 1.13
    "minecraft:husbandry/fishy_business": { name: "Fishy Business", icon: "🎣", version: "Release 1.13" },
    "minecraft:husbandry/tactical_fishing": { name: "Tactical Fishing", icon: "🐡", version: "Release 1.13" },
    "minecraft:adventure/throwaway_joke": { name: "A Throwaway Joke", icon: "🔱", version: "Release 1.13" },
    "minecraft:adventure/very_very_frightening": { name: "Very Very Frightening", icon: "⚡", version: "Release 1.13" },
    "minecraft:adventure/sleep_with_the_fishes": { name: "Sleep with the Fishes", icon: "🌊", version: "Release 1.13" },
    // 1.14
    "minecraft:adventure/voluntary_exile": { name: "Voluntary Exile", icon: "🏴", version: "Release 1.14" },
    "minecraft:adventure/hero_of_the_village": { name: "Hero of the Village", icon: "🦸", version: "Release 1.14" },
    "minecraft:adventure/two_birds_one_arrow": { name: "Two Birds, One Arrow", icon: "🏹", version: "Release 1.14" },
    "minecraft:adventure/arbalistic": { name: "Arbalistic", icon: "🏹", version: "Release 1.14" },
    "minecraft:adventure/whos_the_pillager_now": { name: "Who's the Pillager Now?", icon: "🏹", version: "Release 1.14" },
    "minecraft:adventure/ol_betsy": { name: "Ol' Betsy", icon: "🏹", version: "Release 1.14" },
    "minecraft:husbandry/complete_catalogue": { name: "A Complete Catalogue", icon: "🐈", version: "Release 1.14" },
    // 1.15
    "minecraft:husbandry/safely_harvest_honey": { name: "Bee Our Guest", icon: "🍯", version: "Release 1.15" },
    "minecraft:adventure/honey_block_slide": { name: "Sticky Situation", icon: "🍯", version: "Release 1.15" },
    "minecraft:husbandry/silk_touch_nest": { name: "Total Beelocation", icon: "🐝", version: "Release 1.15" },
    // 1.16
    "minecraft:nether/find_bastion": { name: "Those Were the Days", icon: "🏰", version: "Release 1.16" },
    "minecraft:nether/obtain_crying_obsidian": { name: "Who is Cutting Onions?", icon: "😢", version: "Release 1.16" },
    "minecraft:nether/distract_piglin": { name: "Oh Shiny", icon: "✨", version: "Release 1.16" },
    "minecraft:nether/ride_strider": { name: "This Boat Has Legs", icon: "🌋", version: "Release 1.16" },
    "minecraft:nether/loot_bastion": { name: "War Pigs", icon: "🐖", version: "Release 1.16" },
    "minecraft:nether/explore_nether": { name: "Hot Tourist Destinations", icon: "🗺️", version: "Release 1.16" },
    "minecraft:nether/obtain_ancient_debris": { name: "Hidden in the Depths", icon: "🪨", version: "Release 1.16" },
    "minecraft:nether/use_lodestone": { name: "Country Lode, Take Me Home", icon: "🧭", version: "Release 1.16" },
    "minecraft:nether/charge_respawn_anchor": { name: "Not Quite 'Nine' Lives", icon: "⚓", version: "Release 1.16" },
    "minecraft:nether/netherite_armor": { name: "Cover Me in Debris", icon: "🛡️", version: "Release 1.16" },
    // 1.17
    "minecraft:husbandry/wax_on": { name: "Wax On", icon: "🍯", version: "Release 1.17" },
    "minecraft:husbandry/wax_off": { name: "Wax Off", icon: "🪓", version: "Release 1.17" },
    "minecraft:husbandry/axolotl_in_a_bucket": { name: "The Cutest Predator", icon: "🦎", version: "Release 1.17" },
    "minecraft:husbandry/kill_axolotl_target": { name: "The Healing Power of Friendship!", icon: "💖", version: "Release 1.17" },
    "minecraft:husbandry/make_a_sign_glow": { name: "Glow and Behold!", icon: "✨", version: "Release 1.17" },
    "minecraft:adventure/light_as_a_rabbit": { name: "Light as a Rabbit", icon: "🐇", version: "Release 1.17" },
    "minecraft:adventure/lightning_rod_with_villager_no_fire": { name: "Surge Protector", icon: "⚡", version: "Release 1.17" },
    "minecraft:adventure/fall_from_world_height": { name: "Caves & Cliffs", icon: "⛰️", version: "Release 1.17" },
    "minecraft:adventure/spyglass_at_parrot": { name: "Is It a Bird?", icon: "🦜", version: "Release 1.17" },
    // 1.18
    "minecraft:adventure/trade_at_world_height": { name: "Star Trader", icon: "⭐", version: "Release 1.18" },
    "minecraft:adventure/play_jukebox_in_meadows": { name: "Sound of Music", icon: "🎵", version: "Release 1.18" },
    "minecraft:nether/ride_strider_in_overworld_lava": { name: "Feels like home", icon: "🌋", version: "Release 1.18" },
    // 1.19
    "minecraft:husbandry/froglights": { name: "With Our Powers Combined!", icon: "🐸", version: "Release 1.19" },
    "minecraft:husbandry/leash_all_frog_variants": { name: "When the Squad Hops into Town", icon: "🐸", version: "Release 1.19" },
    "minecraft:adventure/kill_mob_near_sculk_catalyst": { name: "It Spreads", icon: "🦠", version: "Release 1.19" },
    "minecraft:adventure/avoid_vibration": { name: "Sneak 100", icon: "🤫", version: "Release 1.19" },
    "minecraft:husbandry/allay_deliver_cake_to_note_block": { name: "Birthday Song", icon: "🎂", version: "Release 1.19" },
    "minecraft:husbandry/allay_deliver_item_to_player": { name: "You've Got a Friend in Me", icon: "🧚", version: "Release 1.19" },
    // 1.20
    "minecraft:husbandry/obtain_sniffer_egg": { name: "Smells Interesting", icon: "🥚", version: "Release 1.20" },
    "minecraft:husbandry/feed_snifflet": { name: "Little Sniffs", icon: "🦕", version: "Release 1.20" },
    "minecraft:husbandry/plant_any_sniffer_seed": { name: "Planting the Past", icon: "🌱", version: "Release 1.20" },
    "minecraft:adventure/salvage_sherd": { name: "Respecting the Remnants", icon: "🏺", version: "Release 1.20" },
    "minecraft:adventure/craft_decorated_pot_using_only_sherds": { name: "Careful Restoration", icon: "🏺", version: "Release 1.20" },
    "minecraft:adventure/trim_with_any_armor_pattern": { name: "Crafting a New Look", icon: "👗", version: "Release 1.20" },
    "minecraft:adventure/trim_with_all_exclusive_armor_patterns": { name: "Smithing with Style", icon: "✨", version: "Release 1.20" },
    "minecraft:adventure/read_power_of_chiseled_bookshelf": { name: "The Power of Books", icon: "📚", version: "Release 1.20" },
    // 1.21
    "minecraft:adventure/minecraft_trials_edition": { name: "Minecraft: Trial(s) Edition", icon: "⚔️", version: "Release 1.21" },
    "minecraft:adventure/under_lock_and_key": { name: "Under Lock & Key", icon: "🗝️", version: "Release 1.21" },
    "minecraft:adventure/who_needs_rockets": { name: "Who Needs Rockets?", icon: "💨", version: "Release 1.21" },
    "minecraft:adventure/crafters_crafting_crafters": { name: "Crafters Crafting Crafters", icon: "🤖", version: "Release 1.21" },
    "minecraft:adventure/lighten_up": { name: "Lighten Up", icon: "💡", version: "Release 1.21" },
    "minecraft:adventure/overoverkill": { name: "Over-Overkill", icon: "💥", version: "Release 1.21" },
    "minecraft:adventure/revaulting": { name: "Revaulting", icon: "🔐", version: "Release 1.21" },
    "minecraft:adventure/blowback": { name: "Blowback", icon: "🌪️", version: "Release 1.21" },
    // Future
    "minecraft:adventure/stay_hydrated": { name: "Stay Hydrated!", icon: "💧", version: "Release 1.21.6" },
    "minecraft:adventure/heart_transplanter": { name: "Heart Transplanter", icon: "❤️", version: "Release 1.21.6" },
    "minecraft:adventure/mob_kabob": { name: "Mob Kabob", icon: "🍢", version: "Release 1.21.11" },
    "minecraft:adventure/uh_oh": { name: "Uh Oh", icon: "👀", version: "Release 26.2" }


};

ipcRenderer.on('progress-update', (event, { count, goal, earned }) => {
  document.getElementById('progress-text').innerText = `${count} / ${goal}`;
  document.getElementById('achievement-progress').value = count;
  document.getElementById('achievement-progress').max = goal;

  const achievementsListDiv = document.getElementById('achievements-list');
  if (achievementsListDiv && earned) {
      achievementsListDiv.innerHTML = '';
      
      const earnedSet = new Set(earned || []);
      
      
      const modernAdvancementsList = [
          "minecraft:story/root", "minecraft:story/mine_stone", "minecraft:story/upgrade_tools", "minecraft:story/smelt_iron", "minecraft:story/obtain_armor", "minecraft:story/lava_bucket", "minecraft:story/iron_tools", "minecraft:story/deflect_arrow", "minecraft:story/form_obsidian", "minecraft:story/mine_diamond", "minecraft:story/enter_the_nether", "minecraft:story/shiny_gear", "minecraft:story/enchant_item", "minecraft:story/cure_zombie_villager", "minecraft:story/follow_ender_eye", "minecraft:story/enter_the_end",
          "minecraft:nether/root", "minecraft:nether/return_to_sender", "minecraft:nether/find_fortress", "minecraft:nether/get_wither_skull", "minecraft:nether/obtain_blaze_rod", "minecraft:nether/brew_potion", "minecraft:nether/create_beacon", "minecraft:nether/create_full_beacon", "minecraft:nether/summon_wither", "minecraft:nether/uneasy_alliance",
          "minecraft:end/root", "minecraft:end/kill_dragon", "minecraft:end/enter_end_gateway", "minecraft:end/find_end_city", "minecraft:end/elytra", "minecraft:end/levitate", "minecraft:end/dragon_breath", "minecraft:end/dragon_egg",
          "minecraft:adventure/root", "minecraft:adventure/kill_a_mob", "minecraft:adventure/shoot_arrow", "minecraft:adventure/sniper_duel", "minecraft:adventure/totem_of_undying", "minecraft:adventure/summon_iron_golem", "minecraft:adventure/trade", "minecraft:adventure/kill_all_mobs", "minecraft:adventure/adventuring_time",
          "minecraft:husbandry/root", "minecraft:husbandry/breed_an_animal", "minecraft:husbandry/tame_an_animal", "minecraft:husbandry/plant_seed", "minecraft:husbandry/bred_all_animals", "minecraft:husbandry/balanced_diet",
          "minecraft:husbandry/fishy_business", "minecraft:husbandry/tactical_fishing", "minecraft:adventure/throwaway_joke", "minecraft:adventure/very_very_frightening", "minecraft:adventure/sleep_with_the_fishes",
          "minecraft:adventure/voluntary_exile", "minecraft:adventure/hero_of_the_village", "minecraft:adventure/two_birds_one_arrow", "minecraft:adventure/arbalistic", "minecraft:adventure/whos_the_pillager_now", "minecraft:adventure/ol_betsy", "minecraft:husbandry/complete_catalogue",
          "minecraft:husbandry/safely_harvest_honey", "minecraft:adventure/honey_block_slide", "minecraft:husbandry/silk_touch_nest",
          "minecraft:nether/find_bastion", "minecraft:nether/obtain_crying_obsidian", "minecraft:nether/distract_piglin", "minecraft:nether/ride_strider", "minecraft:nether/loot_bastion", "minecraft:nether/explore_nether", "minecraft:nether/obtain_ancient_debris", "minecraft:nether/use_lodestone", "minecraft:nether/charge_respawn_anchor", "minecraft:nether/netherite_armor",
          "minecraft:husbandry/wax_on", "minecraft:husbandry/wax_off", "minecraft:husbandry/axolotl_in_a_bucket", "minecraft:husbandry/kill_axolotl_target", "minecraft:husbandry/make_a_sign_glow", "minecraft:adventure/light_as_a_rabbit", "minecraft:adventure/lightning_rod_with_villager_no_fire", "minecraft:adventure/fall_from_world_height", "minecraft:adventure/spyglass_at_parrot", 
          // 1.18
          "minecraft:adventure/trade_at_world_height", "minecraft:adventure/play_jukebox_in_meadows", "minecraft:nether/ride_strider_in_overworld_lava",
          // 1.19
          "minecraft:husbandry/froglights", "minecraft:husbandry/leash_all_frog_variants", "minecraft:adventure/kill_mob_near_sculk_catalyst", "minecraft:adventure/avoid_vibration", "minecraft:husbandry/allay_deliver_cake_to_note_block", "minecraft:husbandry/allay_deliver_item_to_player",
          // 1.20
          "minecraft:husbandry/obtain_sniffer_egg", "minecraft:husbandry/feed_snifflet", "minecraft:husbandry/plant_any_sniffer_seed", "minecraft:adventure/salvage_sherd", "minecraft:adventure/craft_decorated_pot_using_only_sherds", "minecraft:adventure/trim_with_any_armor_pattern", "minecraft:adventure/trim_with_all_exclusive_armor_patterns", "minecraft:adventure/read_power_of_chiseled_bookshelf",
          // 1.21
          "minecraft:adventure/minecraft_trials_edition", "minecraft:adventure/under_lock_and_key", "minecraft:adventure/who_needs_rockets", "minecraft:adventure/crafters_crafting_crafters", "minecraft:adventure/lighten_up", "minecraft:adventure/overoverkill", "minecraft:adventure/revaulting", "minecraft:adventure/blowback",
          // Future placeholders
          "minecraft:adventure/stay_hydrated", "minecraft:adventure/heart_transplanter", "minecraft:adventure/mob_kabob", "minecraft:adventure/uh_oh"
      ];

      const allToDisplay = new Set([...legacyAchievementsList, ...modernAdvancementsList]);
      earnedSet.forEach(a => {
          if (betaAchievementMap[a]) {
              allToDisplay.add(betaAchievementMap[a]);
              earnedSet.add(betaAchievementMap[a]);
          } else {
              allToDisplay.add(a);
          }
      });

      const versionOrder = ["Beta 1.5", "Release 1.0", "Release 1.4", "Release 1.7", "Release 1.12", "Release 1.13", "Release 1.14", "Release 1.15", "Release 1.16", "Release 1.17", "Release 1.18", "Release 1.19", "Release 1.20", "Release 1.21", "Release 1.21.6", "Release 1.21.11", "Release 26.2", "Release 1.12+", "Unknown"];
      const grouped = {};
      versionOrder.forEach(v => grouped[v] = []);

      Array.from(allToDisplay).forEach(achKey => {
          if (betaAchievementMap[achKey]) return; // Skip numeric IDs

          let name = achKey;
          let icon = "🏆";
          let version = "Unknown";
          
          if (achievementNames[achKey]) {
              name = achievementNames[achKey].name;
              icon = achievementNames[achKey].icon;
              version = achievementNames[achKey].version || "Unknown";
          } else {
              name = achKey.replace('achievement.', '').replace('minecraft:', '');
              name = name.replace(/_/g, ' ').replace(/\//g, ' > ');
              if (achKey.startsWith('minecraft:') || achKey.includes('/')) {
                  version = "Release 1.12+";
                  icon = "📜";
              }
          }

          if (!grouped[version]) grouped[version] = [];
          const isEarned = earnedSet.has(achKey);
          grouped[version].push({ achKey, name, icon, isEarned });
      });

      versionOrder.forEach(version => {
          if (grouped[version] && grouped[version].length > 0) {
              const header = document.createElement('h3');
              header.innerText = version;
              header.style.width = '100%';
              header.style.textAlign = 'left';
              header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
              header.style.paddingBottom = '5px';
              header.style.marginTop = '20px';
              header.style.marginBottom = '10px';
              header.style.color = 'var(--text-secondary)';
              header.style.fontSize = '1.2rem';
              achievementsListDiv.appendChild(header);
              
              const groupContainer = document.createElement('div');
              groupContainer.style.display = 'flex';
              groupContainer.style.flexWrap = 'wrap';
              groupContainer.style.gap = '10px';
              groupContainer.style.width = '100%';
              
              grouped[version].forEach(item => {
                  const div = document.createElement('div');
                  div.className = 'achievement-card';
                  div.style.padding = '10px 15px';
                  div.style.background = item.isEarned ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                  div.style.color = item.isEarned ? '#10b981' : '#9ca3af';
                  div.style.borderRadius = '8px';
                  div.style.display = 'inline-flex';
                  div.style.alignItems = 'center';
                  div.style.gap = '8px';
                  div.style.border = item.isEarned ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)';
                  
                  div.innerHTML = `<span style="font-size: 1.2rem;">${item.icon}</span> <span>${item.name}</span>`;
                  
                  groupContainer.appendChild(div);
              });
              
              achievementsListDiv.appendChild(groupContainer);
          }
      });
  }
});

ipcRenderer.on('goal-reached', (event, { oldVersion, newVersion }) => {
  alert(`Congratulations! You reached the goal for ${oldVersion.id}! Welcome to ${newVersion.id}!`);
  currentVersion = newVersion.id;
  document.getElementById('current-version').innerText = currentVersion;
  document.getElementById('progress-text').innerText = `0 / ${newVersion.targetAchievements} Achievements`;
  document.getElementById('achievement-progress').max = newVersion.targetAchievements;
  document.getElementById('achievement-progress').value = 0;
  
  const advanceBtn = document.getElementById('advance-btn');
  if (advanceBtn) advanceBtn.classList.add('hidden');
});

ipcRenderer.on('goal-ready', (event, { currentVersion, nextVersion }) => {
  const advanceBtn = document.getElementById('advance-btn');
  if (advanceBtn) {
      advanceBtn.classList.remove('hidden');
      document.getElementById('status-msg').innerText = `Goal reached! Click Advance Era when you are ready to move to ${nextVersion.id}.`;
  }
});

ipcRenderer.on('launch-error', (event, errorMsg) => {
  statusMsg.innerText = `Error: ${errorMsg}`;
  statusMsg.style.color = '#ef4444'; // Red color for error
  launchBtn.disabled = false;
  launchBtn.innerText = 'Play';
});

ipcRenderer.on('launch-debug', (event, msg) => {
  console.log("Launcher Debug:", msg);
});

ipcRenderer.on('launch-data', (event, msg) => {
  console.log("Launcher Data:", msg);
  if (msg.includes('Error') || msg.includes('Exception')) {
    statusMsg.innerText = `Game Error: Check Developer Tools console.`;
    statusMsg.style.color = '#ef4444';
    launchBtn.disabled = false;
    launchBtn.innerText = 'Play';
  }
});
const profileSection = document.getElementById('profile-section');
const profileList = document.getElementById('profile-list');
const createProfileBtn = document.getElementById('create-profile-btn');
const newProfileNameInput = document.getElementById('new-profile-name');

function renderProfiles(profiles) {
    profileList.innerHTML = '';
    for (const p of profiles) {
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.style.margin = '5px';
        btn.innerText = p.name;
        btn.onclick = async () => {
            ipcRenderer.send('select-profile', p.id);
            profileSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            
            const result = await ipcRenderer.invoke('auto-login');
            if (result.success) {
                currentProfile = result.profile;
                usernameSpan.innerText = currentProfile.name;
                loginSection.classList.add('hidden');
                launcherSection.classList.remove('hidden');
                ipcRenderer.send('request-initial-progress', currentProfile.name);
            }
            ipcRenderer.send('get-whitelist');
        };
        profileList.appendChild(btn);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const profiles = await ipcRenderer.invoke('get-profiles');
    renderProfiles(profiles);
});

createProfileBtn.addEventListener('click', async () => {
    const name = newProfileNameInput.value.trim();
    if (name) {
        const updatedProfiles = await ipcRenderer.invoke('create-profile', name);
        renderProfiles(updatedProfiles);
        newProfileNameInput.value = '';
    }
});
// Tab Navigation
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.add('hidden'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    target.classList.remove('hidden');
    target.classList.add('active');
  });
});

// Whitelist Logic
const whitelistNameInput = document.getElementById('whitelist-name');
const addWhitelistBtn = document.getElementById('add-whitelist-btn');
const whitelistList = document.getElementById('whitelist-list');

addWhitelistBtn.addEventListener('click', () => {
  const name = whitelistNameInput.value.trim();
  if (name) {
    ipcRenderer.send('add-whitelist', name);
    whitelistNameInput.value = '';
  }
});

ipcRenderer.on('whitelist-data', (event, users) => {
  whitelistList.innerHTML = '';
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'whitelist-item';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.margin = '5px 0';
    div.style.padding = '5px';
    div.style.background = '#2a2a2a';
    div.style.borderRadius = '4px';

    const img = document.createElement('img');
    // We can use Minotar to fetch the 3D head or 2D face.
    // If uuid is available, use it. If not, use name.
    const identifier = user.uuid || user.name;
    img.src = `https://minotar.net/helm/${identifier}/32.png`;
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.marginRight = '10px';
    img.style.borderRadius = '4px';

    const span = document.createElement('span');
    span.innerText = user.name;
    span.style.flexGrow = '1';

    const removeBtn = document.createElement('button');
    removeBtn.innerText = 'Remove';
    removeBtn.className = 'secondary-btn';
    removeBtn.style.padding = '2px 8px';
    removeBtn.onclick = () => {
      ipcRenderer.send('remove-whitelist', user.name);
    };

    div.appendChild(img);
    div.appendChild(span);
    div.appendChild(removeBtn);
    whitelistList.appendChild(div);
  });
});

// Settings Logic
const ramMinInput = document.getElementById('setting-ram-min');
const ramMaxInput = document.getElementById('setting-ram-max');
const betacraftCheck = document.getElementById('setting-betacraft');
const java8Input = document.getElementById('setting-java8');
const java17Input = document.getElementById('setting-java17');
const java21Input = document.getElementById('setting-java21');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsMsg = document.getElementById('settings-msg');
const themeSelect = document.getElementById('setting-theme');
const accentSelect = document.getElementById('setting-accent');

function applyTheme(theme, accent) {
    document.body.className = '';
    if (theme === 'light') document.body.classList.add('theme-light');
    if (accent && accent !== 'emerald') document.body.classList.add(`accent-${accent}`);
}

themeSelect.addEventListener('change', () => applyTheme(themeSelect.value, accentSelect.value));
accentSelect.addEventListener('change', () => applyTheme(themeSelect.value, accentSelect.value));

ipcRenderer.invoke('get-settings').then(settings => {
    if (settings) {
        if (settings.theme) { themeSelect.value = settings.theme; }
        if (settings.accent) { accentSelect.value = settings.accent; }
        applyTheme(settings.theme, settings.accent);
        
        if (settings.ramMin) ramMinInput.value = settings.ramMin;
        if (settings.ramMax) ramMaxInput.value = settings.ramMax;
        if (settings.betacraft !== undefined) betacraftCheck.checked = settings.betacraft;
        if (settings.java8) java8Input.value = settings.java8;
        if (settings.java17) java17Input.value = settings.java17;
        if (settings.java21) java21Input.value = settings.java21;
    }
});

saveSettingsBtn.addEventListener('click', () => {
    ipcRenderer.send('save-settings', {
        theme: themeSelect.value,
        accent: accentSelect.value,
        ramMin: ramMinInput.value,
        ramMax: ramMaxInput.value,
        betacraft: betacraftCheck.checked,
        java8: java8Input.value,
        java17: java17Input.value,
        java21: java21Input.value
    });
    settingsMsg.innerText = "Saved!";
    setTimeout(() => settingsMsg.innerText = "", 3000);
});

// Roadmap Editor Logic
let roadmapData = [];
let defaultRoadmap = [];
ipcRenderer.invoke('get-default-roadmap').then(data => {
  if (data) defaultRoadmap = data;
});
const roadmapList = document.getElementById('roadmap-list');

window.deleteRoadmapItem = function(index) {
  roadmapData.splice(index, 1);
  renderRoadmap();
};

window.updateRoadmapItem = function(index, field, val) {
  roadmapData[index][field] = val;
};

window.updateRoadmapSelection = function(index, id) {
  const def = defaultRoadmap.find(d => d.id === id);
  if (def) {
    roadmapData[index].id = def.id;
    roadmapData[index].targetAchievements = def.targetAchievements;
    roadmapData[index].serverUrl = def.serverUrl;
  } else {
    roadmapData[index].id = id;
  }
  renderRoadmap();
};

function renderRoadmap() {
  roadmapList.innerHTML = '';
  roadmapData.forEach((item, index) => {
    const div = document.createElement('div');
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '1fr 100px auto';
    div.style.gap = '10px';
    div.style.background = 'var(--bg-tertiary)';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.alignItems = 'center';
    
    let optionsHtml = '<option value="">Select Version...</option>';
    defaultRoadmap.forEach(defItem => {
       optionsHtml += `<option value="${defItem.id}" ${defItem.id === item.id ? 'selected' : ''}>${defItem.id}</option>`;
    });
    
    div.innerHTML = `
      <select onchange="updateRoadmapSelection(${index}, this.value)" style="width: 100%; background: var(--bg-secondary); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 5px; border-radius: 4px; outline: none; font-size: 14px; box-sizing: border-box;">
        ${optionsHtml}
      </select>
      <input type="number" value="${item.targetAchievements}" placeholder="Target Achvs" onchange="updateRoadmapItem(${index}, 'targetAchievements', parseInt(this.value))" style="width: 100%; box-sizing: border-box;">
      <button onclick="deleteRoadmapItem(${index})" class="secondary-btn" style="background: #ef4444; color: white; border: none; padding: 5px 15px;">X</button>
    `;
    roadmapList.appendChild(div);
  });
}

document.getElementById('add-roadmap-btn').addEventListener('click', () => {
  roadmapData.push({ id: '', targetAchievements: 0, serverUrl: '' });
  renderRoadmap();
});

document.getElementById('save-roadmap-btn').addEventListener('click', async () => {
  await ipcRenderer.invoke('save-roadmap', roadmapData);
  alert('Roadmap saved! Restart the server or launcher to apply changes.');
});

ipcRenderer.invoke('get-roadmap').then(data => {
  if (data) {
    roadmapData = JSON.parse(JSON.stringify(data));
    renderRoadmap();
  }
});

// Dashboard Logic
let livePlayers = new Set();
const playerList = document.getElementById('dash-player-list');
const playerCount = document.getElementById('dash-player-count');

function updatePlayerList() {
  playerCount.innerText = livePlayers.size;
  playerList.innerHTML = '';
  livePlayers.forEach(p => {
    const li = document.createElement('li');
    li.innerText = p;
    playerList.appendChild(li);
  });
}

ipcRenderer.on('server-log', (e, log) => {
  // We already appended the log in the first listener, here we just parse it for the dashboard
  const joinedMatch = log.match(/\[\d+:\d+:\d+\] \[Server thread\/INFO\]: (\w+) joined the game/);
  const loggedInMatch = log.match(/\[\d+:\d+:\d+\] \[Server thread\/INFO\]: (\w+)\[\/.*\] logged in/);
  const leftMatch = log.match(/\[\d+:\d+:\d+\] \[Server thread\/INFO\]: (\w+) left the game/);
  const lostMatch = log.match(/\[\d+:\d+:\d+\] \[Server thread\/INFO\]: (\w+) lost connection:/);

  let updated = false;
  
  if (joinedMatch) { livePlayers.add(joinedMatch[1]); updated = true; }
  else if (loggedInMatch) { livePlayers.add(loggedInMatch[1]); updated = true; }
  else if (leftMatch) { livePlayers.delete(leftMatch[1]); updated = true; }
  else if (lostMatch) { livePlayers.delete(lostMatch[1]); updated = true; }
  
  if (updated) updatePlayerList();
});

ipcRenderer.on('server-stopped', () => {
  document.getElementById('dash-status').innerText = 'Offline';
  document.getElementById('dash-cpu').innerText = '0.0%';
  document.getElementById('dash-ram').innerText = '0 MB';
  livePlayers.clear();
  updatePlayerList();
});

ipcRenderer.on('server-stats', (e, stats) => {
  document.getElementById('dash-status').innerText = 'Online';
  document.getElementById('dash-status').style.color = '#10b981';
  document.getElementById('dash-cpu').innerText = (stats.cpu).toFixed(1) + '%';
  document.getElementById('dash-ram').innerText = (stats.memory / 1024 / 1024).toFixed(0) + ' MB';
  if (stats.ip) {
    document.getElementById('dash-ip').innerText = stats.ip + ':25565';
  }
});

document.getElementById('dash-console-btn').addEventListener('click', () => {
  const input = document.getElementById('dash-console-input');
  if (input.value) {
    ipcRenderer.send('server-command', input.value);
    input.value = '';
  }
});

document.getElementById('dash-console-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('dash-console-btn').click();
  }
});

// Playtime UI Update
ipcRenderer.on('playtime-update', (event, totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  document.getElementById('playtime-text').innerText = `${hours}h ${minutes}m`;
});

// Request playtime on load/login
ipcRenderer.on('init-data', () => {
  ipcRenderer.send('request-playtime');
});

// Resource Packs Logic
const importRpBtn = document.getElementById('import-rp-btn');
const importRpInput = document.getElementById('import-rp-input');
const rpList = document.getElementById('rp-list');

importRpBtn.addEventListener('click', () => {
  importRpInput.click();
});

importRpInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    const filePath = e.target.files[0].path;
    const result = await ipcRenderer.invoke('import-resourcepack', {
      version: currentVersion,
      filePath: filePath
    });
    if (result.success) {
      loadResourcePacks();
    } else {
      alert("Failed to import resource pack: " + result.error);
    }
  }
  // reset input
  importRpInput.value = '';
});

async function loadResourcePacks() {
  if (!currentVersion) return;
  const packs = await ipcRenderer.invoke('list-resourcepacks', currentVersion);
  rpList.innerHTML = '';
  
  if (packs.length === 0) {
    rpList.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No resource packs imported for this era.</p>';
    return;
  }

  packs.forEach(pack => {
    const div = document.createElement('div');
    div.style.background = 'var(--bg-tertiary)';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.style.border = '1px solid rgba(255,255,255,0.1)';

    const nameSpan = document.createElement('span');
    nameSpan.innerText = pack.name;

    div.appendChild(nameSpan);
    rpList.appendChild(div);
  });
}

// Load packs when clicking the tab or switching versions
tabBtns.forEach(btn => {
  if (btn.dataset.target === 'tab-resourcepacks') {
    btn.addEventListener('click', loadResourcePacks);
  }
  if (btn.dataset.target === 'tab-news') {
    btn.addEventListener('click', loadNews);
  }
  if (btn.dataset.target === 'tab-screenshots') {
    btn.addEventListener('click', loadScreenshots);
  }
});

// News Logic
async function loadNews() {
  const newsContainer = document.getElementById('news-list');
  const newsItems = await ipcRenderer.invoke('get-news');
  
  newsContainer.innerHTML = '';
  
  if (!newsItems || newsItems.length === 0) {
    newsContainer.innerHTML = '<p style="color: var(--text-secondary);">No news available at this time.</p>';
    return;
  }
  
  newsItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `
      <h3>${item.title}</h3>
      <div class="date">${item.date}</div>
      <p style="margin: 0; font-size: 0.95rem; line-height: 1.4;">${item.body}</p>
    `;
    newsContainer.appendChild(card);
  });
}

// Screenshots Logic
const refreshScreenshotsBtn = document.getElementById('refresh-screenshots-btn');
if (refreshScreenshotsBtn) refreshScreenshotsBtn.addEventListener('click', loadScreenshots);

async function loadScreenshots() {
  const screenshotsList = document.getElementById('screenshots-list');
  const paths = await ipcRenderer.invoke('get-screenshots', currentVersion);
  
  screenshotsList.innerHTML = '';
  
  if (!paths || paths.length === 0) {
    screenshotsList.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1 / -1;">No screenshots found for this era.</p>';
    return;
  }
  
  paths.forEach(p => {
    const card = document.createElement('div');
    card.className = 'screenshot-card';
    
    // Use file:// protocol for local files in Electron
    const fileUrl = 'file:///' + p.replace(/\\/g, '/');
    
    const img = document.createElement('img');
    img.src = fileUrl;
    img.loading = 'lazy';
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '×';
    delBtn.title = 'Delete screenshot';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this screenshot?')) {
        ipcRenderer.send('delete-screenshot', p);
        card.remove();
      }
    };
    
    // Optional: click to expand/open
    card.onclick = () => {
      require('electron').shell.openPath(p);
    };
    card.style.cursor = 'pointer';
    
    card.appendChild(img);
    card.appendChild(delBtn);
    screenshotsList.appendChild(card);
  });
}

// Initial load for active tab if it's news
document.addEventListener('DOMContentLoaded', () => {
  loadNews(); // Always load news on start so it's ready
});

// Multiplayer Stats Sync Logic
const hostSyncStartBtn = document.getElementById('host-sync-start-btn');
const hostSyncStopBtn = document.getElementById('host-sync-stop-btn');
const clientSyncBtn = document.getElementById('client-sync-btn');
const syncHostIpInput = document.getElementById('sync-host-ip');
const syncStatusMsg = document.getElementById('sync-status-msg');

if (hostSyncStartBtn) {
  hostSyncStartBtn.addEventListener('click', async () => {
    syncStatusMsg.style.color = 'var(--text-primary)';
    syncStatusMsg.innerText = 'Starting server...';
    hostSyncStartBtn.disabled = true;
    
    const res = await ipcRenderer.invoke('start-stats-server');
    if (res.success) {
      hostSyncStartBtn.classList.add('hidden');
      hostSyncStopBtn.classList.remove('hidden');
      syncStatusMsg.style.color = '#10b981';
      syncStatusMsg.innerText = 'Server listening on port 25566.';
      if (res.warning) {
        syncStatusMsg.style.color = '#f59e0b';
        syncStatusMsg.innerText += ' ' + res.warning;
      }
    } else {
      syncStatusMsg.style.color = '#ef4444';
      syncStatusMsg.innerText = 'Failed: ' + res.error;
    }
    hostSyncStartBtn.disabled = false;
  });
}

if (hostSyncStopBtn) {
  hostSyncStopBtn.addEventListener('click', async () => {
    const res = await ipcRenderer.invoke('stop-stats-server');
    if (res.success) {
      hostSyncStopBtn.classList.add('hidden');
      hostSyncStartBtn.classList.remove('hidden');
      syncStatusMsg.innerText = 'Server stopped.';
      syncStatusMsg.style.color = 'var(--text-secondary)';
    }
  });
}

if (clientSyncBtn) {
  clientSyncBtn.addEventListener('click', async () => {
    const ip = syncHostIpInput.value.trim();
    if (!ip) {
      alert("Please enter the Host's IP address.");
      return;
    }
    
    syncStatusMsg.style.color = 'var(--text-primary)';
    syncStatusMsg.innerText = 'Sending stats...';
    clientSyncBtn.disabled = true;
    
    const res = await ipcRenderer.invoke('send-stats-to-host', ip);
    
    if (res.success) {
      syncStatusMsg.style.color = '#10b981';
      syncStatusMsg.innerText = 'Stats sent successfully!';
      alert("Success! Your stats have been synced to the host.");
    } else {
      syncStatusMsg.style.color = '#ef4444';
      syncStatusMsg.innerText = 'Failed: ' + res.error;
      alert("Failed to sync stats: " + res.error);
    }
    
    clientSyncBtn.disabled = false;
  });
}

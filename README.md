<p align="center">
  <img src="docs/logo.png" width="120" alt="Taiga Launcher">
</p>

<h1 align="center">Taiga Launcher</h1>

<p align="center">
  <b>Your emulator, PC and other-store games inside Steam, as if they were real Steam games.</b><br>
  Covers, a complete game page, achievements with the native Steam popup and playtime. No plugins, no setup.
</p>

<h2 align="center">
  <a href="https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest">Download</a>
</h2>

<p align="center">
  <b>English</b> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a>
</p>

> [!WARNING]
> **Early version:** the program may still have many bugs. Please report them when you can, through **Report a problem** in the app or in [Issues](https://github.com/GabrielTaiga/Taiga-Launcher/issues).


---

## 🔥 Highlights

| | |
|---|---|
| 🎮 **Everything in one library** | PSP, PS2, PS3, Switch, retro consoles, Epic, GOG, Xbox, EA, Ubisoft, Riot, loose PC games and console ports, all inside Steam. |
| 📄 **A real Steam game page** | Description, news, achievements, playtime and game info, instead of an empty shortcut. |
| 🏆 **Achievements with the Steam popup** | Unlock an achievement in an emulator or another store and Steam shows its own notification, with sound. |
| 🔎 **Finds and identifies by itself** | Scans your drives, recognizes each game by its content and links it to the right Steam game. |
| 🖼️ **Artwork with no API keys** | Cover, background, logo and icon are downloaded automatically. Missing artwork is retried until it shows up. |
| 🌎 **5 languages** | English, Português, Español, Français and Deutsch, including game descriptions and achievement names. |

---

## 📸 Screenshots

### A non-Steam game page without the program running
<img src="https://i.imgur.com/fWZLBqc.png" alt="A non-Steam game page without the program running">

### Emulator and other-store games inside Steam
<img src="https://i.imgur.com/rvg56nz.png" alt="Emulator and other-store games inside Steam">

### Every achievement inside Steam
<img src="https://i.imgur.com/hVSNh4q.png" alt="Every achievement inside Steam">

### All the information, like a native game
<img src="https://i.imgur.com/i2xpgKc.png" alt="All the information, like a native game">

### Games count toward your Steam library total
<img src="https://i.imgur.com/ZT5MEqG.png" alt="Games count toward your Steam library total">

### Your games in your Steam collection
<img src="https://i.imgur.com/J45O3bz.png" alt="Your games in your Steam collection">

### See and edit all of a game's information
<img src="https://i.imgur.com/sCl5Pu1.png" alt="See and edit all of a game's information">

### Games from Epic, GOG, Xbox and other stores
<img src="https://i.imgur.com/B8UAbGW.png" alt="Games from Epic, GOG, Xbox and other stores">

### Games from many emulators
<img src="https://i.imgur.com/74aHDzy.png" alt="Games from many emulators">

### Connect your accounts to track achievements in Steam
<img src="https://i.imgur.com/x5WfOD1.png" alt="Connect your accounts to track achievements in Steam">

### Easy to use: games are found automatically
<img src="https://i.imgur.com/8vbQ3ed.png" alt="Easy to use: games are found automatically">

### Customize covers right in the app
<img src="https://i.imgur.com/cY4pZbQ.png" alt="Customize covers right in the app">

### See your emulators
<img src="https://i.imgur.com/U4HKCdE.png" alt="See your emulators">

---

## 🎮 What it does

### Finds your games
- ISOs and ROMs in your emulator folders.
- Installed games from **Epic, GOG, EA, Ubisoft, Battle.net, Rockstar, Xbox / Microsoft Store and Riot**.
- Loose PC games on any drive, including **console ports** (such as SpartanPort).
- Already-installed games are never added twice: the same game from two stores, or a port plus the console dump, becomes one entry.

### Identifies each game correctly
- By the file content: **Redump / No-Intro** databases, `PARAM.SFO`, ROM headers and the executable's product name.
- Links PC games to the right **Steam AppID** by evidence: files inside the game folder (`steam_appid.txt`, Steam emulator configs, Steam manifests) and databases that store the AppID (Wikidata, PCGamingWiki, IGDB, SteamGridDB). When sources disagree, it asks you instead of guessing.

### Puts them in Steam
- Each game becomes a Steam shortcut with **cover, background, logo, wide capsule and icon**, in a **"Taiga Launcher"** collection.
- With Steam open, games appear **instantly, without restarting Steam**.
- Each game gets a **complete Steam game page**: description, news, community content, game info, achievements and playtime (powered by a modified NativeGameLink for Steam).
- Games launch through Steam as usual, with the right emulator and settings.

### Achievements
| Games | Where they come from | What you need |
|---|---|---|
| Emulators (PSP, PS1, PS2, Nintendo, Sega, Atari...) | RetroAchievements | A free account. The one already used in the emulator is reused. |
| PS3 / PS Vita / PS4 in emulators | RPCS3, Vita3K and shadPS4 trophies | Nothing |
| Console ports for PC | The game's own trophy list + the port's unlock log | Nothing |
| Epic Games / GOG / Xbox | The store's own achievements | Sign in once |
| PC games that also exist on Steam | Official Steam list + progress saved on the PC | Nothing |

Every unlock shows the **native Steam achievement notification**, with sound.

### Playtime
- Counted by Taiga Launcher every time you play.
- Imported from **Epic, GOG Galaxy and Playnite**, so your history comes with you.

### Artwork with no keys
- Covers and artwork come from Taiga Launcher's own server (SteamGridDB and IGDB with a shared cache), the official Steam store, libretro and Wikipedia. **You don't need to create any API key.**
- Games without a cover are searched right after being added and retried automatically over the following days.
- Prefer your own picture? Pick any artwork from the gallery or from your PC.

### And also
- **Download emulators** from inside the app (PCSX2, RPCS3, Vita3K, Xenia, mGBA, BizHawk, ares and more).
- **Starts with Windows**, minimized to the tray, so Steam always shows the custom pages.
- **Updates itself** with one click.
- **Edit your other Steam games' artwork** from the Steam Library tab.
- **Store games you have not installed**: your Epic and Xbox games show up in Steam with an **Install** button. Epic games download with progress and Cancel right on the Steam page (through Legendary); Xbox games open in the Xbox app. Optional collections per store ("Epic Games", "Xbox").
- **Send to another PC**: creates a package with the program, without your games, accounts or logins.
- **Remove everything** from Steam with one button. Your games and saves are never touched.

---

## 🕹️ Recognized emulators

PPSSPP, PCSX2, DuckStation, ePSXe, RPCS3, Vita3K, shadPS4, Dolphin, Cemu, Ryujinx, yuzu and forks (Citron, Eden, Sudachi, suyu), Azahar (Citra, Lime3DS), melonDS, DeSmuME, mGBA, VBA-M, Project64, RMG, simple64, Snes9x, Mesen, Flycast, Redream, xemu, Xenia, MAME, DOSBox, RetroArch, BizHawk, ares, Mednafen, Stella and Kega Fusion.

---

## 📥 Install

**Linux (x86_64):** AppImage build and native/Flatpak Steam setup are documented in [Linux support](docs/LINUX.md). Real Steam integration on Linux still needs desktop validation.

1. Download the `.zip` from the **[latest release](https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest)**.
2. Extract the whole folder wherever you like (for example `C:\Games\Taiga Launcher`). Keep the `.exe` together with the other files.
3. Open **Taiga Launcher.exe**. A short setup asks for your language, your Steam account and where your games are.

**Requirements:** Windows 10 or 11 (64-bit) and Steam installed, with your account used at least once on this PC. An internet connection is needed for artwork, info and achievement lists; the games themselves run offline.

It's portable: no installer, no Millennium, no SFP, no Node.js.

> Windows may show "Windows protected your PC" because the program isn't digitally signed yet. Click **More info › Run anyway**.

---

## ❓ FAQ

**Does it change my games or my accounts?**
No. It only creates Steam shortcuts and reads progress files. In your accounts (Epic, GOG, Xbox, RetroAchievements) it only reads achievements. Logins are encrypted by Windows itself and only your user on this PC can read them.

**Does it give me Steam licenses, cards or real Steam achievements?**
No. Everything is shown locally in your Steam client. It doesn't change ownership, inventory or your public Steam profile.

**Why does Steam need to restart once?**
The game page and notifications enter Steam through its local debugging port. The first time, Steam is reopened with that option enabled; after that it's automatic.

**Where is my data?**
In `%LOCALAPPDATA%\Taiga Launcher`. You can move or replace the program folder without losing anything.

**The game page didn't show up in Steam.**
Use **Settings › Test integration**. It checks every part and tells you what to fix.

**I found a bug.**
Use **Report a problem** in the side menu, or open an [issue](https://github.com/GabrielTaiga/Taiga-Launcher/issues).

---

## 🗺️ Next updates, if the project gets support

- 👥 **Your Steam friends in Taiga Launcher:** see in Steam what your friends play outside it and compare achievements.
- 🎖️ **Your console trophies inside Steam:** PlayStation trophies and Xbox achievements in your Steam library.
- ✏️ **The Steam game page your way:** change achievements, add headers, sections and images, edit every detail.
- 💬 **Your game on Discord, like a Steam game:** the game you open shows on your Discord profile.
- 🧩 **Achievement editor:** create custom achievements for your games, even ones that have none.

---

## ☕ Support the project

Taiga Launcher is free. If it made your library better, you can help it keep growing:

<a href="https://ko-fi.com/gabrieltaiga"><img src="https://img.shields.io/badge/Support%20on%20Ko--fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white" alt="Support on Ko-fi"></a> <a href="https://github.com/sponsors/GabrielTaiga"><img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub"></a>

Starring the repository ⭐ also helps a lot.

---

## 💖 Credits

Created by **Taiga ([GabrielTaiga](https://github.com/GabrielTaiga))**.

- **NativeGameLink for Steam** by David Miranda (Davidjarod11, MIT): the base of the game page inside Steam.
- **Legendary** (legendary-gl, GPL-3.0): installs Epic games. Downloaded only when you install one, as a separate program.
- **Electron** and **Chromium**: the program's foundation.
- **QR Code Generator** by Kazuhiko Arase (MIT), **Manrope** and **Sora** fonts (SIL OFL).
- Data from **SteamGridDB, IGDB, RetroAchievements, libretro, Wikipedia / Wikidata, PCGamingWiki, Exophase** and the **Steam store**.
- **Thanks** to the projects that inspired parts of Taiga Launcher: [Millennium](https://github.com/SteamClientHomebrew/Millennium), [SFP](https://github.com/PhantomGamers/SFP), [BoilR](https://github.com/PhilipK/BoilR), [Playhub Metadata](https://github.com/LoZazaMastro/Playhub-Metadata), [Steam Achievement Notifier](https://github.com/SteamAchievementNotifier/SteamAchievementNotifier), and to those credited by NativeGameLink: [game-data-linker](https://github.com/retrotoolsdev-wq/game-data-linker), [SteamAchievementManager](https://github.com/gibbed/SteamAchievementManager), [Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) and [steam-non-steam-playtimes](https://github.com/k0d13/steam-non-steam-playtimes).

The full list is in [NOTICE](NOTICE) and [THIRD-PARTY-NOTICES](resources/app/THIRD-PARTY-NOTICES.md).

---

## 📄 License

**Apache License 2.0**: anyone can use, study, modify and distribute Taiga Launcher. **Giving credit is mandatory**: whoever distributes the program or a version based on it must keep the [NOTICE](NOTICE) file and visibly credit the original author, for example *"Based on Taiga Launcher, created by Taiga (GabrielTaiga)"*. Modified versions must say they were changed and can't present themselves as the official release.

Taiga Launcher is not affiliated with Valve, Sony, Microsoft, Epic Games, GOG, Nintendo, RetroAchievements or Exophase. All trademarks belong to their owners.

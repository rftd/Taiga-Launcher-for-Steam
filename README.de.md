<p align="center">
  <img src="docs/logo.png" width="120" alt="Taiga Launcher">
</p>

<h1 align="center">Taiga Launcher</h1>

<p align="center">
  <b>Deine Emulator-, PC- und Store-Spiele direkt in Steam, als wären es echte Steam-Spiele.</b><br>
  Cover, vollständige Spielseite, Erfolge mit der nativen Steam-Benachrichtigung und Spielzeit. Ohne Plugins, ohne Einrichtung.
</p>

<h2 align="center">
  <a href="https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest">Herunterladen</a>
</h2>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>Deutsch</b>
</p>

> [!WARNING]
> **Frühe Version:** Das Programm kann noch viele Fehler enthalten. Melde Fehler, wenn du kannst, über **Problem melden** im Programm oder unter [Issues](https://github.com/GabrielTaiga/Taiga-Launcher/issues).


---

## 🔥 Highlights

| | |
|---|---|
| 🎮 **Alles in einer Bibliothek** | PSP, PS2, PS3, Switch, Retro-Konsolen, Epic, GOG, Xbox, EA, Ubisoft, Riot, einzelne PC-Spiele und Konsolen-Ports, alles in Steam. |
| 📄 **Eine echte Steam-Spielseite** | Beschreibung, Neuigkeiten, Erfolge, Spielzeit und Infos statt einer leeren Verknüpfung. |
| 🏆 **Erfolge mit dem Steam-Hinweis** | Erfolg im Emulator oder in einem anderen Store freigeschaltet? Steam zeigt die eigene Benachrichtigung, mit Ton. |
| 🔎 **Findet und erkennt alles selbst** | Durchsucht deine Laufwerke, erkennt jedes Spiel am Inhalt und verknüpft es mit dem richtigen Steam-Spiel. |
| 🖼️ **Grafiken ohne API-Schlüssel** | Cover, Hintergrund, Logo und Symbol werden automatisch geladen. Fehlendes wird erneut gesucht, bis es da ist. |
| 🌎 **5 Sprachen** | Deutsch, English, Português, Español und Français, einschließlich Spielbeschreibungen und Erfolgsnamen. |

---

## 📸 Screenshots

### Seite eines Nicht-Steam-Spiels ohne aktives Programm
<img src="https://i.imgur.com/fWZLBqc.png" alt="Seite eines Nicht-Steam-Spiels ohne aktives Programm">

### Emulator- und Store-Spiele direkt in Steam
<img src="https://i.imgur.com/rvg56nz.png" alt="Emulator- und Store-Spiele direkt in Steam">

### Alle Erfolge in Steam
<img src="https://i.imgur.com/hVSNh4q.png" alt="Alle Erfolge in Steam">

### Alle Infos, wie bei einem nativen Spiel
<img src="https://i.imgur.com/i2xpgKc.png" alt="Alle Infos, wie bei einem nativen Spiel">

### Spiele zählen zur Gesamtzahl deiner Steam-Bibliothek
<img src="https://i.imgur.com/ZT5MEqG.png" alt="Spiele zählen zur Gesamtzahl deiner Steam-Bibliothek">

### Deine Spiele in deiner Steam-Sammlung
<img src="https://i.imgur.com/J45O3bz.png" alt="Deine Spiele in deiner Steam-Sammlung">

### Alle Spielinfos ansehen und bearbeiten
<img src="https://i.imgur.com/sCl5Pu1.png" alt="Alle Spielinfos ansehen und bearbeiten">

### Spiele von Epic, GOG, Xbox und anderen Stores
<img src="https://i.imgur.com/B8UAbGW.png" alt="Spiele von Epic, GOG, Xbox und anderen Stores">

### Spiele aus vielen Emulatoren
<img src="https://i.imgur.com/74aHDzy.png" alt="Spiele aus vielen Emulatoren">

### Verbinde deine Konten, um Erfolge in Steam zu erfassen
<img src="https://i.imgur.com/x5WfOD1.png" alt="Verbinde deine Konten, um Erfolge in Steam zu erfassen">

### Einfach zu bedienen: Spiele werden automatisch gefunden
<img src="https://i.imgur.com/8vbQ3ed.png" alt="Einfach zu bedienen: Spiele werden automatisch gefunden">

### Cover direkt im Programm anpassen
<img src="https://i.imgur.com/cY4pZbQ.png" alt="Cover direkt im Programm anpassen">

### Sieh dir deine Emulatoren an
<img src="https://i.imgur.com/U4HKCdE.png" alt="Sieh dir deine Emulatoren an">

---

## 🎮 Was es macht

### Findet deine Spiele
- ISOs und ROMs in den Ordnern deiner Emulatoren.
- Installierte Spiele von **Epic, GOG, EA, Ubisoft, Battle.net, Rockstar, Xbox / Microsoft Store und Riot**.
- Einzelne PC-Spiele auf jedem Laufwerk, auch **Konsolen-Ports** (wie SpartanPort).
- Keine Duplikate: dasselbe Spiel aus zwei Stores oder ein Port zusammen mit dem Konsolen-Dump wird zu einem Eintrag.

### Erkennt jedes Spiel richtig
- Am Dateiinhalt: **Redump / No-Intro**-Datenbanken, `PARAM.SFO`, ROM-Header und der im Programm gespeicherte Produktname.
- Verknüpft PC-Spiele anhand von Belegen mit der **richtigen Steam-AppID**: Dateien im Spielordner (`steam_appid.txt`, Konfigurationen von Steam-Emulatoren, Steam-Manifeste) und Datenbanken mit AppID (Wikidata, PCGamingWiki, IGDB, SteamGridDB). Wenn die Quellen sich widersprechen, fragt es dich, statt zu raten.

### Bringt sie in Steam
- Jedes Spiel wird zu einer Steam-Verknüpfung mit **Cover, Hintergrund, Logo, Querformat-Kapsel und Symbol**, in einer Sammlung **„Taiga Launcher“**.
- Bei geöffnetem Steam erscheinen die Spiele **sofort, ohne Steam neu zu starten**.
- Jedes Spiel bekommt eine **vollständige Steam-Spielseite**: Beschreibung, Neuigkeiten, Community-Inhalte, Infos, Erfolge und Spielzeit (basierend auf einem angepassten NativeGameLink for Steam).
- Die Spiele starten wie gewohnt über Steam, mit dem richtigen Emulator und den richtigen Einstellungen.

### Erfolge
| Spiele | Quelle | Was du brauchst |
|---|---|---|
| Emulatoren (PSP, PS1, PS2, Nintendo, Sega, Atari...) | RetroAchievements | Ein kostenloses Konto. Das bereits im Emulator genutzte wird übernommen. |
| PS3 / PS Vita / PS4 im Emulator | Trophäen aus RPCS3, Vita3K und shadPS4 | Nichts |
| Konsolen-Ports für den PC | Trophäenliste des Spiels + Protokoll des Ports | Nichts |
| Epic Games / GOG / Xbox | Die Erfolge des jeweiligen Stores | Einmal anmelden |
| PC-Spiele, die es auch auf Steam gibt | Offizielle Steam-Liste + auf dem PC gespeicherter Fortschritt | Nichts |

Jede Freischaltung erscheint mit der **nativen Steam-Erfolgsbenachrichtigung**, mit Ton.

### Spielzeit
- Wird von Taiga Launcher bei jeder Sitzung gezählt.
- Wird aus **Epic, GOG Galaxy und Playnite** importiert, damit dein Verlauf erhalten bleibt.

### Grafiken ohne Schlüssel
- Cover und Grafiken kommen vom eigenen Server von Taiga Launcher (SteamGridDB und IGDB mit gemeinsamem Cache), aus dem Steam-Shop, von libretro und Wikipedia. **Du musst keinen API-Schlüssel anlegen.**
- Spiele ohne Cover werden direkt nach dem Hinzufügen gesucht und in den folgenden Tagen automatisch erneut.
- Lieber ein anderes Bild? Wähle eine beliebige Grafik aus der Galerie oder von deinem PC.

### Außerdem
- **Emulatoren herunterladen** direkt im Programm (PCSX2, RPCS3, Vita3K, Xenia, mGBA, BizHawk, ares und mehr).
- **Startet mit Windows**, minimiert im Infobereich, damit Steam immer die angepassten Seiten zeigt.
- **Aktualisiert sich selbst** mit einem Klick.
- **Bearbeite die Grafiken deiner anderen Steam-Spiele** im Tab Steam-Bibliothek.
- **Nicht installierte Store-Spiele**: Deine Epic- und Xbox-Spiele erscheinen in Steam mit einer **Installieren**-Schaltfläche. Epic-Spiele werden mit Fortschritt und Abbrechen direkt auf der Steam-Seite geladen (über Legendary); Xbox-Spiele öffnen sich in der Xbox-App. Auf Wunsch eigene Sammlungen pro Store („Epic Games", „Xbox").
- **An anderen PC senden**: erstellt ein Paket mit dem Programm, ohne deine Spiele, Konten oder Anmeldungen.
- **Alles aus Steam entfernen** mit einem Klick. Deine Spiele und Spielstände werden nie angerührt.

---

## 🕹️ Unterstützte Emulatoren

PPSSPP, PCSX2, DuckStation, ePSXe, RPCS3, Vita3K, shadPS4, Dolphin, Cemu, Ryujinx, yuzu und Ableger (Citron, Eden, Sudachi, suyu), Azahar (Citra, Lime3DS), melonDS, DeSmuME, mGBA, VBA-M, Project64, RMG, simple64, Snes9x, Mesen, Flycast, Redream, xemu, Xenia, MAME, DOSBox, RetroArch, BizHawk, ares, Mednafen, Stella und Kega Fusion.

---

## 📥 Installation

1. Lade die `.zip` der **[neuesten Version](https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest)** herunter.
2. Entpacke den ganzen Ordner, wohin du willst (zum Beispiel `C:\Spiele\Taiga Launcher`). Lass die `.exe` bei den anderen Dateien.
3. Öffne **Taiga Launcher.exe**. Ein kurzer Assistent fragt nach Sprache, Steam-Konto und dem Ort deiner Spiele.

**Voraussetzungen:** Windows 10 oder 11 (64 Bit) und installiertes Steam, mit deinem Konto mindestens einmal auf diesem PC genutzt. Für Grafiken, Infos und Erfolgslisten wird Internet gebraucht; die Spiele selbst laufen offline.

Portabel: kein Installer, kein Millennium, kein SFP, kein Node.js.

> Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“, weil das Programm noch keine digitale Signatur hat. Klicke auf **Weitere Informationen › Trotzdem ausführen**.

---

## ❓ Häufige Fragen

**Verändert es meine Spiele oder Konten?**
Nein. Es erstellt nur Steam-Verknüpfungen und liest Fortschrittsdateien. In deinen Konten (Epic, GOG, Xbox, RetroAchievements) liest es nur die Erfolge. Anmeldungen werden von Windows selbst verschlüsselt und nur dein Benutzer auf diesem PC kann sie lesen.

**Bekomme ich Steam-Lizenzen, Sammelkarten oder echte Steam-Erfolge?**
Nein. Alles wird lokal in deinem Steam angezeigt. Besitz, Inventar und dein öffentliches Steam-Profil ändern sich nicht.

**Warum muss Steam einmal neu starten?**
Spielseite und Benachrichtigungen gelangen über den lokalen Debug-Port in Steam. Beim ersten Mal wird Steam mit dieser Option neu geöffnet; danach geht es automatisch.

**Wo liegen meine Daten?**
In `%LOCALAPPDATA%\Taiga Launcher`. Du kannst den Programmordner verschieben oder ersetzen, ohne etwas zu verlieren.

**Die Spielseite ist in Steam nicht aufgetaucht.**
Nutze **Einstellungen › Integration testen**. Es prüft jeden Teil und sagt dir, was zu tun ist.

**Ich habe einen Fehler gefunden.**
Nutze **Problem melden** im Seitenmenü oder eröffne ein [Issue](https://github.com/GabrielTaiga/Taiga-Launcher/issues).

---

## 🗺️ Nächste Updates, wenn das Projekt unterstützt wird

- 👥 **Deine Steam-Freunde in Taiga Launcher:** sieh in Steam, was deine Freunde außerhalb spielen, und vergleiche Erfolge.
- 🎖️ **Deine Konsolen-Trophäen in Steam:** PlayStation-Trophäen und Xbox-Erfolge in deiner Steam-Bibliothek.
- ✏️ **Die Steam-Spielseite nach deinem Geschmack:** Erfolge ändern, Überschriften, Abschnitte und Bilder hinzufügen, jedes Detail bearbeiten.
- 💬 **Dein Spiel auf Discord, wie ein Steam-Spiel:** das Spiel, das du startest, erscheint in deinem Discord-Profil.
- 🧩 **Erfolgs-Editor:** eigene Erfolge für deine Spiele erstellen, auch für Spiele ohne Erfolge.

---

## ☕ Projekt unterstützen

Taiga Launcher ist kostenlos. Wenn es deine Bibliothek besser gemacht hat, kannst du helfen, dass es weiter wächst:

<a href="https://ko-fi.com/gabrieltaiga"><img src="https://img.shields.io/badge/Auf%20Ko--fi%20unterst%C3%BCtzen-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white" alt="Auf Ko-fi unterstützen"></a> <a href="https://github.com/sponsors/GabrielTaiga"><img src="https://img.shields.io/badge/Auf%20GitHub%20unterst%C3%BCtzen-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Auf GitHub unterstützen"></a>

Ein Stern ⭐ für das Repository hilft auch sehr.

---

## 💖 Danksagungen

Erstellt von **Taiga ([GabrielTaiga](https://github.com/GabrielTaiga))**.

- **NativeGameLink for Steam** von David Miranda (Davidjarod11, MIT): die Grundlage der Spielseite in Steam.
- **Legendary** (legendary-gl, GPL-3.0): installiert Epic-Spiele. Wird nur geladen, wenn du eines installierst, als separates Programm.
- **Electron** und **Chromium**: die Basis des Programms.
- **QR Code Generator** von Kazuhiko Arase (MIT) sowie die Schriften **Manrope** und **Sora** (SIL OFL).
- Daten von **SteamGridDB, IGDB, RetroAchievements, libretro, Wikipedia / Wikidata, PCGamingWiki, Exophase** und dem **Steam-Shop**.
- **Danke** an die Projekte, die Teile von Taiga Launcher inspiriert haben: [Millennium](https://github.com/SteamClientHomebrew/Millennium), [SFP](https://github.com/PhantomGamers/SFP), [BoilR](https://github.com/PhilipK/BoilR), [Playhub Metadata](https://github.com/LoZazaMastro/Playhub-Metadata), [Steam Achievement Notifier](https://github.com/SteamAchievementNotifier/SteamAchievementNotifier) sowie an die von NativeGameLink genannten: [game-data-linker](https://github.com/retrotoolsdev-wq/game-data-linker), [SteamAchievementManager](https://github.com/gibbed/SteamAchievementManager), [Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) und [steam-non-steam-playtimes](https://github.com/k0d13/steam-non-steam-playtimes).

Die vollständige Liste steht in [NOTICE](NOTICE) und [THIRD-PARTY-NOTICES](resources/app/THIRD-PARTY-NOTICES.md).

---

## 📄 Lizenz

**Apache License 2.0**: Jeder darf Taiga Launcher nutzen, untersuchen, verändern und weitergeben. **Die Nennung des Autors ist Pflicht**: Wer das Programm oder eine darauf basierende Version weitergibt, muss die Datei [NOTICE](NOTICE) behalten und den ursprünglichen Autor sichtbar nennen, zum Beispiel *„Basiert auf Taiga Launcher, erstellt von Taiga (GabrielTaiga)“*. Veränderte Versionen müssen das angeben und dürfen sich nicht als offizielle Version ausgeben.

Taiga Launcher ist nicht mit Valve, Sony, Microsoft, Epic Games, GOG, Nintendo, RetroAchievements oder Exophase verbunden. Alle Marken gehören ihren Inhabern.

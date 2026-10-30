<p align="center">
  <img src="docs/logo.png" width="120" alt="Taiga Launcher">
</p>

<h1 align="center">Taiga Launcher</h1>

<p align="center">
  <b>Vos jeux d'émulateur, PC et d'autres boutiques dans Steam, comme de vrais jeux Steam.</b><br>
  Jaquette, page de jeu complète, succès avec la notification native de Steam et temps de jeu. Sans plugin, sans configuration.
</p>

<h2 align="center">
  <a href="https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest">Télécharger</a>
</h2>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.es.md">Español</a> ·
  <b>Français</b> ·
  <a href="README.de.md">Deutsch</a>
</p>

> [!WARNING]
> **Version initiale :** le programme peut encore contenir de nombreux bugs. Signalez-les quand vous le pouvez, avec **Signaler un problème** dans le programme ou dans les [Issues](https://github.com/GabrielTaiga/Taiga-Launcher/issues).


---

## 🔥 Points forts

| | |
|---|---|
| 🎮 **Tout dans une seule bibliothèque** | PSP, PS2, PS3, Switch, consoles rétro, Epic, GOG, Xbox, EA, Ubisoft, Riot, jeux PC isolés et portages de console, le tout dans Steam. |
| 📄 **Une vraie page de jeu Steam** | Description, actualités, succès, temps de jeu et informations, au lieu d'un raccourci vide. |
| 🏆 **Succès avec la notification Steam** | Un succès débloqué dans un émulateur ou une autre boutique ? Steam affiche sa propre notification, avec le son. |
| 🔎 **Trouve et identifie tout seul** | Parcourt vos disques, reconnaît chaque jeu par son contenu et le relie au bon jeu Steam. |
| 🖼️ **Visuels sans clé d'API** | Jaquette, fond, logo et icône téléchargés automatiquement. Ce qui manque est recherché à nouveau jusqu'à ce qu'il apparaisse. |
| 🌎 **5 langues** | Français, English, Português, Español et Deutsch, y compris les descriptions des jeux et les noms des succès. |

---

## 📸 Captures d'écran

### Page d'un jeu hors Steam sans le programme activé
<img src="https://i.imgur.com/fWZLBqc.png" alt="Page d'un jeu hors Steam sans le programme activé">

### Jeux d'émulateur et d'autres boutiques dans Steam
<img src="https://i.imgur.com/rvg56nz.png" alt="Jeux d'émulateur et d'autres boutiques dans Steam">

### Tous les succès dans Steam
<img src="https://i.imgur.com/hVSNh4q.png" alt="Tous les succès dans Steam">

### Toutes les informations, comme un jeu natif
<img src="https://i.imgur.com/i2xpgKc.png" alt="Toutes les informations, comme un jeu natif">

### Les jeux comptent dans le total de votre bibliothèque Steam
<img src="https://i.imgur.com/ZT5MEqG.png" alt="Les jeux comptent dans le total de votre bibliothèque Steam">

### Vos jeux dans votre collection Steam
<img src="https://i.imgur.com/J45O3bz.png" alt="Vos jeux dans votre collection Steam">

### Consultez et modifiez toutes les informations du jeu
<img src="https://i.imgur.com/sCl5Pu1.png" alt="Consultez et modifiez toutes les informations du jeu">

### Jeux Epic, GOG, Xbox et d'autres boutiques
<img src="https://i.imgur.com/B8UAbGW.png" alt="Jeux Epic, GOG, Xbox et d'autres boutiques">

### Jeux de nombreux émulateurs
<img src="https://i.imgur.com/74aHDzy.png" alt="Jeux de nombreux émulateurs">

### Connectez vos comptes pour suivre les succès dans Steam
<img src="https://i.imgur.com/x5WfOD1.png" alt="Connectez vos comptes pour suivre les succès dans Steam">

### Simple à utiliser : les jeux sont trouvés automatiquement
<img src="https://i.imgur.com/8vbQ3ed.png" alt="Simple à utiliser : les jeux sont trouvés automatiquement">

### Personnalisez les jaquettes directement dans le programme
<img src="https://i.imgur.com/cY4pZbQ.png" alt="Personnalisez les jaquettes directement dans le programme">

### Voyez vos émulateurs
<img src="https://i.imgur.com/U4HKCdE.png" alt="Voyez vos émulateurs">

---

## 🎮 Ce qu'il fait

### Trouve vos jeux
- ISO et ROM dans les dossiers de vos émulateurs.
- Jeux installés depuis **Epic, GOG, EA, Ubisoft, Battle.net, Rockstar, Xbox / Microsoft Store et Riot**.
- Jeux PC isolés sur n'importe quel disque, y compris les **portages de console** (comme SpartanPort).
- Aucun doublon : le même jeu dans deux boutiques, ou un portage avec le dump de la console, ne forme qu'une seule entrée.

### Identifie chaque jeu correctement
- Par le contenu du fichier : bases **Redump / No-Intro**, `PARAM.SFO`, en-têtes des ROM et nom du produit inscrit dans l'exécutable.
- Relie les jeux PC au **bon AppID Steam** à partir de preuves : fichiers du dossier du jeu (`steam_appid.txt`, configurations d'émulateurs Steam, manifestes Steam) et bases qui stockent l'AppID (Wikidata, PCGamingWiki, IGDB, SteamGridDB). Si les sources ne sont pas d'accord, il vous demande au lieu de deviner.

### Les met dans Steam
- Chaque jeu devient un raccourci Steam avec **jaquette, fond, logo, capsule horizontale et icône**, dans une collection **« Taiga Launcher »**.
- Avec Steam ouvert, les jeux apparaissent **immédiatement, sans redémarrer Steam**.
- Chaque jeu reçoit une **page complète dans Steam** : description, actualités, contenu de la communauté, informations, succès et temps de jeu (basée sur NativeGameLink for Steam, modifié).
- Les jeux se lancent depuis Steam comme d'habitude, avec le bon émulateur et les bons réglages.

### Succès
| Jeux | Source | Ce qu'il faut |
|---|---|---|
| Émulateurs (PSP, PS1, PS2, Nintendo, Sega, Atari...) | RetroAchievements | Un compte gratuit. Celui déjà utilisé dans l'émulateur est réutilisé. |
| PS3 / PS Vita / PS4 sur émulateur | Trophées de RPCS3, Vita3K et shadPS4 | Rien |
| Portages de console sur PC | La liste de trophées du jeu + le journal du portage | Rien |
| Epic Games / GOG / Xbox | Les succès de la boutique | Se connecter une fois |
| Jeux PC qui existent aussi sur Steam | Liste officielle de Steam + progression enregistrée sur le PC | Rien |

Chaque déblocage s'affiche avec la **notification native des succès Steam**, avec le son.

### Temps de jeu
- Compté par Taiga Launcher à chaque partie.
- Importé depuis **Epic, GOG Galaxy et Playnite**, pour garder votre historique.

### Visuels sans clé
- Les jaquettes et visuels viennent du serveur de Taiga Launcher (SteamGridDB et IGDB avec un cache partagé), de la boutique Steam, de libretro et de Wikipédia. **Vous n'avez besoin de créer aucune clé d'API.**
- Les jeux sans jaquette sont recherchés juste après leur ajout, puis de nouveau, automatiquement, les jours suivants.
- Vous préférez une autre image ? Choisissez n'importe quel visuel de la galerie ou de votre PC.

### Et aussi
- **Téléchargez des émulateurs** depuis le programme (PCSX2, RPCS3, Vita3K, Xenia, mGBA, BizHawk, ares et d'autres).
- **Se lance avec Windows**, réduit dans la zone de notification, pour que Steam affiche toujours les pages personnalisées.
- **Se met à jour** en un clic.
- **Modifiez les visuels de vos autres jeux Steam** depuis l'onglet Bibliothèque Steam.
- **Jeux des boutiques non installés** : vos jeux Epic et Xbox apparaissent dans Steam avec un bouton **Installer**. Les jeux Epic se téléchargent avec progression et Annuler directement sur la page Steam (via Legendary) ; les jeux Xbox s'ouvrent dans l'app Xbox. Collections séparées par boutique (« Epic Games », « Xbox ») en option.
- **Envoyer vers un autre PC** : crée un paquet avec le programme, sans vos jeux, comptes ni identifiants.
- **Retirez tout** de Steam en un bouton. Vos jeux et sauvegardes ne sont jamais touchés.

---

## 🕹️ Émulateurs reconnus

PPSSPP, PCSX2, DuckStation, ePSXe, RPCS3, Vita3K, shadPS4, Dolphin, Cemu, Ryujinx, yuzu et dérivés (Citron, Eden, Sudachi, suyu), Azahar (Citra, Lime3DS), melonDS, DeSmuME, mGBA, VBA-M, Project64, RMG, simple64, Snes9x, Mesen, Flycast, Redream, xemu, Xenia, MAME, DOSBox, RetroArch, BizHawk, ares, Mednafen, Stella et Kega Fusion.

---

## 📥 Installation

1. Téléchargez le `.zip` de la **[dernière version](https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest)**.
2. Extrayez tout le dossier où vous voulez (par exemple `C:\Jeux\Taiga Launcher`). Gardez le `.exe` avec les autres fichiers.
3. Ouvrez **Taiga Launcher.exe**. Un court assistant demande la langue, le compte Steam et l'emplacement de vos jeux.

**Configuration requise :** Windows 10 ou 11 (64 bits) et Steam installé, avec votre compte déjà utilisé au moins une fois sur ce PC. Internet est nécessaire pour les visuels, les informations et les listes de succès ; les jeux eux-mêmes fonctionnent hors ligne.

C'est portable : pas d'installateur, pas de Millennium, pas de SFP, pas de Node.js.

> Windows peut afficher « Windows a protégé votre ordinateur » car le programme n'a pas encore de signature numérique. Cliquez sur **Informations complémentaires › Exécuter quand même**.

---

## ❓ Questions fréquentes

**Modifie-t-il mes jeux ou mes comptes ?**
Non. Il crée seulement des raccourcis Steam et lit des fichiers de progression. Dans vos comptes (Epic, GOG, Xbox, RetroAchievements), il lit uniquement les succès. Les identifiants sont chiffrés par Windows et seul votre utilisateur sur ce PC peut les lire.

**Est-ce que j'obtiens des licences, des cartes ou de vrais succès Steam ?**
Non. Tout est affiché localement dans votre Steam. Rien ne change pour la possession des jeux, l'inventaire ou votre profil Steam public.

**Pourquoi Steam doit-il redémarrer une fois ?**
La page du jeu et les notifications entrent dans Steam par son port de débogage local. La première fois, Steam est rouvert avec cette option activée ; ensuite, c'est automatique.

**Où sont mes données ?**
Dans `%LOCALAPPDATA%\Taiga Launcher`. Vous pouvez déplacer ou remplacer le dossier du programme sans rien perdre.

**La page du jeu n'est pas apparue dans Steam.**
Utilisez **Paramètres › Tester l'intégration**. Il vérifie chaque partie et indique quoi corriger.

**J'ai trouvé un bug.**
Utilisez **Signaler un problème** dans le menu latéral, ou ouvrez une [issue](https://github.com/GabrielTaiga/Taiga-Launcher/issues).

---

## 🗺️ Prochaines mises à jour, si le projet est soutenu

- 👥 **Vos amis Steam dans Taiga Launcher :** voyez dans Steam à quoi vos amis jouent en dehors et comparez les succès.
- 🎖️ **Vos trophées de console dans Steam :** trophées PlayStation et succès Xbox dans votre bibliothèque Steam.
- ✏️ **La page du jeu Steam à votre façon :** modifiez les succès, ajoutez des titres, des sections et des images, éditez chaque détail.
- 💬 **Votre jeu sur Discord, comme un jeu Steam :** le jeu que vous lancez apparaît sur votre profil Discord.
- 🧩 **Éditeur de succès :** créez des succès personnalisés pour vos jeux, même ceux qui n'en ont aucun.

---

## ☕ Soutenir le projet

Taiga Launcher est gratuit. S'il a amélioré votre bibliothèque, vous pouvez l'aider à grandir :

<a href="https://ko-fi.com/gabrieltaiga"><img src="https://img.shields.io/badge/Soutenir%20sur%20Ko--fi-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white" alt="Soutenir sur Ko-fi"></a> <a href="https://github.com/sponsors/GabrielTaiga"><img src="https://img.shields.io/badge/Soutenir%20sur%20GitHub-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Soutenir sur GitHub"></a>

Mettre une étoile ⭐ au dépôt aide aussi beaucoup.

---

## 💖 Crédits

Créé par **Taiga ([GabrielTaiga](https://github.com/GabrielTaiga))**.

- **NativeGameLink for Steam**, de David Miranda (Davidjarod11, MIT) : la base de la page du jeu dans Steam.
- **Legendary** (legendary-gl, GPL-3.0) : installe les jeux Epic. Téléchargé seulement quand vous en installez un, comme programme séparé.
- **Electron** et **Chromium** : la base du programme.
- **QR Code Generator**, de Kazuhiko Arase (MIT), et les polices **Manrope** et **Sora** (SIL OFL).
- Données de **SteamGridDB, IGDB, RetroAchievements, libretro, Wikipédia / Wikidata, PCGamingWiki, Exophase** et de la **boutique Steam**.
- **Merci** aux projets qui ont inspiré des parties de Taiga Launcher : [Millennium](https://github.com/SteamClientHomebrew/Millennium), [SFP](https://github.com/PhantomGamers/SFP), [BoilR](https://github.com/PhilipK/BoilR), [Playhub Metadata](https://github.com/LoZazaMastro/Playhub-Metadata), [Steam Achievement Notifier](https://github.com/SteamAchievementNotifier/SteamAchievementNotifier), ainsi qu'à ceux crédités par NativeGameLink : [game-data-linker](https://github.com/retrotoolsdev-wq/game-data-linker), [SteamAchievementManager](https://github.com/gibbed/SteamAchievementManager), [Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) et [steam-non-steam-playtimes](https://github.com/k0d13/steam-non-steam-playtimes).

La liste complète se trouve dans [NOTICE](NOTICE) et [THIRD-PARTY-NOTICES](resources/app/THIRD-PARTY-NOTICES.md).

---

## 📄 Licence

**Apache License 2.0** : tout le monde peut utiliser, étudier, modifier et distribuer Taiga Launcher. **Citer l'auteur est obligatoire** : toute personne qui distribue le programme ou une version basée sur lui doit conserver le fichier [NOTICE](NOTICE) et créditer visiblement l'auteur original, par exemple *« Basé sur Taiga Launcher, créé par Taiga (GabrielTaiga) »*. Les versions modifiées doivent indiquer qu'elles ont été modifiées et ne peuvent pas se présenter comme la version officielle.

Taiga Launcher n'est affilié ni à Valve, ni à Sony, Microsoft, Epic Games, GOG, Nintendo, RetroAchievements ou Exophase. Toutes les marques appartiennent à leurs propriétaires.

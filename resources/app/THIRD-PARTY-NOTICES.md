# Créditos e componentes de terceiros

**Taiga Launcher**, criado por **Taiga (GabrielTaiga)**. Licença Apache 2.0: livre para usar, modificar e
distribuir, desde que os créditos ao autor sejam mantidos (arquivos `LICENSE` e `NOTICE` na pasta do programa).

## Componentes incluídos

Cada um continua sob a sua própria licença.

| Componente | Onde | Licença |
|---|---|---|
| NativeGameLink for Steam 4.0.3, David Miranda (Davidjarod11) | `steam/ngl.bundle.js` (código no repositório, `third_party/nativegamelink`) | MIT, `licenses/NativeGameLink-MIT.txt` |
| Electron | executável do programa | MIT, `licenses/Electron-MIT.txt` |
| Chromium | executável do programa | várias, `LICENSES.chromium.html` |
| QR Code Generator, Kazuhiko Arase | `web/qrcode.js` (QR Code do PIX) | MIT, `licenses/qrcode-generator-MIT.txt` |
| Manrope e Sora | `web/fonts` | SIL Open Font License 1.1, arquivos `*-OFL.txt` |

## Programa baixado sob demanda

| Componente | Onde | Licença |
|---|---|---|
| Legendary 0.21.1 ([legendary-gl/legendary](https://github.com/legendary-gl/legendary)) | baixado do GitHub na primeira instalação de um jogo da Epic, em `%LOCALAPPDATA%\Taiga Launcher\tools\legendary` (conferido pelo SHA-256 publicado) | GPL-3.0 |

O Legendary roda como um programa separado e não faz parte do código do Taiga Launcher. O código-fonte está no
repositório acima. Ele só é baixado quando o usuário instala um jogo da Epic pelo Taiga Launcher.

A página do jogo dentro da Steam é o NativeGameLink for Steam com alterações do Taiga Launcher (marcadas no código).

## Agradecimentos e projetos de referência

Projetos estudados durante a criação do Taiga Launcher (ideias e abordagem; o código deles não vem junto, a não
ser o que está na tabela acima). Obrigado aos autores:

- **Millennium**, Project Millennium ([SteamClientHomebrew/Millennium](https://github.com/SteamClientHomebrew/Millennium), MIT): integração com a Steam pela porta de depuração do CEF.
- **SFP**, Chris Yeninas / PhantomGamers ([PhantomGamers/SFP](https://github.com/PhantomGamers/SFP), MIT): argumentos de abertura da Steam e injeção de scripts.
- **Playnite** ([JosefNemec/PlayniteExtensions](https://github.com/JosefNemec/PlayniteExtensions), MIT) e **Heroic Games Launcher** ([Heroic-Games-Launcher](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher), GPL-3.0): como reconhecer jogos do Xbox pelo registro de pacotes do Windows e como instalar jogos da Epic com o Legendary.
- **BoilR**, PhilipK ([PhilipK/BoilR](https://github.com/PhilipK/BoilR), MIT / Apache-2.0): importação de jogos de outras lojas para a Steam.
- **Playhub Metadata**, LoZazaMastro ([LoZazaMastro/Playhub-Metadata](https://github.com/LoZazaMastro/Playhub-Metadata)): dados e artes para jogos fora da Steam.
- **Steam Achievement Notifier** ([SteamAchievementNotifier/SteamAchievementNotifier](https://github.com/SteamAchievementNotifier/SteamAchievementNotifier)): notificações de conquistas.

Citados pelo NativeGameLink for Steam, cujo trabalho faz parte da página do jogo:
[game-data-linker](https://github.com/retrotoolsdev-wq/game-data-linker) (retrotoolsdev-wq, MIT),
[SteamAchievementManager](https://github.com/gibbed/SteamAchievementManager) (gibbed),
[Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) (xan105) e
[steam-non-steam-playtimes](https://github.com/k0d13/steam-non-steam-playtimes) (k0d13).

## Dados e serviços usados durante o uso

Nada disso vem junto com o programa: é baixado de cada serviço quando você usa, e segue os termos de cada um.

- **SteamGridDB**: capas, fundos, logos e ícones.
- **IGDB (Twitch)**: informações dos jogos.
- **RetroAchievements**: conquistas de emuladores.
- **libretro-thumbnails e libretro-database**: capas e identificação Redump/No-Intro.
- **Wikipedia e Wikidata**: descrições (texto sob CC BY-SA 4.0, com a fonte indicada na página do jogo) e dados (CC0).
- **PCGamingWiki**: AppID da Steam dos jogos de PC.
- **Exophase**: listas de troféus de PS4.
- **Loja da Steam (Valve)**: informações, artes e conquistas de jogos com equivalente na Steam.
- **Microsoft Translator, Google Tradutor e MyMemory**: tradução automática.
- **Emuladores** (PCSX2, RPCS3, Vita3K, Xenia, mGBA, BizHawk, ares, Stella e outros): quando você pede, são baixados das páginas oficiais de cada projeto e continuam sob as licenças deles. O Taiga Launcher não traz nenhum emulador.

Os logotipos de GitHub Sponsors, PIX e Ko-fi na aba Apoiar são marcas dos respectivos donos e aparecem só para
indicar cada forma de doação. O Taiga Launcher não é afiliado à Valve, Sony, Microsoft, Epic Games, GOG, Nintendo,
SteamGridDB, Twitch/IGDB, RetroAchievements, Exophase nem à Wikimedia Foundation.

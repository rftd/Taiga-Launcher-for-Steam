<p align="center">
  <img src="docs/logo.png" width="120" alt="Taiga Launcher">
</p>

<h1 align="center">Taiga Launcher</h1>

<p align="center">
  <b>Seus jogos de emulador, de PC e de outras lojas dentro da Steam, como se fossem jogos da própria Steam.</b><br>
  Capa, página do jogo completa, conquistas com a notificação nativa da Steam e tempo de jogo. Sem plugins e sem configuração.
</p>

<h2 align="center">
  <a href="https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest">Baixar</a>
</h2>

<p align="center">
  <a href="README.md">English</a> ·
  <b>Português (Brasil)</b> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a>
</p>

> [!WARNING]
> **Versão inicial:** o programa ainda pode ter muitos erros. Relate os bugs quando puder, pelo botão **Relatar problema** do programa ou em [Issues](https://github.com/GabrielTaiga/Taiga-Launcher/issues).


---

## 🔥 Destaques

| | |
|---|---|
| 🎮 **Tudo numa biblioteca só** | PSP, PS2, PS3, Switch, consoles retrô, Epic, GOG, Xbox, EA, Ubisoft, Riot, jogos de PC soltos e ports de console, tudo dentro da Steam. |
| 📄 **Página de jogo de verdade** | Descrição, notícias, conquistas, tempo de jogo e informações, em vez de um atalho vazio. |
| 🏆 **Conquistas com o aviso da Steam** | Desbloqueou uma conquista no emulador ou em outra loja? A Steam mostra a notificação dela, com som. |
| 🔎 **Encontra e identifica sozinho** | Procura nos seus discos, reconhece cada jogo pelo conteúdo e liga ao jogo certo da Steam. |
| 🖼️ **Artes sem chave de API** | Capa, fundo, logo e ícone baixados sozinhos. O que faltar é procurado de novo até aparecer. |
| 🌎 **5 idiomas** | Português, English, Español, Français e Deutsch, inclusive descrições dos jogos e nomes das conquistas. |

---

## 📸 Imagens

### Página de um jogo fora da Steam sem o programa ativado
<img src="https://i.imgur.com/fWZLBqc.png" alt="Página de um jogo fora da Steam sem o programa ativado">

### Jogos de emulador e de outras lojas dentro da Steam
<img src="https://i.imgur.com/rvg56nz.png" alt="Jogos de emulador e de outras lojas dentro da Steam">

### Todas as conquistas dentro da Steam
<img src="https://i.imgur.com/hVSNh4q.png" alt="Todas as conquistas dentro da Steam">

### Todas as informações, como um jogo nativo
<img src="https://i.imgur.com/i2xpgKc.png" alt="Todas as informações, como um jogo nativo">

### Os jogos entram na contagem da sua biblioteca da Steam
<img src="https://i.imgur.com/ZT5MEqG.png" alt="Os jogos entram na contagem da sua biblioteca da Steam">

### Seus jogos na coleção da Steam
<img src="https://i.imgur.com/J45O3bz.png" alt="Seus jogos na coleção da Steam">

### Veja e altere todas as informações do jogo
<img src="https://i.imgur.com/sCl5Pu1.png" alt="Veja e altere todas as informações do jogo">

### Jogos da Epic, GOG, Xbox e outras lojas
<img src="https://i.imgur.com/B8UAbGW.png" alt="Jogos da Epic, GOG, Xbox e outras lojas">

### Jogos de vários emuladores
<img src="https://i.imgur.com/74aHDzy.png" alt="Jogos de vários emuladores">

### Conecte suas contas para registrar as conquistas na Steam
<img src="https://i.imgur.com/x5WfOD1.png" alt="Conecte suas contas para registrar as conquistas na Steam">

### Simples de usar: os jogos são encontrados sozinhos
<img src="https://i.imgur.com/8vbQ3ed.png" alt="Simples de usar: os jogos são encontrados sozinhos">

### Personalize as capas direto no programa
<img src="https://i.imgur.com/cY4pZbQ.png" alt="Personalize as capas direto no programa">

### Veja seus emuladores
<img src="https://i.imgur.com/U4HKCdE.png" alt="Veja seus emuladores">

---

## 🎮 O que ele faz

### Encontra seus jogos
- ISOs e ROMs nas pastas dos emuladores.
- Jogos instalados da **Epic, GOG, EA, Ubisoft, Battle.net, Rockstar, Xbox / Microsoft Store e Riot**.
- Jogos de PC soltos em qualquer disco, inclusive **ports de console** (como o God of War III do SpartanPort).
- Nada entra duplicado: o mesmo jogo em duas lojas, ou um port junto com o dump do console, vira um item só.

### Identifica cada jogo certo
- Pelo conteúdo do arquivo: bancos **Redump / No-Intro**, `PARAM.SFO`, cabeçalho das ROMs e nome do produto gravado no executável.
- Liga jogos de PC ao **AppID certo da Steam** por evidências: arquivos da pasta do jogo (`steam_appid.txt`, configurações de emuladores da Steam, manifestos da Steam) e bancos que guardam o AppID (Wikidata, PCGamingWiki, IGDB, SteamGridDB). Se as fontes discordarem, ele pergunta em vez de chutar.

### Coloca na Steam
- Cada jogo vira um atalho da Steam com **capa, fundo, logo, imagem horizontal e ícone**, numa coleção **"Taiga Launcher"**.
- Com a Steam aberta, os jogos entram **na hora, sem reiniciar a Steam**.
- Cada jogo ganha uma **página completa na Steam**: descrição, notícias, conteúdo da comunidade, informações, conquistas e tempo de jogo (baseada no NativeGameLink for Steam, com alterações).
- Os jogos abrem pela Steam normalmente, com o emulador e as configurações certas.

### Conquistas
| Jogos | De onde vêm | O que precisa |
|---|---|---|
| Emuladores (PSP, PS1, PS2, Nintendo, Sega, Atari...) | RetroAchievements | Conta grátis. A conta já usada no emulador é reaproveitada. |
| PS3 / PS Vita / PS4 em emulador | Troféus do RPCS3, Vita3K e shadPS4 | Nada |
| Ports de console para PC | Lista de troféus do próprio jogo + registro do port | Nada |
| Epic Games / GOG / Xbox | Conquistas da própria loja | Entrar com a conta uma vez |
| Jogos de PC que também existem na Steam | Lista oficial da Steam + progresso salvo no PC | Nada |

Todo desbloqueio aparece com a **notificação nativa de conquista da Steam**, com som.

### Tempo de jogo
- Contado pelo Taiga Launcher sempre que você joga.
- Importado da **Epic, do GOG Galaxy e do Playnite**, para o seu histórico vir junto.

### Artes sem chave
- Capas e artes vêm do servidor do próprio Taiga Launcher (SteamGridDB e IGDB com cache compartilhado), da loja da Steam, do libretro e da Wikipedia. **Você não precisa criar chave de API nenhuma.**
- Jogos sem capa são procurados logo depois de adicionados e de novo, sozinhos, nos dias seguintes.
- Prefere outra imagem? Escolha qualquer arte da galeria ou do seu PC.

### E mais
- **Baixe emuladores** de dentro do programa (PCSX2, RPCS3, Vita3K, Xenia, mGBA, BizHawk, ares e outros).
- **Abre junto com o Windows**, minimizado na bandeja, para a Steam sempre mostrar as páginas personalizadas.
- **Atualiza sozinho** com um clique.
- **Edite as artes dos seus outros jogos da Steam** pela aba Biblioteca Steam.
- **Enviar para outro PC**: gera um pacote com o programa, sem seus jogos, contas ou logins.
- **Remove tudo** da Steam com um botão. Seus jogos e saves nunca são tocados.

---

## 🕹️ Emuladores reconhecidos

PPSSPP, PCSX2, DuckStation, ePSXe, RPCS3, Vita3K, shadPS4, Dolphin, Cemu, Ryujinx, yuzu e derivados (Citron, Eden, Sudachi, suyu), Azahar (Citra, Lime3DS), melonDS, DeSmuME, mGBA, VBA-M, Project64, RMG, simple64, Snes9x, Mesen, Flycast, Redream, xemu, Xenia, MAME, DOSBox, RetroArch, BizHawk, ares, Mednafen, Stella e Kega Fusion.

---

## 📥 Instalar

**Linux (x86_64):** consulte [suporte Linux e AppImage](docs/LINUX.md) para gerar o aplicativo e configurar Steam nativa ou Flatpak. A integração real com Steam no Linux ainda precisa de validação no desktop.

1. Baixe o `.zip` da **[versão mais recente](https://github.com/GabrielTaiga/Taiga-Launcher/releases/latest)**.
2. Extraia a pasta inteira onde quiser (por exemplo `C:\Jogos\Taiga Launcher`). Não separe o `.exe` dos outros arquivos.
3. Abra **Taiga Launcher.exe**. Um passo a passo rápido pede o idioma, a conta da Steam e onde ficam os seus jogos.

**Requisitos:** Windows 10 ou 11 (64 bits) e Steam instalada, com a sua conta já usada pelo menos uma vez neste PC. Precisa de internet para artes, informações e listas de conquistas; os jogos em si rodam sem internet.

É portátil: sem instalador, sem Millennium, sem SFP, sem Node.js.

> O Windows pode mostrar "O Windows protegeu o computador" porque o programa ainda não tem assinatura digital. Clique em **Mais informações › Executar assim mesmo**.

---

## ❓ Perguntas frequentes

**Ele mexe nos meus jogos ou nas minhas contas?**
Não. Ele só cria atalhos na Steam e lê arquivos de progresso. Nas contas (Epic, GOG, Xbox, RetroAchievements) ele só lê as conquistas. Os logins ficam cifrados pelo próprio Windows e só o seu usuário, neste PC, consegue ler.

**Ganho licenças, cartas ou conquistas reais da Steam?**
Não. Tudo é mostrado localmente na sua Steam. Nada muda na posse dos jogos, no inventário ou no seu perfil público da Steam.

**Por que a Steam precisa reiniciar uma vez?**
A página do jogo e as notificações entram na Steam pela porta local de depuração dela. Na primeira vez a Steam é aberta com essa opção ligada; depois fica automático.

**Onde ficam meus dados?**
Em `%LOCALAPPDATA%\Taiga Launcher`. A pasta do programa pode ser movida ou trocada sem perder nada.

**A página do jogo não apareceu na Steam.**
Use **Configurações › Testar integração**. Ele confere cada parte e diz o que resolver.

**Achei um problema.**
Use **Relatar problema** no menu lateral ou abra uma [issue](https://github.com/GabrielTaiga/Taiga-Launcher/issues).

---

## 🗺️ Próximas atualizações, caso o projeto tenha apoio

- 👥 **Seus amigos da Steam no Taiga Launcher:** veja na Steam o que seus amigos jogam fora dela e compare conquistas.
- 🎖️ **Seus troféus de console dentro da Steam:** troféus da PlayStation e conquistas do Xbox na sua biblioteca da Steam.
- ✏️ **A página do jogo na Steam do seu jeito:** mude as conquistas, adicione cabeçalhos, seções e imagens e edite cada informação.
- 💬 **Seu jogo no Discord, como um jogo da Steam:** o jogo que você abre aparece no seu perfil do Discord.
- 🧩 **Editor de conquistas:** crie conquistas personalizadas para os seus jogos, inclusive os que não têm nenhuma.

---

## ☕ Apoie o projeto

O Taiga Launcher é gratuito. Se ele melhorou a sua biblioteca, você pode ajudar a continuar crescendo:

<a href="https://github.com/sponsors/GabrielTaiga"><img src="https://img.shields.io/badge/Apoiar%20no%20GitHub-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Apoiar no GitHub"></a>

**PIX** (só no Brasil): pela aba **Apoiar** do programa, com QR Code, ou pela chave `e5c0f137-b366-490b-b30c-ef20f4d63c1f`.

Dar uma estrela ⭐ no repositório também ajuda muito.

---

## 💖 Créditos

Criado por **Taiga ([GabrielTaiga](https://github.com/GabrielTaiga))**.

- **NativeGameLink for Steam**, de David Miranda (Davidjarod11, MIT): a base da página do jogo dentro da Steam.
- **Electron** e **Chromium**: a base do programa.
- **QR Code Generator**, de Kazuhiko Arase (MIT), e as fontes **Manrope** e **Sora** (SIL OFL).
- Dados de **SteamGridDB, IGDB, RetroAchievements, libretro, Wikipedia / Wikidata, PCGamingWiki, Exophase** e da **loja da Steam**.
- **Agradecimentos** aos projetos que inspiraram partes do Taiga Launcher: [Millennium](https://github.com/SteamClientHomebrew/Millennium), [SFP](https://github.com/PhantomGamers/SFP), [BoilR](https://github.com/PhilipK/BoilR), [Playhub Metadata](https://github.com/LoZazaMastro/Playhub-Metadata), [Steam Achievement Notifier](https://github.com/SteamAchievementNotifier/SteamAchievementNotifier), e aos citados pelo NativeGameLink: [game-data-linker](https://github.com/retrotoolsdev-wq/game-data-linker), [SteamAchievementManager](https://github.com/gibbed/SteamAchievementManager), [Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) e [steam-non-steam-playtimes](https://github.com/k0d13/steam-non-steam-playtimes).

A lista completa está em [NOTICE](NOTICE) e [THIRD-PARTY-NOTICES](resources/app/THIRD-PARTY-NOTICES.md).

---

## 📄 Licença

**Apache License 2.0**: qualquer pessoa pode usar, estudar, modificar e distribuir o Taiga Launcher. **Dar os créditos é obrigatório**: quem distribuir o programa ou uma versão baseada nele precisa manter o arquivo [NOTICE](NOTICE) e citar o autor original de forma visível, por exemplo *"Baseado no Taiga Launcher, criado por Taiga (GabrielTaiga)"*. Versões modificadas precisam dizer que foram alteradas e não podem se apresentar como a versão oficial.

O Taiga Launcher não é afiliado à Valve, Sony, Microsoft, Epic Games, GOG, Nintendo, RetroAchievements nem Exophase. As marcas pertencem aos seus donos.

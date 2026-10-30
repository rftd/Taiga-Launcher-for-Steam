# Windows e Linux

O mesmo código da interface Electron e do serviço local atende Windows e Linux.
No Linux, esta versão executa jogos nativos (ELF, AppImage e scripts executáveis)
e emuladores nativos. Jogos `.exe` precisam de um iniciador personalizado com
Wine/Proton; não há configuração automática de Proton nesta versão.

## AppImage (Linux x86_64)

Com Node.js 22 ou superior, execute na raiz do repositório:

```sh
cd resources/app
npm ci
npm test
npm run build:appimage
```

O arquivo é gerado em `dist/appimage/Taiga-Launcher-<versão>-x86_64.AppImage`.
Ele inclui o Electron: o usuário final não precisa instalar Node.js.
Mova o arquivo para um local permanente antes de adicionar jogos à Steam:

```sh
chmod +x Taiga-Launcher-*.AppImage
./Taiga-Launcher-2.3.13-x86_64.AppImage
```

O sistema precisa oferecer suporte a AppImage/FUSE e às bibliotecas gráficas do
Electron. Em sistemas sem FUSE, use `--appimage-extract-and-run`. A sandbox do
Chromium precisa estar disponível; não distribua um atalho com `--no-sandbox`.
Atualize o AppImage substituindo-o no mesmo caminho, com o programa fechado.
Se mover o arquivo, abra-o novamente e reaplique os jogos à Steam.

`npm start` abre o Electron para desenvolvimento. `npm run build:desktop -- linux x64`
gera também uma pasta portátil em `dist/Taiga Launcher-linux-x64/`.
No Windows, `npm run build:desktop -- win32 x64` gera a pasta correspondente com
`Taiga Launcher.exe`. O fluxo antigo de release Windows continua em [BUILD.md](BUILD.md).

## Steam nativa e Flatpak

A detecção procura `~/.steam/steam`, `$XDG_DATA_HOME/Steam`
(padrão `~/.local/share/Steam`), `~/.steam/root` e
`~/.var/app/com.valvesoftware.Steam/.local/share/Steam`. Se houver mais de uma
instalação, selecione a pasta de dados da Steam desejada nas configurações.
Entre na Steam pelo menos uma vez para criar o perfil local.

A Steam Flatpak precisa de permissão para executar o Taiga no host. Quando
essa permissão ainda não existe, conceda-a explicitamente:

```sh
flatpak override --user --talk-name=org.freedesktop.Flatpak com.valvesoftware.Steam
```

Essa permissão permite à Steam Flatpak iniciar processos fora da sandbox;
o Taiga não a concede automaticamente. Os atalhos usam `flatpak-spawn --host`,
o caminho original do AppImage e a pasta de dados do Taiga. Jogos e emuladores
executam no host, sem depender de arquivos na montagem temporária do AppImage.
Para revogar a permissão, use
`flatpak override --user --no-talk-name=org.freedesktop.Flatpak com.valvesoftware.Steam`.

O serviço continua acessível somente em loopback, na porta 48767. A integração
CEF usa a porta de depuração da Steam, como no Windows.

## Dados, emuladores e limitações

### Troféus do RPCS3 Flatpak

O Taiga procura automaticamente os troféus em
`~/.var/app/net.rpcs3.RPCS3/config/rpcs3/dev_hdd0/home/00000001/trophy`.
A instalação nativa em `$XDG_CONFIG_HOME/rpcs3` também é reconhecida.
O jogo precisa ter sido aberto no RPCS3 para que ele registre os arquivos de
troféus. Na fonte de conquistas do jogo, use **Automático** ou **RPCS3**.

Se você mudou o disco virtual do RPCS3, o Taiga lê o caminho em `vfs.yml`.
Também é possível informar a pasta do RPCS3, `dev_hdd0` ou a pasta de troféus
nas configurações. Para outro usuário do emulador, ajuste o usuário RPCS3
(o padrão é `00000001`). Se houver duas instalações com progresso do mesmo
jogo, selecione uma pasta para evitar misturar os dados. O leitor não altera
os arquivos de troféus do emulador.

### Pastas e recursos

- Dados: `$XDG_DATA_HOME/taiga-launcher`, padrão `~/.local/share/taiga-launcher`.
  `TAIGA_DATA` continua disponível para desenvolvimento. Uma pasta antiga
  `~/Taiga Launcher` é reaproveitada quando existe.
- Inicialização automática: `$XDG_CONFIG_HOME/autostart/taiga-launcher.desktop`
  (padrão `~/.config/autostart`). O caminho do AppImage é preservado.
- Emuladores: selecione o executável nativo. A descoberta inclui `/usr/bin`,
  `/usr/local/bin`, `~/.local/bin` e as pastas de emuladores do usuário.
  Emuladores Flatpak não são configurados automaticamente nesta versão.
- Download automático de emuladores e atualização automática do pacote continuam
  exclusivos do Windows. No Linux, use seu gerenciador de pacotes e substitua
  o AppImage para atualizar. O pacote não inclui contas nem chaves pessoais.
- A proteção de credenciais no Electron utiliza o chaveiro do sistema;
  o backend Linux `basic_text` não é considerado criptografia segura.
- Os testes automatizados verificam importação, execução nativa e arquivos de
  atalhos para Steam nativa/Flatpak usando instalações simuladas. Ainda é
  necessário testar jogos, conquistas e injeção CEF em instalações reais de
  Windows e Linux com Steam. O workflow de CI inclui ambos os sistemas.

### Emuladores Flatpak e RetroAchievements

A busca de emuladores consulta os aplicativos Flatpak instalados, incluindo RetroArch,
RPCS3 e Dolphin. Quando houver mais de uma instalação, escolha a desejada na lista.
Não é necessário localizar o atalho `.desktop`. O RetroArch Flatpak usa os núcleos
instalados na configuração do próprio aplicativo. Ao iniciar um jogo, o launcher
solicita acesso de leitura à pasta desse jogo para aquela execução.

No Linux, a descoberta e a seleção de emuladores excluem executáveis Windows `.exe`.
Uma configuração antiga desse tipo aparece como não encontrada e pode ser substituída
por uma instalação nativa ou Flatpak na próxima busca.

As sessões RetroAchievements do RetroArch e do Dolphin são lidas também dos diretórios
XDG e Flatpak. A conta precisa estar conectada no emulador e o jogo identificado no
RetroAchievements. O token não aparece na interface.

A descoberta de jogos também lê as playlists do RetroArch e as configurações de
Dolphin, RPCS3, PCSX2, DuckStation e PPSSPP nas pastas XDG e Flatpak. Ela considera
`HOME`, `~/roms` e `~/Emulation/roms`; jogos nativos nas subpastas de `~/Games` ou
`~/Jogos` podem aparecer como candidatos. Pastas externas continuam podendo ser
adicionadas nas configurações. AppImages de emuladores podem ter a versão no nome.

Se `flatpak list` falhar, a busca também verifica os atalhos exportados em
`~/.local/share/applications`, nos diretórios de exportação do Flatpak e nas pastas
XDG. Ela confirma a instalação com `flatpak info`, sem executar o conteúdo dos atalhos.

Falhas de consulta ao RetroAchievements podem ser tentadas novamente e são exibidas
na tela de conquistas. Uma correspondência ausente não é tratada como um jogo com
zero conquistas; confira a plataforma e o nome do jogo quando isso ocorrer.

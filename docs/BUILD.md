# Building Taiga Launcher / Como gerar o programa

The repository holds the source code. The Windows program in each Release is the source plus the Electron runtime.
O repositório guarda o código. O programa de cada Release é o código mais os arquivos do Electron.

## Layout

| Folder | What it is |
|---|---|
| `resources/app/` | The program: `server.mjs` (local service), `desktop/` (Electron window, tray), `web/` (interface), `lib/` (game detection, Steam, achievements, artwork), `locales/` (5 languages), `steam/` (scripts injected into Steam), `tests/` |
| `third_party/nativegamelink/` | Source of NativeGameLink for Steam (MIT, David Miranda) with Taiga Launcher changes; built into `resources/app/steam/ngl.bundle.js` |
| `resources/app/tools/profile-server/` | Cloudflare Worker used as the shared artwork/data server |
| `tools/` | Build helpers |
| `docs/` | README images and this file |

For the Linux AppImage and the shared Windows/Linux build commands, see [LINUX.md](LINUX.md). The manual steps below describe the original Windows release.

## Requirements

- Node.js 22 or newer
- esbuild (`npm i -g esbuild` or `npm i esbuild`)
- resedit, for the `.exe` icon and version (`npm i resedit`, MIT, jet2jet)
- Electron **44.7.1** for Windows x64 (`electron-v44.7.1-win32-x64.zip` from the Electron releases)

## Steps

1. **Tests**: `cd resources/app && npm test`
2. **Languages**: `node resources/app/tools/build-locales.mjs` (after editing `resources/app/locales/*.json`)
3. **Steam page bundle**: `node tools/build-ngl.mjs` (set `ESBUILD_PATH` if esbuild is not found)
4. **Electron runtime**: extract the Electron zip into the repository root, delete `resources/default_app.asar`,
   rename `electron.exe` to `Taiga Launcher.exe`. Keep only the `locales/*.pak` you need
   (`en-US`, `en-GB`, `pt-BR`, `pt-PT`, `es`, `es-419`, `fr`, `de`).
5. **Icon and version of the .exe**:
   `node tools/exe-meta.cjs "Taiga Launcher.exe" out.exe resources/app/desktop/icon.ico <version>` and replace the
   original with `out.exe`.
6. **Release zip**: `node tools/package-release.mjs` creates `dist/Taiga Launcher <version>.zip` without personal keys,
   tests, tools or development files. Upload it to a GitHub Release whose tag is `v<version>`; the built-in updater
   reads the latest Release of `GabrielTaiga/taiga-launcher`.

## API keys

The program uses the shared server (`taigaServer` in `resources/app/package.json`), so no key is needed.
For development you can create `resources/app/chaves.json` from `chaves.example.json`; it is ignored by git and
never goes into a package.

## License

Apache License 2.0 with mandatory credit: keep `LICENSE` and `NOTICE` in any copy or derived work. See the README.

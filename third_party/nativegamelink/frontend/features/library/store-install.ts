// Taiga Launcher: jogos de loja não instalados (Epic e Xbox) na página do jogo da Steam.
// O botão JOGAR dá lugar ao INSTALAR da própria Steam (mesmo HTML e classes). Durante o download aparecem
// "A transferir / Progresso: N%" e o botão PAUSAR; a setinha ao lado abre "Cancelar instalação" e "Instalar pela
// Epic Games Launcher". Quando o jogo termina de instalar, o JOGAR original da Steam volta sozinho.
// Nada da página da Steam é removido: o JOGAR só fica escondido enquanto o jogo não está instalado.
import { callable } from '@steambrew/client';
import { routedSteamAppId } from './native-route';
import { paintedNativePlaybar } from '../../steam/library-details';
import { PLAYBAR_CLASSES } from '../../steam/css';
import { displayLanguage } from '../../steam/localization';
import { getCanonicalDesktopPopup, resolveSteamWindowContext } from '../../runtime/existing-windows';
import { backendLog } from '../../api/backend';

const stateCall = callable<[{ shortcut_app_id: string }], string>('taiga_install_state');
const startCall = callable<[{ shortcut_app_id: string; via?: string }], string>('taiga_install_start');
const pauseCall = callable<[{ shortcut_app_id: string }], string>('taiga_install_pause');
const cancelCall = callable<[{ shortcut_app_id: string }], string>('taiga_install_cancel');
const infoCall = callable<[{ shortcut_app_id: string; wait?: boolean }], string>('taiga_install_info');
const idsCall = callable<[], string>('taiga_install_ids');
const pickFolderCall = callable<[], string>('taiga_install_pick_folder');
const startWithCall = callable<[{ shortcut_app_id: string; dir: string; desktop: boolean; start_menu: boolean }], string>('taiga_install_start');

interface Drive { letter: string; label: string; free: number; total: number; dir: string; default: boolean; enough: boolean }
interface InstallState { sizeBytes?: number; title?: string; header?: string; drives?: Drive[]; state: string; store?: string; phase?: string; percent?: number; eta?: string; error?: string; errorCode?: string; errorValues?: Record<string, string>; method?: string; downloadedMiB?: number; totalMiB?: number }

const TEXT: Record<string, Record<string, string>> = {
	pt: { needed: 'Espaço necessário', calculating: 'A calcular…', dlgTitle: 'Instalar', desktop: 'Criar atalho no ambiente de trabalho', startMenu: 'Criar atalho no menu Iniciar', installIn: 'Instalar em:', free: '{n} livre(s)', noSpace: 'Sem espaço suficiente', dlgInstall: 'Instalar', dlgCancel: 'Cancelar', otherFolder: 'Escolher outra pasta', install: 'Instalar', pause: 'Pausar', resume: 'Retomar', retry: 'Tentar de novo', reopenEpic: 'Abrir na Epic', reopenXbox: 'Abrir no Xbox', downloading: 'A transferir', preparing: 'A preparar', tool: 'A preparar o instalador', finishing: 'A concluir', paused: 'Em pausa', progress: 'Progresso: {p}%', externalEpic: 'A instalar pela Epic Games', externalXbox: 'A instalar pelo app Xbox', error: 'A instalação falhou', notInstalled: 'Não instalado', menu: 'Mais opções de instalação', cancelInstall: 'Cancelar instalação', viaEpic: 'Instalar pelo Epic Games Launcher', viaTaiga: 'Instalar pelo Taiga Launcher', openXbox: 'Abrir no app Xbox', err_disk: 'Espaço insuficiente no disco: {free} GB livres, precisa de {need} GB. Escolha outra pasta em Configurações.', err_path: 'A pasta de instalação não existe.', err_uplay: 'Este jogo instala pelo Ubisoft Connect. A Epic foi aberta para instalar.', err_auth: 'Entre de novo com a conta Epic em Contas, no Taiga Launcher.', err_notfound: 'A Epic não encontrou este jogo na sua conta.' },
	en: { needed: 'Disk space required', calculating: 'Calculating…', dlgTitle: 'Install', desktop: 'Create desktop shortcut', startMenu: 'Create start menu shortcut', installIn: 'Install to:', free: '{n} free', noSpace: 'Not enough space', dlgInstall: 'Install', dlgCancel: 'Cancel', otherFolder: 'Choose another folder', install: 'Install', pause: 'Pause', resume: 'Resume', retry: 'Try again', reopenEpic: 'Open in Epic', reopenXbox: 'Open in Xbox', downloading: 'Downloading', preparing: 'Preparing', tool: 'Preparing installer', finishing: 'Finishing', paused: 'Paused', progress: 'Progress: {p}%', externalEpic: 'Installing through Epic Games', externalXbox: 'Installing through the Xbox app', error: 'Installation failed', notInstalled: 'Not installed', menu: 'More install options', cancelInstall: 'Cancel installation', viaEpic: 'Install with the Epic Games Launcher', viaTaiga: 'Install with Taiga Launcher', openXbox: 'Open in the Xbox app', err_disk: 'Not enough disk space: {free} GB free, {need} GB needed. Choose another folder in Settings.', err_path: 'The install folder does not exist.', err_uplay: 'This game installs through Ubisoft Connect. Epic was opened to install it.', err_auth: 'Sign in again with your Epic account in Accounts, in Taiga Launcher.', err_notfound: 'Epic could not find this game in your account.' },
	es: { needed: 'Espacio necesario', calculating: 'Calculando…', dlgTitle: 'Instalar', desktop: 'Crear acceso directo en el escritorio', startMenu: 'Crear acceso directo en el menú Inicio', installIn: 'Instalar en:', free: '{n} libre(s)', noSpace: 'No hay espacio suficiente', dlgInstall: 'Instalar', dlgCancel: 'Cancelar', otherFolder: 'Elegir otra carpeta', install: 'Instalar', pause: 'Pausar', resume: 'Reanudar', retry: 'Reintentar', reopenEpic: 'Abrir en Epic', reopenXbox: 'Abrir en Xbox', downloading: 'Descargando', preparing: 'Preparando', tool: 'Preparando el instalador', finishing: 'Finalizando', paused: 'En pausa', progress: 'Progreso: {p}%', externalEpic: 'Instalando con Epic Games', externalXbox: 'Instalando con la app Xbox', error: 'La instalación falló', notInstalled: 'No instalado', menu: 'Más opciones de instalación', cancelInstall: 'Cancelar instalación', viaEpic: 'Instalar con Epic Games Launcher', viaTaiga: 'Instalar con Taiga Launcher', openXbox: 'Abrir en la app Xbox', err_disk: 'No hay espacio suficiente: {free} GB libres, se necesitan {need} GB. Elige otra carpeta en Configuración.', err_path: 'La carpeta de instalación no existe.', err_uplay: 'Este juego se instala con Ubisoft Connect. Se abrió Epic para instalarlo.', err_auth: 'Vuelve a iniciar sesión con tu cuenta Epic en Cuentas, en Taiga Launcher.', err_notfound: 'Epic no encontró este juego en tu cuenta.' },
	fr: { needed: 'Espace requis', calculating: 'Calcul…', dlgTitle: 'Installer', desktop: 'Créer un raccourci sur le bureau', startMenu: 'Créer un raccourci dans le menu Démarrer', installIn: 'Installer dans :', free: '{n} libre(s)', noSpace: 'Espace insuffisant', dlgInstall: 'Installer', dlgCancel: 'Annuler', otherFolder: 'Choisir un autre dossier', install: 'Installer', pause: 'Pause', resume: 'Reprendre', retry: 'Réessayer', reopenEpic: 'Ouvrir dans Epic', reopenXbox: 'Ouvrir dans Xbox', downloading: 'Téléchargement', preparing: 'Préparation', tool: "Préparation de l'installateur", finishing: 'Finalisation', paused: 'En pause', progress: 'Progression : {p} %', externalEpic: 'Installation via Epic Games', externalXbox: "Installation via l'app Xbox", error: "L'installation a échoué", notInstalled: 'Non installé', menu: "Plus d'options d'installation", cancelInstall: "Annuler l'installation", viaEpic: "Installer avec l'Epic Games Launcher", viaTaiga: 'Installer avec Taiga Launcher', openXbox: "Ouvrir dans l'app Xbox", err_disk: "Espace disque insuffisant : {free} Go libres, {need} Go nécessaires. Choisissez un autre dossier dans les Paramètres.", err_path: "Le dossier d'installation n'existe pas.", err_uplay: "Ce jeu s'installe via Ubisoft Connect. Epic a été ouvert pour l'installer.", err_auth: 'Reconnectez votre compte Epic dans Comptes, dans Taiga Launcher.', err_notfound: "Epic n'a pas trouvé ce jeu dans votre compte." },
	de: { needed: 'Benötigter Speicherplatz', calculating: 'Wird berechnet…', dlgTitle: 'Installieren', desktop: 'Desktopverknüpfung erstellen', startMenu: 'Startmenüverknüpfung erstellen', installIn: 'Installieren auf:', free: '{n} frei', noSpace: 'Nicht genug Speicherplatz', dlgInstall: 'Installieren', dlgCancel: 'Abbrechen', otherFolder: 'Anderen Ordner wählen', install: 'Installieren', pause: 'Pausieren', resume: 'Fortsetzen', retry: 'Erneut versuchen', reopenEpic: 'In Epic öffnen', reopenXbox: 'In Xbox öffnen', downloading: 'Wird heruntergeladen', preparing: 'Wird vorbereitet', tool: 'Installer wird vorbereitet', finishing: 'Wird abgeschlossen', paused: 'Pausiert', progress: 'Fortschritt: {p} %', externalEpic: 'Installation über Epic Games', externalXbox: 'Installation über die Xbox-App', error: 'Installation fehlgeschlagen', notInstalled: 'Nicht installiert', menu: 'Weitere Installationsoptionen', cancelInstall: 'Installation abbrechen', viaEpic: 'Mit dem Epic Games Launcher installieren', viaTaiga: 'Mit Taiga Launcher installieren', openXbox: 'In der Xbox-App öffnen', err_disk: 'Nicht genug Speicherplatz: {free} GB frei, {need} GB nötig. Wähle in den Einstellungen einen anderen Ordner.', err_path: 'Der Installationsordner existiert nicht.', err_uplay: 'Dieses Spiel wird über Ubisoft Connect installiert. Epic wurde zum Installieren geöffnet.', err_auth: 'Melde dich in Taiga Launcher unter Konten erneut mit deinem Epic-Konto an.', err_notfound: 'Epic hat dieses Spiel in deinem Konto nicht gefunden.' },
};
function t(key: string, values: Record<string, string> = {}): string {
	const lang = displayLanguage();
	const table = /^(brazilian|portuguese)/.test(lang) ? TEXT.pt : /^(spanish|latam)/.test(lang) ? TEXT.es : /^french/.test(lang) ? TEXT.fr : /^german/.test(lang) ? TEXT.de : TEXT.en;
	let s = table[key] || TEXT.en[key] || key;
	for (const [k, v] of Object.entries(values)) s = s.replace('{' + k + '}', v);
	return s;
}
function gb(bytes: number, digits = 2): string {
	const lang = displayLanguage(), locale = /^(brazilian|portuguese)/.test(lang) ? 'pt-BR' : /^(spanish|latam)/.test(lang) ? 'es-ES' : /^french/.test(lang) ? 'fr-FR' : /^german/.test(lang) ? 'de-DE' : 'en-US';
	return (bytes / 1024 ** 3).toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) + ' GB';
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

const cache = new Map<number, { at: number; value: InstallState }>();
const pending = new Set<number>();
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;
const sizeAsked = new Set<number>();

function active(st: InstallState | undefined): boolean { return !!st && (st.state === 'installing' || st.state === 'external'); }

async function fetchState(id: number, force = false): Promise<InstallState | undefined> {
	const hit = cache.get(id);
	const maxAge = active(hit?.value) ? 1000 : 2500;
	if (!force && hit && Date.now() - hit.at < maxAge) return hit.value;
	if (pending.has(id)) return hit?.value;
	pending.add(id);
	try {
		const value = JSON.parse(await stateCall({ shortcut_app_id: String(id) })) as InstallState;
		cache.set(id, { at: Date.now(), value });
		return value;
	} catch { return hit?.value; } finally { pending.delete(id); }
}

function desktopDocument(): Document | null {
	try { const popup = getCanonicalDesktopPopup(); const win = popup ? resolveSteamWindowContext(popup).popupWin : null; return win?.document || null; } catch { return null; }
}

// Botão JOGAR da Steam dentro da barra do jogo: o maior botão à esquerda, fora dos ícones da direita.
function findPlayButton(playbar: HTMLElement): HTMLElement | null {
	const icons = PLAYBAR_CLASSES().AppButtonsContainer;
	const iconBox = icons ? playbar.querySelector<HTMLElement>('.' + icons.split(' ')[0]) : null;
	const list = Array.from(playbar.querySelectorAll<HTMLElement>('[class*="PlayButton"], [class*="playButton"], button, [role="button"], .DialogButton'))
		.filter(el => !el.closest('[data-taiga-install]') && !(iconBox && iconBox.contains(el)) && !el.closest('[data-gdl-cloud-stats]'));
	let best: HTMLElement | null = null, bestW = 0;
	for (const el of list) {
		const hidden = el.closest<HTMLElement>('[data-taiga-hidden="1"]');
		const r = hidden ? { width: Number(el.dataset.taigaW || 0), height: Number(el.dataset.taigaH || 0) } : el.getBoundingClientRect();
		if (r.height < 28 || r.width < 80) continue;
		if (el.querySelector('button, [role="button"]') && !/Play/i.test(el.className)) continue;
		if (r.width > bestW) { best = el; bestW = r.width; }
	}
	return best;
}
// Bloco inteiro do JOGAR (botão + setinha "Jogar a partir de"), que é o que fica escondido.
function playBlock(play: HTMLElement, playbar: HTMLElement): HTMLElement {
	const panel = play.closest<HTMLElement>('.Panel');
	const outer = panel?.parentElement;
	return outer && outer !== playbar && playbar.contains(outer) && outer.childElementCount === 1 ? outer : panel && panel !== playbar ? panel : play;
}

// HTML do botão da própria Steam (Instalar / Pausar), com o rótulo trocado conforme o estado.
const SVG_DOWNLOAD = '<svg xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_Download" viewBox="0 0 36 36" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M29 23V27H7V23H2V32H34V23H29Z" fill="currentColor"></path><svg x="0" y="0" width="32" height="25"><path class="DownloadArrow" d="M20 14.1716L24.5858 9.58578L27.4142 12.4142L18 21.8284L8.58582 12.4142L11.4142 9.58578L16 14.1715V2H20V14.1716Z" fill="currentColor"></path></svg></svg>';
const SVG_PAUSE = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_Pause" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256"><path d="M44.979,219.364c0,3.3,2.7,6,6,6h49.753c3.3,0,6-2.7,6-6V36.5c0-3.3-2.7-6-6-6H50.979c-3.3,0-6,2.7-6,6V219.364z"></path><path d="M149.267,219.364c0,3.3,2.7,6,6,6h49.753c3.3,0,6-2.7,6-6V36.5c0-3.3-2.7-6-6-6h-49.753c-3.3,0-6,2.7-6,6V219.364z"></path></svg>';
const SVG_ARROW = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_FlatArrow" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256" style="transform: rotate(180deg);"><polygon points="13.913,141 128,59 242.087,141 " fill="#ffffff"></polygon></svg>';
function steamButton(icon: string, label: string, act: string, menuLabel: string): string {
	return `<div class="_2zxzStp5qY5M1evOm8keES" data-taiga-btn="1"><div class="_1FnJ6dPuknQFQ2RTpKTI16 _1hhB2Wf7iExA15zh_lDQ_y Panel"><div class="_3ydigb6zZAjJ0JCDgHwSYA _2AzIX5kl9k6JnxLfR5H4kX Focusable" tabindex="0" role="button" data-taiga-act="${act}">${icon}<div class="_33cnXIqTRgRr49_FNXIHj6">${esc(label)}</div></div><div class="_2q-gZ3XJzlvSGHSF-GvSmi _2AzIX5kl9k6JnxLfR5H4kX Focusable" aria-label="${esc(menuLabel)}" title="${esc(menuLabel)}" tabindex="0" role="button" data-taiga-act="menu">${SVG_ARROW}</div></div></div>`;
}
// Se a Steam mudar as classes numa atualização, o mesmo botão é desenhado com estilo próprio (azul da Steam).
function ensureFallbackStyle(box: HTMLElement): void {
	const main = box.querySelector<HTMLElement>('[data-taiga-act]:not([data-taiga-act="menu"])');
	const view = box.ownerDocument.defaultView;
	if (!main || !view) return;
	const cs = view.getComputedStyle(main);
	const styled = cs.backgroundImage !== 'none' || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
	if (styled) return;
	const panel = box.querySelector<HTMLElement>('.Panel'), arrow = box.querySelector<HTMLElement>('[data-taiga-act="menu"]');
	if (panel) panel.style.cssText = 'display:flex;align-items:stretch;height:52px;';
	main.style.cssText = 'display:flex;align-items:center;gap:12px;padding:0 28px 0 22px;background:linear-gradient(to right,#47bfff 5%,#1a44c2 60%);color:#fff;font-size:22px;font-weight:500;letter-spacing:.03em;text-transform:uppercase;cursor:pointer;border-radius:2px 0 0 2px;';
	for (const svg of Array.from(main.querySelectorAll<SVGElement>(':scope > svg'))) { svg.style.width = '26px'; svg.style.height = '26px'; svg.style.fill = 'currentColor'; }
	if (arrow) { arrow.style.cssText = 'display:flex;align-items:center;justify-content:center;width:36px;background:#1a44c2;border-left:1px solid rgba(255,255,255,.25);cursor:pointer;border-radius:0 2px 2px 0;'; const s = arrow.querySelector<SVGElement>('svg'); if (s) { s.style.width = '12px'; s.style.height = '12px'; } }
}

// Mesma distância da Steam entre o botão e o texto ao lado (24 px, como em "Nuvem" e "Tempo de jogo"): mede onde o
// texto começou e corrige só a margem do bloco, sem depender do espaçamento interno das classes da Steam.
const NATIVE_GAP = 24;
function alignInfo(box: HTMLElement): void {
	const btn = box.querySelector<HTMLElement>('[data-taiga-btn]'), wrap = box.querySelector<HTMLElement>('[data-taiga-info]');
	if (!btn || !wrap) return;
	wrap.style.marginLeft = '0px';
	const textEl = wrap.querySelector<HTMLElement>('[class], div') || wrap;
	const range = box.ownerDocument.createRange();
	let left = textEl.getBoundingClientRect().left;
	try { const walker = box.ownerDocument.createTreeWalker(wrap, NodeFilter.SHOW_TEXT); const node = walker.nextNode(); if (node) { range.selectNodeContents(node); const r = range.getBoundingClientRect(); if (r.width) left = r.left; } } catch {}
	const right = btn.getBoundingClientRect().right;
	if (!right || !left) { wrap.style.marginLeft = NATIVE_GAP + 'px'; return; }
	wrap.style.marginLeft = Math.round(NATIVE_GAP - (left - right)) + 'px';
}

function restore(doc: Document): void {
	for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-taiga-hidden="1"]'))) { el.style.removeProperty('display'); delete el.dataset.taigaHidden; }
	for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-taiga-install], [data-taiga-menu]'))) el.remove();
}

function hide(el: HTMLElement): void { if (el.dataset.taigaHidden !== '1') { el.style.setProperty('display', 'none', 'important'); el.dataset.taigaHidden = '1'; } }

function errorText(st: InstallState): string {
	const code = st.errorCode || '';
	if (code && TEXT.en['err_' + code]) return t('err_' + code, Object.fromEntries(Object.entries(st.errorValues || {}).map(([k, v]) => [k, String(Number(v).toFixed(1))])));
	return st.error || '';
}

function render(doc: Document, id: number, st: InstallState): void {
	const playbar = paintedNativePlaybar(doc, id);
	if (!playbar) return;
	const play = findPlayButton(playbar);
	if (!play) return;
	const block = playBlock(play, playbar);
	if (!block.parentElement) return;
	if (block.dataset.taigaHidden !== '1') {
		const r = play.getBoundingClientRect();
		play.dataset.taigaW = String(Math.round(r.width)); play.dataset.taigaH = String(Math.round(r.height));
		hide(block);
	}
	// A linha "Nuvem" não faz sentido para um jogo que ainda não está no PC (nem a nossa, nem a da Steam).
	for (const el of Array.from(playbar.querySelectorAll<HTMLElement>('[data-gdl-cloud-stats="1"]'))) hide(el);
	for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-gdl-cloud-status="1"]'))) el.remove();
	const cloudClass = (PLAYBAR_CLASSES().PlayBarCloudStatusContainer || '').split(' ')[0];
	if (cloudClass) for (const el of Array.from(playbar.querySelectorAll<HTMLElement>('.' + cloudClass))) if (!el.closest('[data-taiga-install]')) hide(el);
	let box = playbar.querySelector<HTMLElement>('[data-taiga-install]');
	if (!box || box.parentElement !== block.parentElement || box.previousElementSibling !== block) {
		box?.remove();
		box = doc.createElement('div');
		box.dataset.taigaInstall = '1';
		box.style.cssText = 'display:flex;align-items:center;gap:0;flex:0 1 auto;min-width:0;';
		block.insertAdjacentElement('afterend', box);
	}
	const classes = PLAYBAR_CLASSES();
	const installing = st.state === 'installing', paused = st.state === 'paused', external = st.state === 'external', error = st.state === 'error';
	const xbox = st.store === 'xbox';
	const pct = Math.max(0, Math.min(100, Number(st.percent) || 0));
	const label = installing ? t('pause') : paused ? t('resume') : external ? (xbox ? t('reopenXbox') : t('reopenEpic')) : error ? t('retry') : t('install');
	const icon = installing ? SVG_PAUSE : SVG_DOWNLOAD;
	const act = installing ? 'pause' : 'start';
	const phase = paused ? t('paused') : st.phase === 'tool' ? t('tool') : st.phase === 'preparing' ? t('preparing') : st.phase === 'finishing' ? t('finishing') : t('downloading');
	const small = (text: string, color = '#8f98a0') => `<div class="${classes.PlayBarLabel || ''}" style="text-transform:uppercase;font-size:12px;letter-spacing:.06em;color:${color};">${esc(text)}</div>`;
	const pctText = pct < 10 ? String(Math.round(pct * 10) / 10) : String(Math.round(pct));
	// Progresso: o mesmo bloco da Steam ("A transferir / Progresso: N%" com a barra).
	const progress = `<div class="_1dg8hJMsAYISbeQUxcCJcv _2F4PcO4yl7Xl5emuGiF2La" data-taiga-progress="1"><div class="${classes.PlayBarLabel || '_34lrt5-Fc3usZU6trA1P0-'} _1sKdg4-6_xRyPxMt0eRvaf">${esc(phase)}</div><div class="${classes.PlayBarDetailLabel || '_2TYVGoD27ZMfjRirKQNLfk'} _2pGX3XXztz624QfCJElgkR">${esc(t('progress', { p: pctText }))}<div role="progressbar" aria-valuenow="${Math.round(pct)}" class="${classes.DetailsProgressContainer || '_25YVDTaClw6Y2COPsU0UaV'} QyUkuqzAvp-ZDqgTGHAry"><div class="${classes.DetailsProgressBar || '_1FnTqlsi2_-TJf1d5apoS6'}" style="width: ${pct}%;"></div></div></div></div>`;
	// Espaço necessário: o mesmo item de estatística da Steam, no lugar da "Nuvem" (que só volta com o jogo instalado).
	const size = Number(st.sizeBytes) || 0;
	const needed = `<div class="${classes.GameStat || '_1kiZKVbDe-9Ikootk57kpA'} ${classes.LastPlayed || '_3pS8kMrtScuY1Qf-W8tmRV'} Panel" data-taiga-needed="1"><div class="${classes.GameStatRight || '_3m_zjRTQBqcfzCjXLXUHcR'}"><div class="${classes.PlayBarLabel || '_34lrt5-Fc3usZU6trA1P0-'}">${esc(t('needed'))}</div><div class="${classes.PlayBarDetailLabel || '_2TYVGoD27ZMfjRirKQNLfk'} ${classes.LastPlayedInfo || '_1nfJNsQjTOXSQQyFahGnRi'}">${esc(size ? gb(size) : t('calculating'))}</div></div></div>`;
	if (!size && st.store === 'epic' && st.state === 'none' && !sizeAsked.has(id)) { sizeAsked.add(id); infoCall({ shortcut_app_id: String(id), wait: true }).then(raw => { const v = JSON.parse(raw) as InstallState; if (v.sizeBytes) { const hit = cache.get(id); if (hit) hit.value = { ...hit.value, sizeBytes: v.sizeBytes }; } }).catch(() => {}); }
	const info = installing || paused ? progress
		: external ? `<div style="display:flex;flex-direction:column;gap:4px;">${small(xbox ? t('externalXbox') : t('externalEpic'))}</div>`
		: error ? `<div style="display:flex;flex-direction:column;gap:4px;max-width:420px;">${small(t('error'), '#ff8a8a')}<div style="font-size:12px;color:#c6c7c8;line-height:1.35;" title="${esc(st.error || '')}">${esc(errorText(st))}</div></div>`
		: st.store === 'epic' ? needed : small(t('notInstalled'));
	const key = [st.state, st.phase, Math.round(pct * 10), st.store, st.error, st.errorCode, st.sizeBytes || 0, displayLanguage()].join('|');
	if (box.dataset.key === key) return;
	box.dataset.key = key;
	box.innerHTML = steamButton(icon, label, act, t('menu')) + `<div data-taiga-info="1" style="min-width:0;">${info}</div>`;
	ensureFallbackStyle(box);
	alignInfo(box);
	// Barra de progresso sem o CSS da Steam (classes mudaram): desenha uma barra fina igual à dela.
	const bar = box.querySelector<HTMLElement>('[role="progressbar"]');
	if (bar && bar.getBoundingClientRect().height < 1) {
		bar.style.cssText = 'height:4px;margin-top:6px;width:200px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden;';
		const fill = bar.firstElementChild as HTMLElement | null; if (fill) { fill.style.height = '100%'; fill.style.background = 'linear-gradient(to right,#47bfff,#1a9fff)'; }
		const lbl = box.querySelector<HTMLElement>('[data-taiga-progress] > div'); if (lbl && doc.defaultView?.getComputedStyle(lbl).textTransform !== 'uppercase') { lbl.style.textTransform = 'uppercase'; lbl.style.fontSize = '12px'; lbl.style.color = '#8f98a0'; }
	}
	for (const el of Array.from(box.querySelectorAll<HTMLElement>('[data-taiga-act]'))) {
		const run = (event: Event) => {
			event.preventDefault(); event.stopPropagation();
			const what = el.dataset.taigaAct || '';
			if (what === 'menu') { openMenu(doc, el, id, st); return; }
			if (what === 'start' && st.store === 'epic' && st.method !== 'launcher' && (st.state === 'none' || st.state === 'error')) { void openInstallDialog(doc, id); return; }
			void act2(id, what as 'start' | 'pause', el);
		};
		el.addEventListener('click', run);
		el.addEventListener('keydown', (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') run(event); });
	}
}

// Menu da setinha: cancelar a instalação e outros jeitos de instalar.
function openMenu(doc: Document, anchor: HTMLElement, id: number, st: InstallState): void {
	const old = doc.querySelector('[data-taiga-menu]'); if (old) { old.remove(); return; }
	const items: Array<[string, string]> = [];
	if (st.state === 'installing' || st.state === 'paused' || st.state === 'external') items.push(['cancel', t('cancelInstall')]);
	if (st.store === 'epic' && st.state !== 'installing') items.push(st.method === 'launcher' ? ['taiga', t('viaTaiga')] : ['launcher', t('viaEpic')]);
	if (st.store === 'xbox') items.push(['start', t('openXbox')]);
	if (!items.length) return;
	const r = anchor.getBoundingClientRect();
	const menu = doc.createElement('div');
	menu.dataset.taigaMenu = '1';
	menu.style.cssText = `position:fixed;left:${Math.round(r.left)}px;top:${Math.round(r.bottom + 4)}px;z-index:9999;min-width:240px;background:#3d4450;box-shadow:0 8px 24px rgba(0,0,0,.55);padding:4px 0;font-size:14px;color:#dcdedf;`;
	menu.innerHTML = items.map(([a, l]) => `<div role="menuitem" tabindex="0" class="Focusable" data-taiga-menu-act="${a}" style="padding:9px 16px;cursor:pointer;white-space:nowrap;">${esc(l)}</div>`).join('');
	for (const it of Array.from(menu.querySelectorAll<HTMLElement>('[data-taiga-menu-act]'))) {
		it.addEventListener('mouseenter', () => { it.style.background = '#dcdedf'; it.style.color = '#3d4450'; });
		it.addEventListener('mouseleave', () => { it.style.background = ''; it.style.color = ''; });
		it.addEventListener('click', event => {
			event.preventDefault(); event.stopPropagation(); menu.remove();
			const a = it.dataset.taigaMenuAct || '';
			void act2(id, a === 'cancel' ? 'cancel' : a === 'launcher' ? 'launcher' : a === 'taiga' ? 'taiga' : 'start', anchor);
		});
	}
	doc.body.appendChild(menu);
	const close = (event: Event) => { if (!menu.contains(event.target as Node)) { menu.remove(); doc.removeEventListener('mousedown', close, true); } };
	setTimeout(() => doc.addEventListener('mousedown', close, true), 0);
}

async function act2(id: number, what: 'start' | 'pause' | 'cancel' | 'launcher' | 'taiga', el: HTMLElement): Promise<void> {
	if (el.dataset.busy === '1') return;
	el.dataset.busy = '1'; el.style.opacity = '.6';
	try {
		const raw = what === 'cancel' ? await cancelCall({ shortcut_app_id: String(id) })
			: what === 'pause' ? await pauseCall({ shortcut_app_id: String(id) })
			: await startCall({ shortcut_app_id: String(id), ...(what === 'launcher' ? { via: 'launcher' } : what === 'taiga' ? { via: 'legendary' } : {}) });
		const value = JSON.parse(raw) as InstallState;
		cache.set(id, { at: Date.now(), value });
		if (value.state === 'error' && value.error) backendLog('Taiga instalar: ' + value.error);
	} catch (e) { backendLog('Taiga instalar falhou: ' + e); }
	finally { el.dataset.busy = '0'; el.style.opacity = ''; knownAt = 0; void tick(true); }
}

// Atalhos de jogos não instalados (lista do Taiga Launcher). A página só faz algo nesses jogos: nos outros não há
// consulta nenhuma ao programa.
const known = new Map<number, InstallState>();
// Jogo de loja ainda não instalado (sem "Nuvem" na página: ela só aparece quando o jogo pode ser jogado).
export function isStoreInstallPending(id: number): boolean { return known.has(Number(id) >>> 0); }
let knownAt = 0;
async function refreshKnown(): Promise<void> {
	try { const r = JSON.parse(await idsCall()) as { items?: Array<InstallState & { id: number }> }; known.clear(); for (const it of r.items || []) known.set(Number(it.id) >>> 0, it); knownAt = Date.now(); } catch {}
}
let lastId = 0;
// Parte síncrona: roda logo que a Steam monta a página (antes de desenhar), então o JOGAR verde não chega a aparecer.
function syncPage(doc: Document): number {
	const id = routedSteamAppId(doc) || 0;
	if (id !== lastId) { const old = doc.querySelector('[data-taiga-menu]'); old?.remove(); }
	lastId = id;
	if (!id || !known.has(id)) { if (doc.querySelector('[data-taiga-install], [data-taiga-hidden="1"]')) restore(doc); return 0; }
	const st = cache.get(id)?.value || known.get(id)!;
	if (st.state === 'installed') { restore(doc); return 0; }
	render(doc, id, st);
	return id;
}
async function tick(force = false): Promise<void> {
	if (busy) return; busy = true;
	try {
		const doc = desktopDocument();
		if (!doc) return;
		if (Date.now() - knownAt > 60000) await refreshKnown();
		const id = syncPage(doc);
		if (!id) return;
		const st = await fetchState(id, force);
		if (!st || routedSteamAppId(doc) !== id) return;
		if (st.state === 'installed' || st.state === 'unknown') { known.delete(id); restore(doc); return; }
		known.set(id, st);
		render(doc, id, st);
	} catch (e) { backendLog('Taiga instalar (página): ' + e); }
	finally { busy = false; }
}

let observer: MutationObserver | null = null, observedDoc: Document | null = null, queued = false;
function watch(doc: Document): void {
	if (observedDoc === doc && observer) return;
	observer?.disconnect();
	observedDoc = doc;
	const View = (doc.defaultView as any)?.MutationObserver || MutationObserver;
	observer = new View(() => {
		// Só reage em página de jogo não instalado (ou para limpar ao sair dela); o resto da Steam não é tocado.
		if (queued) return;
		const id = routedSteamAppId(doc) || 0;
		if (!known.has(id) && !(lastId && known.has(lastId))) return;
		queued = true;
		queueMicrotask(() => { queued = false; try { syncPage(doc); } catch {} });
	});
	observer!.observe(doc.body, { childList: true, subtree: true });
}

export function startStoreInstallUi(): void {
	if (timer) clearInterval(timer);
	void refreshKnown().then(() => { const doc = desktopDocument(); if (doc) { watch(doc); void tick(true); } });
	// 1 s: progresso do download e troca de janela da Steam; sem jogo não instalado aberto, não faz nada.
	timer = setInterval(() => { const doc = desktopDocument(); if (!doc) return; watch(doc); if (known.has(routedSteamAppId(doc) || 0) || Date.now() - knownAt > 60000) void tick(); }, 1000);
}
export function stopStoreInstallUi(): void {
	if (timer) clearInterval(timer);
	timer = null;
	observer?.disconnect(); observer = null; observedDoc = null;
	const doc = desktopDocument(); if (doc) restore(doc);
}

// ── Janela "Instalar" (o mesmo HTML da Steam): disco/pasta, espaço livre e atalhos ──
const SVG_CHECK = (n: number) => `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_DialogCheck" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256"><defs><linearGradient id="taiga_ck_${n}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00ccff"></stop><stop offset="100%" stop-color="#2d73ff"></stop></linearGradient><filter id="taiga_ckf_${n}" x="0" y="0" width="200%" height="200%"><feOffset result="offOut" in="SourceAlpha" dx="20" dy="20"></feOffset><feGaussianBlur result="blurOut" in="offOut" stdDeviation="10"></feGaussianBlur><feBlend in="SourceGraphic" in2="blurOut" mode="normal"></feBlend></filter></defs><path fill="none" stroke="url(#taiga_ck_${n})" stroke-width="24" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="10" d="M206.5,45.25L95,210.75l-45.5-63" stroke-dasharray="365.19 365.19" stroke-dashoffset="0.00"></path><path fill="none" opacity=".2" filter="url(#taiga_ckf_${n})" stroke="url(#taiga_ck_${n})" stroke-width="24" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="10" d="M206.5,45.25L95,210.75l-45.5-63" stroke-dasharray="365.19 365.19" stroke-dashoffset="0.00"></path></svg>`;
const SVG_X = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_X_Line" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256"><line fill="none" stroke="#FFFFFF" stroke-width="45" stroke-miterlimit="10" x1="212" y1="212" x2="44" y2="44"></line><line fill="none" stroke="#FFFFFF" stroke-width="45" stroke-miterlimit="10" x1="44" y1="212" x2="212" y2="44"></line></svg>';
const SVG_GEAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path d="M33 20.38V15.62L29.07 14.9C28.8121 14.015 28.453 13.1628 28 12.36L30.27 9.08L26.92 5.71L23.64 8C22.8372 7.54696 21.985 7.18793 21.1 6.93L20.38 3H15.62L14.9 6.93C14.015 7.18793 13.1628 7.54696 12.36 8L9.08 5.71L5.71 9.08L8 12.36C7.54696 13.1628 7.18793 14.015 6.93 14.9L3 15.62V20.38L6.93 21.1C7.18793 21.985 7.54696 22.8372 8 23.64L5.71 26.92L9.08 30.29L12.36 28C13.1637 28.4461 14.0159 28.7984 14.9 29.05L15.62 33H20.38L21.1 29.07C21.985 28.8121 22.8372 28.453 23.64 28L26.92 30.27L30.29 26.9L28 23.64C28.4461 22.8363 28.7984 21.9841 29.05 21.1L33 20.38ZM18 23C17.0111 23 16.0444 22.7068 15.2221 22.1573C14.3999 21.6079 13.759 20.827 13.3806 19.9134C13.0022 18.9998 12.9031 17.9945 13.0961 17.0245C13.289 16.0546 13.7652 15.1637 14.4645 14.4645C15.1637 13.7652 16.0546 13.289 17.0245 13.0961C17.9945 12.9031 18.9998 13.0022 19.9134 13.3806C20.827 13.759 21.6079 14.3999 22.1573 15.2221C22.7068 16.0444 23 17.0111 23 18C23 18.6566 22.8707 19.3068 22.6194 19.9134C22.3681 20.52 21.9998 21.0712 21.5355 21.5355C21.0712 21.9998 20.52 22.3681 19.9134 22.6194C19.3068 22.8707 18.6566 23 18 23Z" fill="currentColor"></path></svg>';
const SVG_WARN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M5.37033 3.07108C6.74074 2.15541 8.35191 1.66666 10.0001 1.66666C11.0944 1.66666 12.1781 1.88221 13.1891 2.301C14.2002 2.71979 15.1188 3.33362 15.8926 4.10744C16.6665 4.88126 17.2803 5.79992 17.6991 6.81097C18.1179 7.82202 18.3334 8.90565 18.3334 10C18.3334 11.6482 17.8447 13.2593 16.929 14.6297C16.0133 16.0002 14.7118 17.0683 13.1891 17.699C11.6664 18.3297 9.99084 18.4948 8.37433 18.1732C6.75782 17.8517 5.27297 17.058 4.10753 15.8926C2.94209 14.7271 2.14842 13.2423 1.82687 11.6258C1.50533 10.0092 1.67036 8.33369 2.30109 6.81097C2.93182 5.28825 3.99992 3.98676 5.37033 3.07108ZM12.2223 5L11.389 10H8.61119L7.77786 5H12.2223ZM11.9445 13.0556C11.9445 14.1294 11.074 15 10.0001 15C8.92619 15 8.05564 14.1294 8.05564 13.0556C8.05564 11.9817 8.92619 11.1111 10.0001 11.1111C11.074 11.1111 11.9445 11.9817 11.9445 13.0556Z"></path></svg>';
const SVG_STAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path d="M18 3L22.77 13.03L33.77 14.46L25.73 22.11L27.75 33L18 27.72L8.24998 33L10.28 22.11L2.22998 14.46L13.23 13.03L18 3Z" fill="currentColor"></path></svg>';
const SVG_DISK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M33 19.9286H3L7.35714 6H28.6429L33 19.9286ZM3 31.7143V24.2143H33V31.7143H3ZM21.0952 26.1826C21.4476 25.9471 21.8619 25.8214 22.2857 25.8214C22.854 25.8214 23.3991 26.0472 23.8009 26.4491C24.2028 26.8509 24.4286 27.396 24.4286 27.9643C24.4286 28.3881 24.3029 28.8024 24.0674 29.1548C23.832 29.5072 23.4973 29.7818 23.1058 29.944C22.7142 30.1062 22.2833 30.1486 21.8677 30.066C21.452 29.9833 21.0702 29.7792 20.7705 29.4795C20.4708 29.1798 20.2667 28.798 20.184 28.3823C20.1013 27.9667 20.1438 27.5358 20.306 27.1442C20.4682 26.7527 20.7428 26.418 21.0952 26.1826ZM28.7143 25.8214C28.2905 25.8214 27.8762 25.9471 27.5238 26.1826C27.1714 26.418 26.8967 26.7527 26.7345 27.1442C26.5724 27.5358 26.5299 27.9667 26.6126 28.3823C26.6953 28.798 26.8994 29.1798 27.1991 29.4795C27.4987 29.7792 27.8806 29.9833 28.2962 30.066C28.7119 30.1486 29.1428 30.1062 29.5343 29.944C29.9259 29.7818 30.2605 29.5072 30.496 29.1548C30.7315 28.8024 30.8571 28.3881 30.8571 27.9643C30.8571 27.396 30.6314 26.8509 30.2295 26.4491C29.8277 26.0472 29.2826 25.8214 28.7143 25.8214Z" fill="currentColor"></path></svg>';
let checkSeq = 0;
// Estilo reserva da janela, usado só se a Steam não tiver as classes (por exemplo, depois de uma atualização dela).
const FALLBACK_CSS = `
[data-taiga-modal] .DialogContent{background:radial-gradient(circle at top left,rgba(74,81,92,.4) 0%,rgba(75,81,92,0) 60%),#25282e;color:#dcdedf;padding:28px 30px 24px;box-shadow:0 0 30px rgba(0,0,0,.6);font-family:"Motiva Sans",Arial,sans-serif}
[data-taiga-modal] .ModalPosition_Dismiss{position:absolute;right:14px;top:14px;z-index:2}[data-taiga-modal] .closeButton svg{width:14px;height:14px;cursor:pointer;opacity:.7}
[data-taiga-modal] .DialogHeader{font-size:28px;font-weight:700;color:#fff;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.12)}
[data-taiga-modal] ._3MJEANCb5PkduXTSJ6o3bq{display:flex;align-items:center;gap:20px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.12)}
[data-taiga-modal] ._3MJEANCb5PkduXTSJ6o3bq img{height:50px;display:block}[data-taiga-modal] ._1_JaK7j-59AgDKQOOOJVBA{flex:1;font-size:20px;color:#dcdedf}[data-taiga-modal] .I_nktXyVJHrZEc6dPTTnU{font-weight:700;font-size:14px}
[data-taiga-modal] ._27EB_QZeH3i0zloLWPdw84{display:flex;gap:26px;padding:18px 0 26px}
[data-taiga-modal] .DialogCheckbox_Container{display:flex;align-items:center;gap:12px;cursor:pointer;font-size:16px}
[data-taiga-modal] .DialogCheckbox{width:26px;height:26px;background:#1d2128;border-radius:2px;display:flex;align-items:center;justify-content:center}[data-taiga-modal] .DialogCheckbox svg{width:22px;height:22px}
[data-taiga-modal] .NtxG7ioEuQKxrtXEy57H5{display:flex;align-items:center;justify-content:space-between;text-transform:uppercase;font-weight:700;font-size:14px;margin-bottom:8px}
[data-taiga-modal] .DialogButton._2pnPQKKjSPKgzPwlaXMqu_{min-width:0;width:38px;height:38px;padding:0;border:none;background:#3d4450;color:#fff;cursor:pointer}[data-taiga-modal] ._2pnPQKKjSPKgzPwlaXMqu_ svg{width:22px;height:22px}
[data-taiga-modal] .Oo5JPcEk_erKEYAzYp2nY{display:flex;align-items:center;gap:14px;padding:0 20px;height:56px;margin-top:6px;background:#3d4450;cursor:pointer;font-size:20px}
[data-taiga-modal] .gkgG-dWgjpwS_aqlcMNTM{background:#1a9fff;color:#fff}[data-taiga-modal] ._1p727K-lt5u7dR3PbUTcNZ svg{width:20px;height:20px;display:block}
[data-taiga-modal] ._2vs_5hKYSMZTn7dKHTim5D{flex:1}[data-taiga-modal] ._VEHWl9XgUCHDV7oGKSW4 svg{width:18px;height:18px;display:block}[data-taiga-modal] ._3a3KjxO7NqnVAjxtVypiCk{font-size:14px;font-weight:700;text-transform:uppercase}
[data-taiga-modal] .bhL5Q352pNmO44_JjKZTX{color:#ffc82c}[data-taiga-modal] .gkgG-dWgjpwS_aqlcMNTM .bhL5Q352pNmO44_JjKZTX{color:#ffc82c}
[data-taiga-modal] .WonjNtnAq8aOefGl_x2v4{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;text-transform:uppercase;font-weight:700;font-size:14px}
[data-taiga-modal] .DialogTwoColLayout{display:flex;gap:18px;justify-content:flex-end;margin-top:40px}
[data-taiga-modal] .DialogButton{min-width:250px;height:40px;border:none;color:#fff;font-size:16px;background:#3d4450;cursor:pointer}[data-taiga-modal] .DialogButton.Primary{background:linear-gradient(to right,#47bfff 5%,#1a44c2 60%)}[data-taiga-modal] .DialogButton.Disabled{background:#2a2f37;color:#5d6066;cursor:default}
`;

interface DialogOption { key: string; name: string; dir: string; free: number; default: boolean; enough: boolean }

async function openInstallDialog(doc: Document, id: number): Promise<void> {
	if (doc.querySelector('[data-taiga-modal]')) return;
	let info: InstallState;
	try { info = JSON.parse(await infoCall({ shortcut_app_id: String(id) })) as InstallState; } catch (e) { backendLog('Taiga instalar (janela): ' + e); return; }
	const options: DialogOption[] = (info.drives || []).map(d => ({ key: d.letter, name: (d.label ? d.label + ' ' : '') + '(' + d.letter + ')', dir: d.dir, free: d.free, default: d.default, enough: d.enough }));
	if (!options.length) { void act2(id, 'start', doc.body); return; }
	let size = Number(info.sizeBytes) || 0, selected = Math.max(0, options.findIndex(o => o.default)), desktop = true, startMenu = true;
	const enough = (o: DialogOption) => !size || o.free > size;
	const overlay = doc.createElement('div');
	overlay.dataset.taigaModal = '1';
	overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);';
	const close = () => { overlay.remove(); doc.removeEventListener('keydown', onKey, true); };
	const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
	const n1 = ++checkSeq, n2 = ++checkSeq;
	const checkbox = (key: string, label: string, on: boolean, n: number) => `<div role="checkbox" aria-checked="${on}" class="DialogCheckbox_Container _DialogLayout  Panel" tabindex="0" data-taiga-check="${key}"><div class="DialogCheckbox${on ? ' Active' : ''}">${on ? SVG_CHECK(n) : ''}</div><div class="DialogToggle_Label"><span>${esc(label)}</span></div><div style="clear: left;"></div></div>`;
	const rows = () => options.map((o, i) => {
		const sel = i === selected, ok = enough(o);
		return `<div class="Oo5JPcEk_erKEYAzYp2nY${sel ? ' gkgG-dWgjpwS_aqlcMNTM' : ''} Panel" tabindex="0" role="button" data-taiga-drive="${i}" title="${esc(o.dir)}"><div class="_1p727K-lt5u7dR3PbUTcNZ${ok ? '' : ' bhL5Q352pNmO44_JjKZTX'}">${ok ? SVG_DISK : SVG_WARN}</div><div class="_2vs_5hKYSMZTn7dKHTim5D${sel ? ' _3WMFKYH3gPd8T5RGPjpUah' : ''}">${esc(o.name)}</div>${o.default ? `<div class="_VEHWl9XgUCHDV7oGKSW4">${SVG_STAR}</div>` : ''}<div class="_3a3KjxO7NqnVAjxtVypiCk _3lAxXofku7q3P5FhXRfqH0">${esc(t('free', { n: gb(o.free) }))}</div></div>`;
	}).join('');
	const draw = () => {
		const sel = options[selected], ok = enough(sel);
		overlay.innerHTML = `<div class="ModalPosition_Content" style="position:relative;width:684px;max-width:92vw;"><div class="ModalPosition_TopBar"></div><div class="ModalPosition_Dismiss"><div class="closeButton" data-taiga-close="1" role="button" tabindex="0">${SVG_X}</div></div><div role="dialog" aria-label="${esc(t('dlgTitle'))}" class="DialogContent _DialogLayout _3wtPUBfilFITcl1s4u6A7T"><div class="DialogContent_InnerWidth"><div role="heading" aria-level="2" class="DialogHeader">${esc(t('dlgTitle'))}</div><div class="DialogBody"><div class="DialogBodyText"><div class="Krg05lMwvNmhhVXhqdleu"><div class="_3MJEANCb5PkduXTSJ6o3bq"><div class="_1R9r2OBCxAmtuUVrgBEUBw _2E7G8grj_-tgxXbTXs1t2E ZsU8nIIpj8MJn0vzMzSp1 _3mitVrK37Z0VhEoNSmfjT8">${info.header ? `<img class="_24_AuLm54JVe1Zc0AApCDR _3d_bT685lnWotXxgzKW6am yDr03475kalWBTwAE-Rnw" src="${info.header}">` : ''}</div><div class="_1_JaK7j-59AgDKQOOOJVBA">${esc(info.title || '')}</div><div class="I_nktXyVJHrZEc6dPTTnU _3lAxXofku7q3P5FhXRfqH0">${esc(size ? gb(size, 1) : t('calculating'))}</div></div></div><div class="_27EB_QZeH3i0zloLWPdw84">${checkbox('desktop', t('desktop'), desktop, n1)}${checkbox('startMenu', t('startMenu'), startMenu, n2)}</div><div class="vaNI84b_TV6hw20mhGl_d"><div class="NtxG7ioEuQKxrtXEy57H5">${esc(t('installIn'))}<button type="button" class="_2pnPQKKjSPKgzPwlaXMqu_ DialogButton _DialogLayout Secondary Focusable" role="button" title="${esc(t('otherFolder'))}" data-taiga-folder="1"><div class="tool-tip-source Focusable">${SVG_GEAR}</div></button></div><div><div>${rows()}</div></div></div>${ok ? '' : `<div class="WonjNtnAq8aOefGl_x2v4 bhL5Q352pNmO44_JjKZTX"><div class="_1p727K-lt5u7dR3PbUTcNZ bhL5Q352pNmO44_JjKZTX">${SVG_WARN}</div><span>${esc(t('noSpace'))}</span></div>`}</div><div class="DialogFooter"><div class="DialogTwoColLayout _DialogColLayout Panel"><button type="button" class="DialogButton _DialogLayout Primary${ok ? '' : ' Disabled'} Focusable" role="button" data-taiga-go="1"${ok ? '' : ' disabled'}>${esc(t('dlgInstall'))} </button><button type="button" class="DialogButton _DialogLayout Secondary Focusable" role="button" data-taiga-close="1">${esc(t('dlgCancel'))}</button></div></div></div></div></div></div>`;
		// Se a Steam mudar as classes numa atualização, a janela continua legível com um estilo próprio.
		const box = overlay.querySelector<HTMLElement>('.DialogContent'), view = doc.defaultView;
		if (box && view && /rgba\(0, 0, 0, 0\)|transparent/.test(view.getComputedStyle(box).backgroundColor) && view.getComputedStyle(box).backgroundImage === 'none') {
			const style = doc.createElement('style'); style.textContent = FALLBACK_CSS; overlay.prepend(style);
		}
		for (const el of Array.from(overlay.querySelectorAll<HTMLElement>('[data-taiga-close]'))) el.addEventListener('click', e => { e.preventDefault(); close(); });
		for (const el of Array.from(overlay.querySelectorAll<HTMLElement>('[data-taiga-drive]'))) el.addEventListener('click', e => { e.preventDefault(); selected = Number(el.dataset.taigaDrive) || 0; draw(); });
		for (const el of Array.from(overlay.querySelectorAll<HTMLElement>('[data-taiga-check]'))) el.addEventListener('click', e => { e.preventDefault(); if (el.dataset.taigaCheck === 'desktop') desktop = !desktop; else startMenu = !startMenu; draw(); });
		overlay.querySelector<HTMLElement>('[data-taiga-folder]')?.addEventListener('click', async e => {
			e.preventDefault();
			try {
				const r = JSON.parse(await pickFolderCall()) as { path?: string };
				if (!r.path) return;
				const letter = r.path.slice(0, 2).toUpperCase(), base = options.find(o => o.key === letter);
				options.push({ key: 'dir:' + r.path, name: r.path, dir: r.path, free: base?.free || 0, default: false, enough: true });
				selected = options.length - 1; draw();
			} catch {}
		});
		overlay.querySelector<HTMLElement>('[data-taiga-go]')?.addEventListener('click', async e => {
			e.preventDefault();
			const o = options[selected]; if (!enough(o)) return;
			close();
			try {
				const raw = await startWithCall({ shortcut_app_id: String(id), dir: o.dir, desktop, start_menu: startMenu });
				cache.set(id, { at: Date.now(), value: JSON.parse(raw) as InstallState });
			} catch (err) { backendLog('Taiga instalar falhou: ' + err); }
			void tick(true);
		});
	};
	doc.body.appendChild(overlay);
	draw();
	doc.addEventListener('keydown', onKey, true);
	// Tamanho ainda desconhecido: a janela abre na hora e o tamanho entra assim que a Epic responder.
	if (!size) infoCall({ shortcut_app_id: String(id), wait: true }).then(raw => { const v = JSON.parse(raw) as InstallState; if (v.sizeBytes && overlay.isConnected) { size = Number(v.sizeBytes); draw(); } }).catch(() => {});
}

// Taiga Launcher: parte de baixo da página dos jogos sem página na Steam (emuladores, ports).
//  - Na linha do tempo: sua atividade no jogo (conquistas por dia, sessões e marcos), com os dados do Taiga Launcher.
//  - Abaixo dela: trailers e capturas de tela (IGDB) e "Se você gosta deste jogo" (jogos parecidos).
// Tudo o que vem de fora é escrito como texto ou atributo escapado; vídeos só pelo código do YouTube (11 caracteres);
// imagens servidas pelo próprio Taiga Launcher (127.0.0.1).
import { callable } from '@steambrew/client';
import { displayLanguage, gdlText } from '../../../steam/localization';
import { navigateToLibraryShortcut } from '../../../steam/navigation';
import { isTaigaVirtualAppId } from '../../../core/taiga';
import { applyUnifiedActivityFeed, getRetainedActivityNews } from './feed';
import type { NewsItem } from '../../../domain/types';

const extrasCall = callable<[{ shortcut_app_id: string; wait?: boolean }], string>('taiga_game_extras');

export interface TaigaActivity { kind: 'achievements' | 'milestone' | 'session'; at: number; count?: number; progress?: number; total?: number; type?: 'half' | 'complete' | 'first'; seconds?: number; items?: Array<{ title: string; icon: string }> }
interface Extras { enabled: boolean; activity: TaigaActivity[]; videos: Array<{ id: string; name: string; thumb: string }>; shots: string[]; similar: Array<{ name: string; cover: string; year: number | null; family?: boolean; shortcut: number | null }>; pending?: boolean }

const TEXT: Record<string, Record<string, string>> = {
	pt: { achOne: 'Você desbloqueou uma conquista', achMany: 'Você desbloqueou {n} conquistas', progress: '{p} de {t} conquistas', half: 'Metade das conquistas desbloqueadas', complete: 'Todas as conquistas desbloqueadas!', first: 'Primeira vez jogando', session: 'Você jogou por {d}', sessions: '{n} sessões', tagAch: 'Conquistas', tagMilestone: 'Marco', tagSession: 'Sessão de jogo', media: 'Imagens', similar: 'Se você gosta deste jogo', owned: 'Na sua coleção', series: 'Mesma série', trailer: 'Trailer', close: 'Fechar', prev: 'Anterior', next: 'Próxima', and: 'e mais {n}' },
	en: { achOne: 'You unlocked an achievement', achMany: 'You unlocked {n} achievements', progress: '{p} of {t} achievements', half: 'Half of the achievements unlocked', complete: 'All achievements unlocked!', first: 'First time playing', session: 'You played for {d}', sessions: '{n} sessions', tagAch: 'Achievements', tagMilestone: 'Milestone', tagSession: 'Play session', media: 'Images', similar: 'If you like this game', owned: 'In your collection', series: 'Same series', trailer: 'Trailer', close: 'Close', prev: 'Previous', next: 'Next', and: 'and {n} more' },
	es: { achOne: 'Desbloqueaste un logro', achMany: 'Desbloqueaste {n} logros', progress: '{p} de {t} logros', half: 'La mitad de los logros desbloqueados', complete: '¡Todos los logros desbloqueados!', first: 'Primera vez jugando', session: 'Jugaste {d}', sessions: '{n} sesiones', tagAch: 'Logros', tagMilestone: 'Hito', tagSession: 'Sesión de juego', media: 'Imágenes', similar: 'Si te gusta este juego', owned: 'En tu colección', series: 'Misma saga', trailer: 'Tráiler', close: 'Cerrar', prev: 'Anterior', next: 'Siguiente', and: 'y {n} más' },
	fr: { achOne: 'Vous avez débloqué un succès', achMany: 'Vous avez débloqué {n} succès', progress: '{p} sur {t} succès', half: 'La moitié des succès débloqués', complete: 'Tous les succès débloqués !', first: 'Première partie', session: 'Vous avez joué {d}', sessions: '{n} sessions', tagAch: 'Succès', tagMilestone: 'Étape', tagSession: 'Session de jeu', media: 'Images', similar: 'Si vous aimez ce jeu', owned: 'Dans votre collection', series: 'Même série', trailer: 'Bande-annonce', close: 'Fermer', prev: 'Précédente', next: 'Suivante', and: 'et {n} de plus' },
	de: { achOne: 'Du hast einen Erfolg freigeschaltet', achMany: 'Du hast {n} Erfolge freigeschaltet', progress: '{p} von {t} Erfolgen', half: 'Die Hälfte der Erfolge freigeschaltet', complete: 'Alle Erfolge freigeschaltet!', first: 'Zum ersten Mal gespielt', session: 'Du hast {d} gespielt', sessions: '{n} Sitzungen', tagAch: 'Erfolge', tagMilestone: 'Meilenstein', tagSession: 'Spielsitzung', media: 'Bilder', similar: 'Wenn dir dieses Spiel gefällt', owned: 'In deiner Sammlung', series: 'Gleiche Reihe', trailer: 'Trailer', close: 'Schließen', prev: 'Zurück', next: 'Weiter', and: 'und {n} weitere' },
};
function langKey(): string {
	const l = displayLanguage();
	return /^(brazilian|portuguese)/.test(l) ? 'pt' : /^(spanish|latam)/.test(l) ? 'es' : /^french/.test(l) ? 'fr' : /^german/.test(l) ? 'de' : 'en';
}
function t(key: string, values: Record<string, string | number> = {}): string {
	let s = (TEXT[langKey()] || TEXT.en)[key] || TEXT.en[key] || key;
	for (const [k, v] of Object.entries(values)) s = s.replace('{' + k + '}', String(v));
	return s;
}
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const safeImg = (url: unknown): string => { const u = String(url || ''); return /^https:\/\/[^\s"'<>]+$/.test(u) || /^http:\/\/127\.0\.0\.1:\d+\/art\/[a-f0-9]+\.(?:png|jpg|ico)$/.test(u) ? u : ''; };
function duration(seconds: number): string {
	const m = Math.max(1, Math.round(seconds / 60)), h = Math.floor(m / 60), r = m % 60;
	return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${m} min`;
}

// ── dados (um pedido por jogo; o resto vem da cópia em memória) ──
const cache = new Map<string, { at: number; data: Extras | null; loading: Promise<void> | null; retried: boolean }>();
const listeners = new Set<(shortcutAppId: string) => void>();
function load(shortcutAppId: string, wait = false): Promise<void> {
	let row = cache.get(shortcutAppId);
	if (!row) { row = { at: 0, data: null, loading: null, retried: false }; cache.set(shortcutAppId, row); }
	if (row.loading) return row.loading;
	const entry = row;
	entry.loading = (async () => {
		try {
			const data = JSON.parse(await extrasCall({ shortcut_app_id: shortcutAppId, ...(wait ? { wait: true } : {}) })) as Extras;
			const before = JSON.stringify(entry.data);
			entry.data = data && typeof data === 'object' ? data : null; entry.at = Date.now();
			if (JSON.stringify(entry.data) !== before) for (const l of listeners) { try { l(shortcutAppId); } catch {} }
			// Trailers e imagens ainda sendo buscados: pede de novo uma vez, esperando um pouco.
			if (entry.data?.pending && !entry.retried) { entry.retried = true; setTimeout(() => { void load(shortcutAppId, true); }, 2500); }
		} catch { entry.at = Date.now(); }
		finally { entry.loading = null; }
	})();
	return entry.loading;
}
function current(shortcutAppId: string | null | undefined): Extras | null {
	const id = String(shortcutAppId || ''); if (!/^\d+$/.test(id)) return null;
	const row = cache.get(id);
	if (!row || (!row.loading && Date.now() - row.at > 60000)) void load(id);
	return row?.data?.enabled ? row.data : null;
}

/** Itens da linha do tempo para o feed (só jogos do Taiga sem página na Steam). */
export function taigaActivityFor(steamAppId: string, shortcutAppId: string | null | undefined): TaigaActivity[] {
	if (!isTaigaVirtualAppId(steamAppId)) return [];
	// Taiga Launcher: só os cartões das conquistas (os marcos "metade" e "todas" saíram da atividade).
	return (current(shortcutAppId)?.activity || []).filter(a => a.kind === 'achievements');
}
export function taigaActivitySignature(steamAppId: string, shortcutAppId: string | null | undefined): string {
	if (!isTaigaVirtualAppId(steamAppId)) return '';
	const a = cache.get(String(shortcutAppId || ''))?.data?.activity || [];
	return a.length + ':' + a.map(x => x.kind + x.at + (x.count || 0) + (x.seconds || 0)).join(',');
}

const ICONS = {
	trophy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 3V2H7v1H3v4a4 4 0 0 0 4 4h.4A5 5 0 0 0 11 13.9V17H8v3h8v-3h-3v-3.1A5 5 0 0 0 16.6 11h.4a4 4 0 0 0 4-4V3h-4ZM5 7V5h2v4a2 2 0 0 1-2-2Zm14 0a2 2 0 0 1-2 2V5h2v2Z"/></svg>',
	star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6 12 2Z"/></svg>',
	play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>',
	clock: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.4l4 2.4-1 1.7-5-3V7h2Z"/></svg>',
};

/** HTML de um item da linha do tempo (escapado). */
export function renderTaigaActivity(item: TaigaActivity): string {
	if (item.kind === 'achievements') {
		const items = (item.items || []).slice(0, 8);
		const more = Math.max(0, (item.count || 0) - items.length);
		const icons = items.map(a => { const src = safeImg(a.icon); return `<span class="taiga-ta-ach" title="${esc(a.title)}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ICONS.trophy}</span>`; }).join('');
		const names = items.slice(0, 3).map(a => esc(a.title)).join(' · ') + (items.length > 3 || more ? ' ' + esc(t('and', { n: (item.count || 0) - Math.min(3, items.length) })) : '');
		return `<div class="taiga-ta taiga-ta-achievements"><div class="taiga-ta-body"><div class="taiga-ta-tag">${esc(t('tagAch'))}</div><div class="taiga-ta-title">${esc(item.count === 1 ? t('achOne') : t('achMany', { n: item.count || 0 }))}</div><div class="taiga-ta-icons">${icons}</div><div class="taiga-ta-sub">${names}</div>${item.total ? `<div class="taiga-ta-progress"><div class="taiga-ta-bar"><span style="width:${Math.min(100, Math.round(((item.progress || 0) / item.total) * 100))}%"></span></div><span>${esc(t('progress', { p: item.progress || 0, t: item.total }))}</span></div>` : ''}</div></div>`;
	}
	if (item.kind === 'session') {
		return `<div class="taiga-ta taiga-ta-session"><div class="taiga-ta-badge">${ICONS.clock}</div><div class="taiga-ta-body"><div class="taiga-ta-tag">${esc(t('tagSession'))}</div><div class="taiga-ta-title">${esc(t('session', { d: duration(item.seconds || 0) }))}${(item.count || 0) > 1 ? ` <span class="taiga-ta-muted">(${esc(t('sessions', { n: item.count || 0 }))})</span>` : ''}</div></div></div>`;
	}
	const type = item.type || 'first';
	const icon = type === 'complete' ? ICONS.trophy : type === 'half' ? ICONS.star : ICONS.play;
	const title = type === 'complete' ? t('complete') : type === 'half' ? t('half') : t('first');
	const sub = type === 'half' && item.total ? esc(t('progress', { p: item.progress || 0, t: item.total })) : type === 'complete' && item.total ? esc(t('progress', { p: item.total, t: item.total })) : '';
	return `<div class="taiga-ta taiga-ta-milestone is-${esc(type)}"><div class="taiga-ta-badge">${icon}</div><div class="taiga-ta-body"><div class="taiga-ta-tag">${esc(t('tagMilestone'))}</div><div class="taiga-ta-title">${esc(title)}</div>${sub ? `<div class="taiga-ta-sub">${sub}</div>` : ''}</div></div>`;
}

const STYLE = `
.taiga-ta{display:flex;gap:14px;align-items:flex-start;margin:0 0 14px;padding:14px 16px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.04);border-radius:3px}
.taiga-ta-badge{flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(103,193,245,.12);color:#67c1f5}
.taiga-ta-badge svg{width:22px;height:22px}
.taiga-ta-body{flex:1;min-width:0}
.taiga-ta-tag{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8f98a0;font-weight:700;margin:0 0 3px}
.taiga-ta-title{font-size:15px;color:#fff;line-height:1.35}
.taiga-ta-muted{color:#8f98a0;font-size:13px}
.taiga-ta-sub{margin:6px 0 0;font-size:13px;color:#8f98a0;line-height:1.4;overflow:hidden;text-overflow:ellipsis}
.taiga-ta-icons{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
.taiga-ta-ach{width:44px;height:44px;border-radius:3px;overflow:hidden;background:#1b2838;display:flex;align-items:center;justify-content:center;color:#67c1f5;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.taiga-ta-ach img{width:100%;height:100%;object-fit:cover;display:block}
.taiga-ta-ach svg{width:22px;height:22px}
.taiga-ta-progress{display:flex;align-items:center;gap:10px;margin:10px 0 0;font-size:12px;color:#8f98a0}
.taiga-ta-bar{flex:1;max-width:260px;height:6px;border-radius:3px;background:#3d4450;overflow:hidden}
.taiga-ta-bar span{display:block;height:100%;background:linear-gradient(90deg,#47bfff,#1a9fff)}
.taiga-ta-session{padding:10px 16px}
.taiga-ta-session .taiga-ta-badge{width:32px;height:32px;background:rgba(255,255,255,.06);color:#c6d4df}
.taiga-ta-session .taiga-ta-badge svg{width:18px;height:18px}
.taiga-ta-session .taiga-ta-title{font-size:14px}
.taiga-ta-milestone{background:linear-gradient(90deg,rgba(26,159,255,.16),rgba(0,0,0,.2) 70%);border-color:rgba(103,193,245,.18)}
.taiga-ta-milestone.is-complete{background:linear-gradient(90deg,rgba(255,200,44,.18),rgba(0,0,0,.2) 70%);border-color:rgba(255,200,44,.25)}
.taiga-ta-milestone.is-complete .taiga-ta-badge{background:rgba(255,200,44,.16);color:#ffc82c}
.taiga-ta-milestone.is-first .taiga-ta-badge{background:rgba(164,208,7,.14);color:#a4d007}
#taiga-extras{margin:26px 0 8px;display:flex;flex-direction:column;gap:26px}
.gdl-taiga-virtual #gdl-activity-feed>.gdl-activity-end{display:none!important}
#taiga-extras>.gdl-activity-end{display:flex;align-items:center;gap:22px;margin:0 0 8px;color:#8f98a0;font-size:13px;line-height:1;white-space:nowrap}
#taiga-extras>.gdl-activity-end::before,#taiga-extras>.gdl-activity-end::after{content:"";height:1px;flex:1 1 auto;background:rgba(255,255,255,.08)}
#taiga-extras[hidden]{display:none!important}
.taiga-x-head{display:flex;align-items:center;gap:12px;margin:0 0 12px;font-size:13.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8f98a0}
.taiga-x-head::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.1)}
.taiga-x-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.taiga-x-tile{position:relative;aspect-ratio:16/9;border-radius:3px;overflow:hidden;background:#101822;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.06);transition:transform .15s,box-shadow .15s;border:0;padding:0}
.taiga-x-tile:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 0 1px rgba(103,193,245,.45)}
.taiga-x-tile img{width:100%;height:100%;object-fit:cover;display:block}
.taiga-x-tile iframe{width:100%;height:100%;border:0;display:block}
.taiga-x-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.05) 60%)}
.taiga-x-play span{width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.8)}
.taiga-x-play svg{width:26px;height:26px;margin-left:3px}
.taiga-x-label{position:absolute;left:8px;bottom:6px;right:8px;font-size:12px;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.taiga-x-similar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.taiga-x-game{display:flex;flex-direction:column;gap:6px;cursor:default;background:none;border:0;padding:0;text-align:left;color:inherit;font:inherit}
.taiga-x-game.is-owned{cursor:pointer}
.taiga-x-cover{position:relative;aspect-ratio:3/4;border-radius:3px;overflow:hidden;background:#101822;box-shadow:0 0 0 1px rgba(255,255,255,.06);transition:transform .15s,box-shadow .15s}
.taiga-x-game.is-owned:hover .taiga-x-cover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 0 1px rgba(103,193,245,.45)}
.taiga-x-cover img{width:100%;height:100%;object-fit:cover;display:block}
.taiga-x-owned{position:absolute;left:6px;top:6px;padding:2px 6px;border-radius:2px;background:rgba(26,159,255,.9);color:#fff;font-size:10.5px;font-weight:700}
.taiga-x-name{font-size:13px;color:#dcdedf;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.taiga-x-year{font-size:12px;color:#8f98a0}
.taiga-x-lightbox{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag}
.taiga-x-lightbox *{-webkit-app-region:no-drag}
.taiga-x-lightbox img{max-width:88vw;max-height:84vh;border-radius:3px;box-shadow:0 10px 40px #000}
.taiga-x-lb-btn{position:absolute;z-index:2;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.taiga-x-lb-btn::before{content:"";position:absolute;inset:-10px;border-radius:50%}
.taiga-x-lb-btn:hover{background:rgba(255,255,255,.25)}
.taiga-x-lb-prev{left:24px}.taiga-x-lb-next{right:24px}
.taiga-x-lb-close{top:72px;right:28px;transform:none;font-size:22px}
`;
export function ensureTaigaExtrasStyle(doc: Document): void {
	let style = doc.getElementById('taiga-extras-style');
	if (!style) { style = doc.createElement('style'); style.id = 'taiga-extras-style'; doc.head?.appendChild(style); }
	if (style.textContent !== STYLE) style.textContent = STYLE;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const e = doc.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e;
}
function img(doc: Document, src: string): HTMLImageElement {
	const i = el(doc, 'img'); i.src = safeImg(src); i.alt = ''; i.loading = 'lazy';
	i.addEventListener('error', () => { const tile = i.closest<HTMLElement>('.taiga-x-tile, .taiga-x-game'); if (!tile) return; const sec = tile.closest<HTMLElement>('.taiga-x-sec'); tile.remove(); if (sec && !sec.querySelector('.taiga-x-tile, .taiga-x-game')) sec.remove(); }, { once: true });
	return i;
}
function lightbox(doc: Document, shots: string[], start: number): void {
	doc.querySelector('.taiga-x-lightbox')?.remove();
	let index = start;
	const box = el(doc, 'div', 'taiga-x-lightbox'); box.setAttribute('role', 'dialog');
	const picture = el(doc, 'img');
	const show = (): void => { picture.src = safeImg(shots[index]); };
	const button = (cls: string, label: string, text: string, fn: () => void): HTMLButtonElement => { const b = el(doc, 'button', 'taiga-x-lb-btn ' + cls, text); b.type = 'button'; b.title = label; b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b; };
	const close = (): void => { box.remove(); doc.removeEventListener('keydown', onKey, true); };
	const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowLeft') { index = (index + shots.length - 1) % shots.length; show(); } else if (e.key === 'ArrowRight') { index = (index + 1) % shots.length; show(); } };
	box.append(picture, button('taiga-x-lb-close', t('close'), '✕', close));
	if (shots.length > 1) box.append(button('taiga-x-lb-prev', t('prev'), '‹', () => { index = (index + shots.length - 1) % shots.length; show(); }), button('taiga-x-lb-next', t('next'), '›', () => { index = (index + 1) % shots.length; show(); }));
	box.addEventListener('click', e => { if (e.target === box) close(); });
	picture.addEventListener('click', e => e.stopPropagation());
	doc.addEventListener('keydown', onKey, true);
	show(); doc.body.appendChild(box);
}

interface Mount { doc: Document; wrapper: HTMLElement; root: HTMLElement; steamAppId: string; shortcutAppId: string; newsItems: NewsItem[]; headerImage: string; sig: string }
const mounts = new WeakMap<Document, Mount>();

function renderBlock(m: Mount, data: Extras | null): void {
	const { doc, root } = m;
	const similar = (data?.similar || []).slice(0, 4), shots = (data?.shots || []).slice(0, 3);
	const sig = JSON.stringify([similar, shots]);
	if (sig === m.sig && root.childElementCount) return; m.sig = sig;
	root.textContent = '';
	// Primeiro as imagens (até 3, uma linha), depois os jogos parecidos (até 4, uma linha) e, no fim, o "Fim da atividade".
	if (shots.length) {
		const sec = el(doc, 'section', 'taiga-x-sec'); sec.appendChild(el(doc, 'div', 'taiga-x-head', t('media')));
		const strip = el(doc, 'div', 'taiga-x-strip');
		shots.forEach((src, i) => {
			const tile = el(doc, 'button', 'taiga-x-tile'); tile.type = 'button'; tile.appendChild(img(doc, src));
			tile.addEventListener('click', e => { e.preventDefault(); lightbox(doc, shots, i); });
			strip.appendChild(tile);
		});
		sec.appendChild(strip); root.appendChild(sec);
	}
	if (similar.length) {
		const sec = el(doc, 'section', 'taiga-x-sec'); sec.appendChild(el(doc, 'div', 'taiga-x-head', t('similar')));
		const grid = el(doc, 'div', 'taiga-x-similar');
		for (const g of similar) {
			// Só os jogos da sua coleção abrem (na própria biblioteca); os outros são só a recomendação, sem link externo.
			const owned = !!g.shortcut && /^\d+$/.test(String(g.shortcut));
			const card = el(doc, owned ? 'button' : 'div', 'taiga-x-game' + (owned ? ' is-owned' : '')); card.title = g.name;
			if (owned) (card as HTMLButtonElement).type = 'button';
			const cover = el(doc, 'div', 'taiga-x-cover'); cover.appendChild(img(doc, g.cover));
			card.append(cover, el(doc, 'div', 'taiga-x-name', g.name));
			if (g.year) card.appendChild(el(doc, 'div', 'taiga-x-year', String(g.year)));
			if (owned) card.addEventListener('click', e => { e.preventDefault(); navigateToLibraryShortcut(doc, String(g.shortcut)); });
			grid.appendChild(card);
		}
		sec.appendChild(grid); root.appendChild(sec);
	}
	const end = el(doc, 'div', 'gdl-activity-end'); end.appendChild(el(doc, 'span', '', gdlText('activity_end', 'End of activity')));
	root.appendChild(end);
	root.hidden = false;
}

/** Monta trailers, imagens e jogos parecidos abaixo da linha do tempo (e mantém a linha do tempo atualizada). */
export function mountTaigaExtras(doc: Document, wrapper: HTMLElement, steamAppId: string, shortcutAppId: string | null | undefined, newsItems: NewsItem[], headerImage: string): void {
	const old = mounts.get(doc); if (old) { old.root.remove(); mounts.delete(doc); }
	wrapper.classList.remove('gdl-taiga-virtual');
	if (!isTaigaVirtualAppId(steamAppId) || !shortcutAppId || !/^\d+$/.test(String(shortcutAppId))) return;
	const feed = wrapper.querySelector<HTMLElement>('#gdl-activity-feed'); if (!feed) return;
	ensureTaigaExtrasStyle(doc);
	const root = el(doc, 'div'); root.id = 'taiga-extras'; root.hidden = true;
	feed.insertAdjacentElement('afterend', root);
	wrapper.classList.add('gdl-taiga-virtual');
	const m: Mount = { doc, wrapper, root, steamAppId, shortcutAppId: String(shortcutAppId), newsItems, headerImage, sig: '' };
	mounts.set(doc, m);
	const data = current(m.shortcutAppId);
	renderBlock(m, data);
	if (data) refreshFeed(m);
}
function refreshFeed(m: Mount): void {
	const feed = m.wrapper.querySelector<HTMLElement>('#gdl-activity-feed'); if (!feed || !feed.isConnected) return;
	try { applyUnifiedActivityFeed(feed, m.steamAppId, m.shortcutAppId, getRetainedActivityNews(m.steamAppId) || m.newsItems, m.headerImage); } catch {}
}
// Dados chegaram: redesenha a linha do tempo e o bloco de mídia das páginas abertas desse jogo.
listeners.add(shortcutAppId => {
	for (const doc of Array.from(knownDocs)) {
		const m = mounts.get(doc);
		if (!m || !m.root.isConnected || m.shortcutAppId !== shortcutAppId) continue;
		refreshFeed(m); renderBlock(m, cache.get(shortcutAppId)?.data?.enabled ? cache.get(shortcutAppId)!.data : null);
	}
});
const knownDocs = new Set<Document>();
const origMount = mountTaigaExtras;
export function mountTaigaExtrasTracked(doc: Document, wrapper: HTMLElement, steamAppId: string, shortcutAppId: string | null | undefined, newsItems: NewsItem[], headerImage: string): void {
	knownDocs.add(doc);
	for (const d of Array.from(knownDocs)) { try { if (!d.defaultView || d.defaultView.closed) knownDocs.delete(d); } catch { knownDocs.delete(d); } }
	origMount(doc, wrapper, steamAppId, shortcutAppId, newsItems, headerImage);
}

import { escapeHtml } from '../../core/text';
import { PLAYBAR_CLASSES } from '../../steam/css';
import { displayLanguage, loc, steamLanguageSync } from '../../steam/localization';
import {
	applyNativePlaybarTypography,
	buildNativeCloudBlueprint,
	closestWithCssModuleClass,
	elementsWithCssModuleClass,
	findVisibleCloudStatusStat,
	isRenderedElement,
	NATIVE_UI_BLUEPRINT_KEYS,
} from '../../steam/native-dom';
import { preserveLinkedPlaybarVisibility } from '../../steam/playbar-visibility';
import { routedSteamAppId } from './native-route';
import { getCommittedShortcutSteamAppId } from '../shortcuts/registry';
import { isShortcutDismissed } from '../shortcuts/dismissed';
import { paintedNativePlaybar, paintedNativeStats } from '../../steam/library-details';
import { ensureNativeGameInfoStyles } from './styles';
import { backendLog } from '../../api/backend';
import { isStoreInstallPending } from './store-install';

let lastBarReport = '';

const cachedCloudStatus = new WeakMap<Document, { wrapper: HTMLElement; language: string }>();
const watched = new WeakSet<HTMLElement>();

function isPaintedCloudElement(doc: Document, element: HTMLElement): boolean {
	if (!isRenderedElement(doc, element)) return false;
	const view = doc.defaultView;
	if (!view?.getComputedStyle) return true;
	// Steam mounts both sticky and in-page playbars. The sticky stats can keep
	// their geometry while opacity:0 conceals the whole row or an ancestor.
	for (let current: HTMLElement | null = element; current; current = current.parentElement) {
		const style = view.getComputedStyle(current);
		if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return false;
	}
	return true;
}

// Taiga Launcher: em português o rótulo fica "Nuvem" (a Steam usa "Status do Steam Cloud").
function taigaCloudLabel(wrapper: HTMLElement): void {
	try {
		if (displayLanguage() !== 'brazilian') return;
		const label = wrapper.querySelector<HTMLElement>(`.${(PLAYBAR_CLASSES().PlayBarLabel || 'x').split(' ')[0]}`);
		if (label && label.textContent !== 'Nuvem') label.textContent = 'Nuvem';
	} catch {}
}

function cloudSynchronizedSvg(extraClass = ''): string {
	return `<svg class="gdl-cloud-icon ${extraClass}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" aria-hidden="true" style="display:block;width:100%;height:100%;"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M25.2377 7.0939C26.902 8.83356 27.8828 11.1153 28 13.52C29.998 14.2303 31.6809 15.6232 32.7522 17.4532C33.8234 19.2831 34.2142 21.4325 33.8555 23.5224C33.4968 25.6122 32.4118 27.5084 30.7917 28.8764C29.1716 30.2444 27.1205 30.9965 25 31H11C8.87962 30.9965 6.82852 30.2444 5.20842 28.8764C3.58833 27.5083 2.50327 25.6122 2.1446 23.5224C1.78593 21.4325 2.17666 19.2831 3.24792 17.4532C4.31917 15.6232 6.00213 14.2303 8.00005 13.52C8.11845 11.109 9.10495 8.82222 10.7775 7.08168C12.45 5.34114 14.6957 4.26433 17.1 4.04999H18.0201H18.9401C21.3372 4.27345 23.5733 5.35425 25.2377 7.0939ZM10 19.6L15.41 25L25.03 15.38L22.64 13L15.41 20.23L12.39 17.21L10 19.6Z"/></svg>`;
}

/** Repair old hidden blueprints in place, keeping the same mounted widget. */
function restoreOwnedCloudStatus(wrapper: HTMLElement): void {
	const classes = PLAYBAR_CLASSES();
	if (!findVisibleCloudStatusStat(wrapper)) {
		wrapper.dataset.gdlCloudStatus = '1';
		wrapper.dataset.gdlNativeBlueprint = '0';
		wrapper.className = classes.PlayBarCloudStatusContainer || '';
		wrapper.title = loc('AppDetails_CloudStatus_Tooltip_Synchronized', 'Your Steam Cloud files are synchronized for this app.');
		wrapper.innerHTML = `
			<div class="${classes.GameStat || ''} ${classes.LastPlayed || ''} ${classes.SuperimposedGridItems || ''} ${classes.Visible || ''}">
				<div class="${classes.GameStatIconForced || ''} ${classes.PlaytimeIconForced || ''}">${cloudSynchronizedSvg(classes.CloudIconSVG || '')}</div>
				<div class="${classes.HideWhenNarrow || ''} ${classes.GameStatRight || ''} ${classes.LastPlayedRight || ''}">
					<div class="${classes.PlayBarLabel || ''} ${classes.LastPlayedLabel || ''}">${escapeHtml(loc('AppDetails_SectionTitle_CloudStatus', 'Cloud status'))}</div>
					<div class="${classes.PlayBarDetailLabel || ''} ${classes.LastPlayedInfo || ''}">${escapeHtml(loc('AppDetails_CloudStatus_Synchronized', 'Up to date'))}</div>
				</div>
			</div>`;
		const cloudGraphic = wrapper.querySelector<HTMLElement>('.gdl-cloud-icon, svg, img');
		if (cloudGraphic?.parentElement) cloudGraphic.parentElement.dataset.gdlUiIconHost = 'cloud';
		applyNativePlaybarTypography(wrapper, NATIVE_UI_BLUEPRINT_KEYS.cloudStatus);
	}
	// Route retirement can conceal a node while it is still connected, as well
	// as before it is cached. Restore either case without rewriting its contents.
	for (const element of [wrapper, findVisibleCloudStatusStat(wrapper)]) {
		if (!element) continue;
		if (element.style.display === 'none') element.style.removeProperty('display');
		if (element.style.visibility === 'hidden') element.style.removeProperty('visibility');
		if (element.style.pointerEvents === 'none') element.style.removeProperty('pointer-events');
	}
}

export function ensureOwnedCloudStats(doc: Document, playbar: HTMLElement): HTMLElement {
	try {
		const cs = doc.defaultView?.getComputedStyle(playbar);
		if (cs && cs.display.includes('flex') && cs.flexDirection.startsWith('column') && playbar.style.getPropertyValue('flex-direction') !== 'row') playbar.style.setProperty('flex-direction', 'row', 'important');
	} catch {}
	const classes = PLAYBAR_CLASSES();
	// Taiga Launcher: a Steam reserva um espaço vazio logo depois do botão JOGAR, na mesma linha do botão e dos
	// ícones da direita (engrenagem, informações, favorito). É ali que ela mostra Estado da nuvem e Tempo de jogo
	// nos jogos dela. Atenção: AppButtonsContainer é o bloco dos ÍCONES da direita, não o do JOGAR; procurar o
	// espaço dentro dele (como antes) nunca achava nada e a linha caía para baixo do botão. O certo é subir a partir
	// dos ícones até a linha e pegar o irmão vazio que vem antes deles.
	const isSlot = (el: Element | null): el is HTMLElement => !!el && el.tagName === 'DIV' && (
		(el.childElementCount === 0 && !(el.textContent || '').trim())
		|| (el.childElementCount === 1 && (el.firstElementChild as HTMLElement | null)?.dataset?.gdlCloudStats === '1'));
	const slotOf = (): HTMLElement | null => {
		const icons = elementsWithCssModuleClass(playbar, classes.AppButtonsContainer)[0];
		for (let child: HTMLElement | null = icons || null; child && child.parentElement && child.parentElement !== playbar; child = child.parentElement) {
			const kids = Array.from(child.parentElement.children), at = kids.indexOf(child);
			for (let i = at - 1; i > 0; i--) {
				const el = kids[i], prev = kids[i - 1] as HTMLElement;
				if (isSlot(el) && prev.childElementCount > 0 && !prev.querySelector('[data-gdl-cloud-stats]')) return el;
			}
		}
		return null;
	};
	// Botão JOGAR (o bloco antes do espaço reservado, ou o primeiro botão do bloco).
	const playOf = (slot: HTMLElement | null): HTMLElement | null => {
		const prev = slot?.previousElementSibling as HTMLElement | null;
		if (prev) return prev;
		// Sem o espaço: o bloco com conteúdo que vem antes dos ícones da direita, na mesma linha (o JOGAR).
		const icons = elementsWithCssModuleClass(playbar, classes.AppButtonsContainer)[0];
		for (let child: HTMLElement | null = icons || null; child && child.parentElement && child.parentElement !== playbar; child = child.parentElement) {
			const kids = Array.from(child.parentElement.children) as HTMLElement[], at = kids.indexOf(child);
			const block = kids.slice(0, at).find(k => k.childElementCount > 0 && !k.querySelector('[data-gdl-cloud-stats]') && k.getBoundingClientRect().width > 40);
			if (block) return block;
		}
		return null;
	};
	// Só grava quando o valor muda: gravar o mesmo estilo de novo dispararia os observadores da página.
	const put = (el: HTMLElement, k: string, v: string): void => { if (el.style.getPropertyValue(k) !== v || el.style.getPropertyPriority(k) !== 'important') el.style.setProperty(k, v, 'important'); };
	const PIN = ['position', 'left', 'top', 'transform', 'max-width', 'overflow', 'z-index'];
	// Rede de segurança: se a Steam empilhar o bloco (Steam offline, janela estreita, layout novo), a linha é
	// posicionada ao lado do JOGAR pela geometria real, sem depender da estrutura da página.
	const pin = (stats: HTMLElement, play: HTMLElement | null): void => {
		const view = doc.defaultView;
		if (!play || !view) return;
		const pr = play.getBoundingClientRect();
		if (!pr.width || !pr.height) return;
		if (view.getComputedStyle(playbar).position === 'static') put(playbar, 'position', 'relative');
		put(stats, 'position', 'absolute');
		if (stats.dataset.gdlPinned !== '1') stats.dataset.gdlPinned = '1';
		const host = (stats.offsetParent as HTMLElement | null) || playbar;
		const hr = host.getBoundingClientRect();
		const x = pr.right - hr.left - host.clientLeft + 24;
		let limit = hr.right;
		for (const el of [playOf(slotOf())?.parentElement?.lastElementChild as HTMLElement | null, playbar.lastElementChild as HTMLElement | null]) {
			if (!el || el === stats || el.contains(stats)) continue;
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.left > pr.right + 40 && r.top < pr.bottom && r.bottom > pr.top) limit = Math.min(limit, r.left);
		}
		put(stats, 'left', `${Math.round(x)}px`);
		put(stats, 'top', `${Math.round(pr.top - hr.top - host.clientTop + pr.height / 2)}px`);
		put(stats, 'transform', 'translateY(-50%)');
		put(stats, 'max-width', `${Math.max(0, Math.round(limit - hr.left - x - 16))}px`);
		put(stats, 'overflow', 'hidden');
		put(stats, 'z-index', '1');
	};
	const watch = (stats: HTMLElement): void => {
		const RO = (doc.defaultView as any)?.ResizeObserver;
		if (!RO || watched.has(playbar)) return;
		const ro = new RO(() => { if (stats.isConnected) pin(stats, playOf(slotOf())); });
		ro.observe(playbar);
		watched.add(playbar);
	};
	// A linha fica na própria barra (que nunca é recortada) e é posicionada ao lado do JOGAR pela posição real do
	// botão. O espaço reservado pela Steam não é usado: com a Steam offline ele pode ficar sem largura (a linha
	// sumia) ou ir para baixo do botão (a linha caía). Assim o layout da Steam não é alterado em nada.
	const place = (stats: HTMLElement): void => {
		if (stats.parentElement !== playbar) playbar.appendChild(stats);
		const play = playOf(slotOf());
		pin(stats, play);
		watch(stats);
		// Registro para diagnóstico (só quando muda): onde ficou a linha em relação ao JOGAR.
		try {
			const r = (el: Element | null) => { if (!el) return '-'; const b = el.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; };
			const report = `play ${r(play)} | linha ${r(stats)} pinned=${stats.dataset.gdlPinned || 0} | barra ${r(playbar)} ${doc.defaultView?.getComputedStyle(playbar).position || ''} | filhos ${stats.childElementCount}`;
			if (report !== lastBarReport) { lastBarReport = report; backendLog('Taiga barra: ' + report); }
		} catch {}
	};
	const existing = playbar.querySelector<HTMLElement>('[data-gdl-cloud-stats="1"]');
	if (existing) { place(existing); return existing; }
	const stats = doc.createElement('div');
	stats.className = classes.GameStatsSection || '';
	stats.dataset.gdlCloudStats = '1';
	stats.style.setProperty('display', 'flex', 'important');
	stats.style.setProperty('flex-direction', 'row', 'important');
	stats.style.setProperty('flex-wrap', 'nowrap', 'important');
	stats.style.setProperty('align-items', 'center', 'important');
	stats.style.setProperty('flex', '1 1 auto', 'important');
	stats.style.setProperty('min-width', '0', 'important');
	place(stats);
	return stats;
}

export function ensureCloudStatus(doc: Document): void {
	const shortcutId = routedSteamAppId(doc);
	if (!shortcutId || shortcutId < 2147483648 || isShortcutDismissed(shortcutId)
		|| !getCommittedShortcutSteamAppId(shortcutId)) return;
	// Jogo de loja ainda não instalado: sem "Nuvem" (o lugar é do "Espaço necessário").
	if (isStoreInstallPending(shortcutId)) { removeCloudStatus(doc); return; }
	const playbar = paintedNativePlaybar(doc, shortcutId);
	let statsSections = paintedNativeStats(doc, shortcutId);
	if (!playbar && !statsSections.length) return;
	ensureNativeGameInfoStyles(doc);
	const classes = PLAYBAR_CLASSES();
	const language = steamLanguageSync() || 'english';
	const cached = cachedCloudStatus.get(doc);
	if (cached && cached.language !== language) { cached.wrapper.remove(); cachedCloudStatus.delete(doc); }
	const nativeSections = statsSections.filter(section => section.dataset.gdlCloudStats !== '1');
	if (nativeSections.some(section => isPaintedCloudElement(doc, section))) statsSections = nativeSections;
	let visibleFallback: HTMLElement | undefined;
	// Causa do bug da Steam offline: a linha própria era criada enquanto a página ainda montava (sem o espaço ao
	// lado do JOGAR) e ia para baixo do botão; depois, por já estar visível, nunca mais era reposicionada.
	// Agora ela é reposicionada a cada atualização até chegar ao lugar certo.
	const ownedHere = playbar?.querySelector<HTMLElement>('[data-gdl-cloud-stats="1"]');
	if (playbar && ownedHere && !nativeSections.some(section => isPaintedCloudElement(doc, section))) {
		visibleFallback = ensureOwnedCloudStats(doc, playbar);
		if (!statsSections.includes(visibleFallback)) statsSections.push(visibleFallback);
	} else if (!statsSections.some(section => isPaintedCloudElement(doc, section)) && playbar) {
		// Steam can hydrate the hidden sticky row before the visible in-page
		// playbar. Its presence must not suppress that playbar's temporary slot.
		if (!elementsWithCssModuleClass(playbar, classes.GameStatsSection).some(section => section.dataset.gdlCloudStats !== '1')) {
			const fallback = ensureOwnedCloudStats(doc, playbar);
			if (!statsSections.includes(fallback)) statsSections.push(fallback);
			// A newly created row has no height until Cloud is inserted. Its
			// painted native parent, rather than its empty geometry, selects it.
			visibleFallback = fallback;
		}
	}
	const cachedParent = cachedCloudStatus.get(doc)?.wrapper.parentElement;
	const liveStats = visibleFallback || statsSections.find(section => section === cachedParent && isPaintedCloudElement(doc, section))
		|| statsSections.find(section => isPaintedCloudElement(doc, section)) || statsSections[0];
	for (const stats of liveStats ? [liveStats] : []) {
		const ownedClouds = Array.from(stats.querySelectorAll<HTMLElement>('[data-gdl-cloud-status="1"]'));
		const cloudWrappers = elementsWithCssModuleClass(stats, classes.PlayBarCloudStatusContainer)
			.filter(element => closestWithCssModuleClass(element, classes.GameStatsSection) === stats);
		const nativeCloud = cloudWrappers.find(element => {
			if (element.dataset.gdlCloudStatus === '1') return false;
			const stat = findVisibleCloudStatusStat(element);
			return Boolean(stat && isPaintedCloudElement(doc, stat));
		});
		if (nativeCloud) {
			// If Steam has hydrated its own cloud control, it is authoritative. A
			// previously injected fallback must not remain alongside it.
			for (const owned of ownedClouds) owned.remove();
			continue;
		}
		if (ownedClouds.length > 0) {
			// A valid widget stays static on scroll, focus and metadata updates.
			// Repair only a hidden or invalid widget left by an earlier mount.
			for (const duplicate of ownedClouds.slice(1)) duplicate.remove();
			restoreOwnedCloudStatus(ownedClouds[0]);
			taigaCloudLabel(ownedClouds[0]);
			cachedCloudStatus.set(doc, { wrapper: ownedClouds[0], language });
			continue;
		}
		let reference = stats.querySelector<HTMLElement>(
			'[data-gdl-playbar-achievements="1"], #gdl-playbar-achievements, [class*="MiniAchievements"], [data-gdl-playtime="1"], [class*="LastPlayed"]:not([data-gdl-cloud-status]), [class*="lastPlayed"]:not([data-gdl-cloud-status]), [class*="Playtime"]:not([data-gdl-cloud-status]), [class*="playtime"]:not([data-gdl-cloud-status])'
		) || null;
		while (reference && reference.parentElement !== stats) reference = reference.parentElement;

		const cachedWrapper = cachedCloudStatus.get(doc)?.wrapper;
		let wrapper = cachedWrapper;
		if (!wrapper) wrapper = buildNativeCloudBlueprint(doc) || undefined;
		if (!wrapper) wrapper = doc.createElement('div');
		restoreOwnedCloudStatus(wrapper);
		const cloudGraphic = wrapper.querySelector<HTMLElement>('.gdl-cloud-icon, svg, img');
		if (cloudGraphic?.parentElement && cloudGraphic.parentElement.dataset.gdlUiIconHost !== 'cloud') {
			cloudGraphic.parentElement.dataset.gdlUiIconHost = 'cloud';
		}
		if (!cachedWrapper) applyNativePlaybarTypography(wrapper, NATIVE_UI_BLUEPRINT_KEYS.cloudStatus);
		const targetReference = (reference && reference !== wrapper) ? reference : stats.firstChild;
		if (wrapper.parentElement !== stats || (wrapper.nextSibling !== targetReference && wrapper !== targetReference)) {
			stats.insertBefore(wrapper, targetReference);
		}
		taigaCloudLabel(wrapper);
		cachedCloudStatus.set(doc, { wrapper, language });
	}
	// Retire only unused temporary rows. Hidden native rows elsewhere in the
	// document are not evidence that this visible fallback has been replaced.
	doc.querySelectorAll('[data-gdl-cloud-stats="1"]').forEach(element => {
		if (element !== liveStats) element.remove();
	});
	preserveLinkedPlaybarVisibility(doc);
}

export function syncEarlyLinkedCloudStatus(doc: Document): void {
	ensureCloudStatus(doc);
}

export function removeCloudStatus(doc: Document): void {
	doc.querySelectorAll('[data-gdl-cloud-status="1"]').forEach(element => element.remove());
	doc.querySelectorAll('[data-gdl-cloud-stats="1"]').forEach(element => element.remove());
}

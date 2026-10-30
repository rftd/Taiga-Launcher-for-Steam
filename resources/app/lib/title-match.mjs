// Comparação de títulos de jogos, inspirada na detecção do NativeGameLink
// (MIT, David Miranda): normalização, numerais romanos, siglas e conflitos de
// sequência/edição/remake para não confundir "God of War" com "God of War II"
// ou um remake com o original.
const ROMAN = {i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15};
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'do', 'da', 'e', 'la', 'le', 'el', 'der', 'die', 'das']);
const GENERIC = new Set(['launcher', 'launch', 'game', 'start', 'shipping', 'win64', 'win32', 'windows', 'x64', 'x86', 'dx11', 'dx12', 'binaries', 'binary', 'games', 'jogos', 'steamapps', 'common', 'repack', 'setup', 'install']);
const EDITION = {remake: 'remake', reimagined: 'remake', remaster: 'remaster', remastered: 'remaster', hd: 'remaster', definitive: 'definitive', ultimate: 'ultimate', deluxe: 'deluxe', complete: 'complete', goty: 'goty', anniversary: 'anniversary', collection: 'collection', trilogy: 'collection', bundle: 'collection'};

export function normalizeTitle(value) {
 return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[™®©]/g, '').replace(/[’'`´]/g, '').replace(/&/g, ' and ').replace(/\+/g, ' plus ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
const romanToArabic = text => (' ' + text + ' ').replace(/ (x[iv]{0,3}|i[xv]|v?i{0,3}) /g, (m, r) => r && ROMAN[r] ? ' ' + ROMAN[r] + ' ' : m).trim();
export const titleTokens = (value, {generic = true} = {}) => romanToArabic(normalizeTitle(value)).split(' ').filter(t => t && !STOP.has(t) && (generic || !GENERIC.has(t)));
export const compact = value => romanToArabic(normalizeTitle(value)).replace(/\s+/g, '');

export function sequelNumber(value) {
 const text = ' ' + romanToArabic(normalizeTitle(value)) + ' ';
 const explicit = text.match(/ (?:part|chapter|episode|vol|volume) (\d+) /);
 if (explicit) return Number(explicit[1]);
 for (const m of text.matchAll(/ (\d{1,2}) /g)) { const n = Number(m[1]); if (n >= 2 && n <= 25) return n; }
 return null;
}
export function editionOf(value) {
 const words = normalizeTitle(value).split(' ');
 for (const w of words) if (EDITION[w]) return EDITION[w];
 if (/game of the year/.test(normalizeTitle(value))) return 'goty';
 return null;
}
export function yearOf(value) { const m = String(value || '').match(/\b(19[7-9]\d|20[0-4]\d)\b/); return m ? Number(m[1]) : null; }

function dice(a, b) {
 const x = new Set(a), y = new Set(b);
 if (!x.size || !y.size) return 0;
 let common = 0; for (const t of x) if (y.has(t)) common++;
 return 2 * common / (x.size + y.size);
}
function compactSimilarity(a, b) {
 const x = compact(a), y = compact(b);
 if (!x || !y) return 0; if (x === y) return 1;
 const [s, l] = x.length <= y.length ? [x, y] : [y, x];
 return s.length >= 4 && l.includes(s) ? Math.min(.95, s.length / l.length + .3) : 0;
}
function levenshteinRatio(a, b) {
 const x = compact(a), y = compact(b);
 if (!x || !y) return 0; if (x === y) return 1;
 if (Math.abs(x.length - y.length) > Math.max(x.length, y.length) * .5) return 0;
 const prev = Array.from({length: y.length + 1}, (_, i) => i);
 for (let i = 1; i <= x.length; i++) {
  let diag = prev[0]; prev[0] = i;
  for (let j = 1; j <= y.length; j++) { const tmp = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1)); diag = tmp; }
 }
 return 1 - prev[y.length] / Math.max(x.length, y.length);
}
// Semelhança de 0 a 1 entre dois títulos, tolerante a pontuação, artigos e numerais.
export function similarity(a, b) {
 if (!a || !b) return 0;
 const na = normalizeTitle(a), nb = normalizeTitle(b);
 if (na === nb) return 1;
 if (compact(a) === compact(b)) return .99;
 return Math.max(dice(titleTokens(a), titleTokens(b)), compactSimilarity(a, b), levenshteinRatio(a, b) * .97);
}
// Compara identidades: o título base pode coincidir, mas sequência/edição/ano podem indicar outro jogo.
export function compareTitles(query, candidate, {queryYear = null, candidateYear = null} = {}) {
 const sim = similarity(query, candidate);
 const sq = sequelNumber(query), sc = sequelNumber(candidate);
 const eq = editionOf(query), ec = editionOf(candidate);
 const yq = queryYear || yearOf(query), yc = candidateYear || yearOf(candidate);
 const sequelMismatch = (sq || 1) !== (sc || 1) && (sq !== null || sc !== null);
 const remakeMismatch = (eq === 'remake') !== (ec === 'remake') && (eq === 'remake' || ec === 'remake');
 const yearGap = yq && yc ? Math.abs(yq - yc) : null;
 // Subtítulo extra no candidato ("God of War" x "God of War: Ghost of Sparta") reduz a certeza.
 const qt = new Set(titleTokens(query)), extra = titleTokens(candidate).filter(t => !qt.has(t)).length;
 return {similarity: sim, sequelMismatch, remakeMismatch, yearGap, extraWords: extra, exact: normalizeTitle(query) === normalizeTitle(candidate) || compact(query) === compact(candidate)};
}
// Pontua um candidato (0..1) combinando título, plataforma e ano.
export function scoreCandidate(query, candidate, {platformMatch = null, queryYear = null, candidateYear = null, aliases = []} = {}) {
 const names = [candidate, ...aliases].filter(Boolean);
 let best = null;
 for (const name of names) { const c = compareTitles(query, name, {queryYear, candidateYear}); if (!best || c.similarity > best.similarity) best = c; }
 if (!best) return {score: 0};
 let score = best.similarity;
 if (best.sequelMismatch) score -= .35;
 if (best.remakeMismatch) score -= .2;
 if (!best.exact && best.extraWords) score -= Math.min(.15, best.extraWords * .04);
 if (platformMatch === true) score += .08; else if (platformMatch === false) score -= .25;
 if (best.yearGap !== null) score -= best.yearGap === 0 ? -.03 : Math.min(.15, best.yearGap * .03);
 return {...best, score: Math.max(0, Math.min(1, score))};
}
// Decide se o melhor candidato pode ser aceito sem perguntar: precisa ser forte e
// claramente melhor que o segundo (mesma regra de "gap de ambiguidade" do NativeGameLink).
export function confidentChoice(scored, {min = .9, gap = .08} = {}) {
 const list = [...scored].sort((a, b) => b.score - a.score);
 if (!list.length || list[0].score < min) return null;
 if (list[1] && list[0].score - list[1].score < gap && !list[0].exact) return null;
 if (list[1] && list[1].exact && list[0].exact && list[1].score >= list[0].score - .01) return null;
 return list[0];
}

// Nome do jogo sem o sufixo de edição da loja ("20 Year Celebration", "Definitive Edition", "GOTY"...): na Steam e nos
// bancos de dados o mesmo jogo costuma estar com o nome base. Devolve o próprio nome quando não há sufixo de edição.
const EDITION_WORDS = "(?:(?:the\\s+)?(?:\\d+(?:st|nd|rd|th)?\\s+)?(?:anniversary|year|years|celebration|edition|goty|game of the year|deluxe|definitive|complete|ultimate|gold|premium|platinum|digital|standard|collector'?s|director'?s cut|special|legendary|enhanced edition|bundle|pack|launch)(?:\\s+(?:anniversary|year|years|celebration|edition|of the year|cut|bundle|pack))*)";
const EDITION_SUFFIX = new RegExp('\\s*(?:[:\\-\u2013(]\\s*)' + EDITION_WORDS + '[\\s)]*$', 'i');
const EDITION_TAIL = new RegExp('\\s+(?:\\d+\\s+years?\\s+celebration|(?:goty|game of the year|definitive|deluxe|complete|ultimate|gold|premium|anniversary|digital deluxe|collector\'?s)\\s+edition|goty)\\s*$', 'i');
export function editionBase(value) {
 let t = String(value || '').replace(/[™®©]/g, '').trim(), prev;
 do { prev = t; t = t.replace(EDITION_SUFFIX, '').replace(EDITION_TAIL, '').trim(); } while (t !== prev && t.length > 2);
 return t.length > 2 ? t : String(value || '').trim();
}

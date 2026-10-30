// Cartas colecionáveis dos jogos de emulador (só visuais, na página do jogo): moldura azul no estilo das cartas da
// Steam, nome no topo, a imagem no meio e a logo do jogo embaixo. Cada carta é um SVG com as imagens embutidas, então
// funciona como uma imagem comum na página (inclusive com a animação de inclinação e o brilho das cartas da Steam).
//  - Personagens: IGDB (foto "mug shot" de cada personagem ligado ao jogo).
//  - Sem personagens: imagens de conquistas do jogo, escolhidas ao acaso (sempre as mesmas para o mesmo jogo).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const mime = file => /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
export const CARD_W = 240, CARD_H = 300;

function dataUri(file) {
 try { const b = fs.readFileSync(file); if (!b.length || b.length > 6 * 1024 * 1024) return ''; return 'data:' + mime(file) + ';base64,' + b.toString('base64'); } catch { return ''; }
}
// Ordem "aleatória" estável: a mesma para o mesmo jogo (as cartas não mudam a cada abertura da página).
export function seededPick(list, seed, count) {
 const scored = list.map((item, i) => ({item, k: createHash('sha1').update(String(seed) + ':' + i).digest().readUInt32BE(0)}));
 return scored.sort((a, b) => a.k - b.k).slice(0, count).map(x => x.item);
}
// Nome em uma ou duas linhas, cortado para caber na faixa do topo.
function fitName(name, max = 26) { const t = String(name || '').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; }

export function cardSvg({image, name, kind = 'character', logo = '', title = ''}) {
 const W = CARD_W, H = CARD_H, img = dataUri(image), lg = logo ? dataUri(logo) : '';
 const art = {x: 12, y: 30, w: W - 24, h: 206};
 const id = createHash('sha1').update(String(image) + name).digest('hex').slice(0, 8);
 const picture = !img ? `<rect x="${art.x}" y="${art.y}" width="${art.w}" height="${art.h}" fill="#1b2838"/>`
  : kind === 'achievement'
   // Ícone de conquista (pequeno): fundo com o próprio ícone ampliado e desfocado, ícone nítido no centro.
   ? `<g clip-path="url(#c${id})"><image href="${img}" x="${art.x - 20}" y="${art.y - 20}" width="${art.w + 40}" height="${art.h + 40}" preserveAspectRatio="xMidYMid slice" filter="url(#b${id})" opacity=".85"/><rect x="${art.x}" y="${art.y}" width="${art.w}" height="${art.h}" fill="#000" opacity=".25"/><image href="${img}" x="${art.x + art.w / 2 - 64}" y="${art.y + art.h / 2 - 64}" width="128" height="128" preserveAspectRatio="xMidYMid meet" style="image-rendering:auto"/></g>`
   : `<g clip-path="url(#c${id})"><image href="${img}" x="${art.x}" y="${art.y}" width="${art.w}" height="${art.h}" preserveAspectRatio="${kind === 'scene' ? 'xMidYMid' : 'xMidYMin'} slice"/></g>`;
 const bottom = lg
  ? `<image href="${lg}" x="${W / 2 - 92}" y="${H - 58}" width="184" height="44" preserveAspectRatio="xMidYMid meet"/>`
  : `<text x="${W / 2}" y="${H - 28}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" letter-spacing="2.5" fill="#e8eef5">${esc(fitName(String(title).toUpperCase(), 20))}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6db3"/><stop offset=".5" stop-color="#173f74"/><stop offset="1" stop-color="#0d2547"/></linearGradient>
<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fc8ff" stop-opacity=".9"/><stop offset=".5" stop-color="#3a7fd0" stop-opacity=".6"/><stop offset="1" stop-color="#8fc8ff" stop-opacity=".9"/></linearGradient>
<clipPath id="c${id}"><rect x="${art.x}" y="${art.y}" width="${art.w}" height="${art.h}"/></clipPath>
<filter id="b${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="7" fill="url(#f${id})" stroke="url(#g${id})" stroke-width="2"/>
<rect x="8" y="7" width="${W - 16}" height="20" rx="2" fill="#0b1a2e" opacity=".85"/>
<text x="14" y="21.5" font-family="'Motiva Sans', Arial, sans-serif" font-size="12.5" fill="#ffffff">${esc(fitName(name))}</text>
${picture}
<rect x="${art.x}" y="${art.y}" width="${art.w}" height="${art.h}" fill="none" stroke="#5b9be0" stroke-opacity=".55" stroke-width="1.5"/>
<rect x="${art.x}" y="${H - 62}" width="${art.w}" height="52" fill="#06090f" opacity=".9"/>
${bottom}
</svg>`;
}

// Fontes das cartas, nesta ordem, até `max` cartas:
//  1. personagens do IGDB (foto e nome);
//  2. conquistas do jogo (RetroAchievements, troféus...), escolhidas ao acaso, sempre as mesmas para o mesmo jogo;
//  3. artes e capturas de tela do IGDB;
//  4. imagens que o programa já tem do jogo (capturas do libretro, fundo, capa).
// igAvailable/ig: IGDB (endpoint 'games' ou 'characters'); image(url) → arquivo salvo em art/; achievements() → lista;
// media() → [{file, name}] já no PC.
export async function cardSet(game, {igAvailable = () => false, ig, image, achievements, media = () => [], artDir, max = 8, platformIgdb = 0, log = () => {}} = {}) {
 const out = [], sources = new Set(), have = f => out.some(x => x.file === f);
 const push = (item, src) => { if (out.length >= max || !item.file || have(item.file) || !fs.existsSync(path.join(artDir, item.file))) return; out.push(item); sources.add(src); };
 const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[™®©]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
 let igdbGame = null;
 if (igAvailable() && ig) {
  try {
   let id = Number(game.igdbId) || 0;
   if (!id && game.title) {
    const names = [...new Set([game.title, game.storeTitleEn, game.wikiEnTitle].filter(Boolean))];
    for (const name of names) {
     const found = await ig(`search ${JSON.stringify(String(name).slice(0, 120))}; fields id,name,platforms,alternative_names.name; limit 10;`);
     const exact = (found || []).filter(g => [g.name, ...(g.alternative_names || []).map(a => a.name)].some(n => norm(n) === norm(name)));
     const onPlatform = platformIgdb ? exact.filter(g => (g.platforms || []).includes(platformIgdb)) : [];
     const pick = onPlatform.length === 1 ? onPlatform[0] : exact.length === 1 ? exact[0] : null;
     if (pick) { id = pick.id; break; }
    }
   }
   if (id) {
    try {
     const chars = await ig(`fields name,mug_shot.image_id; where games = (${id}) & mug_shot != null; limit 30;`, 'characters');
     for (const c of Array.isArray(chars) ? chars : []) {
      const imageId = c?.mug_shot?.image_id; if (!imageId || !c.name) continue;
      try { push({name: String(c.name).slice(0, 60), file: await image('https://images.igdb.com/igdb/image/upload/t_cover_big/' + imageId + '.jpg'), kind: 'character'}, 'igdb'); } catch {}
     }
    } catch (e) { log('Cartas (personagens do IGDB): ' + e.message); }
    try { igdbGame = (await ig(`fields name,artworks.image_id,screenshots.image_id; where id = ${id};`))?.[0] || null; } catch {}
   }
  } catch (e) { log('Cartas (IGDB): ' + e.message); }
 }
 const characters = out.length;
 // Poucos personagens (ou nenhum): conquistas do jogo, ao acaso.
 if (characters < 3) {
  try {
   const list = (await achievements() || []).filter(a => /^https:\/\//.test(String(a.icon || '')) && a.title);
   for (const a of seededPick(list, game.id || game.uuid || game.title, max)) { if (out.length >= max) break; try { push({name: String(a.title).slice(0, 60), file: await image(a.icon), kind: 'achievement'}, 'achievements'); } catch {} }
  } catch (e) { log('Cartas (conquistas): ' + e.message); }
 }
 // Ainda faltando: cenas do jogo (artes e capturas do IGDB, depois as imagens que o programa já tem).
 if (out.length < max) {
  const scenes = [...(igdbGame?.artworks || []), ...(igdbGame?.screenshots || [])].map(x => x?.image_id).filter(Boolean);
  for (const imageId of seededPick(scenes, (game.id || game.title) + ':scene', max)) { if (out.length >= max) break; try { push({name: String(game.title).slice(0, 60), file: await image('https://images.igdb.com/igdb/image/upload/t_720p/' + imageId + '.jpg'), kind: 'scene'}, 'igdb-scenes'); } catch {} }
 }
 if (out.length < max) for (const m of media() || []) push({name: String(m.name || game.title).slice(0, 60), file: m.file, kind: 'scene'}, 'local');
 const source = sources.has('igdb') ? 'igdb' : sources.has('achievements') ? 'achievements' : sources.size ? 'scenes' : '';
 return {at: Date.now(), source, items: out};
}

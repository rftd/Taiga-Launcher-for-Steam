// Faxina da pasta de dados: apaga o que só ocupa espaço e nunca mais é usado.
//  - updates: pacotes de atualização já instalados (cada um tem ~150 MB);
//  - backups: cópias de segurança antigas de atalhos e artes da Steam (fica só as mais recentes);
//  - art: imagens que nenhum jogo, cache ou registro usa mais (galerias vistas, artes trocadas), com 3+ dias;
//  - cache/community-thumbs: miniaturas antigas (são refeitas na hora se precisar).
// Tudo devagar e em segundo plano (cede a vez a cada lote), para não pesar no programa nem na Steam.
import fs from 'node:fs';
import path from 'node:path';

const DAY = 864e5;
const tick = () => new Promise(r => setImmediate(r));
const list = dir => { try { return fs.readdirSync(dir, {withFileTypes: true}); } catch { return []; } };
const stat = f => { try { return fs.statSync(f); } catch { return null; } };
const sizeOf = f => { const s = stat(f); if (!s) return 0; if (!s.isDirectory()) return s.size; let n = 0; for (const e of list(f)) n += sizeOf(path.join(f, e.name)); return n; };
const versionOf = name => (String(name).match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
const older = (a, b) => { for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); return false; };
// Nome de arte usado pelo programa: hash hexadecimal + extensão de imagem.
const ART_NAME = /[a-f0-9]{16,64}\.(?:png|jpe?g|ico|webp)/gi;

export function createHousekeeping({dataDir, version, games = () => [], extraRefs = () => [], log = () => {}, now = () => Date.now()}) {
 let running = null;
 const removed = {files: 0, bytes: 0};
 const drop = (f, recursive = false) => { const n = sizeOf(f); try { fs.rmSync(f, {recursive, force: true}); removed.files++; removed.bytes += n; return true; } catch { return false; } };

 // Pacotes de atualização: só o da versão mais nova que a atual pode ainda ser útil.
 function updates() {
  const dir = path.join(dataDir, 'updates'), cur = versionOf(version);
  for (const e of list(dir)) {
   const f = path.join(dir, e.name), st = stat(f); if (!st) continue;
   if (/\.part$/i.test(e.name) && now() - st.mtimeMs > DAY) drop(f);
   else if (/\.zip$/i.test(e.name) && !older(cur, versionOf(e.name))) drop(f);
   else if (/\.ps1$/i.test(e.name) && now() - st.mtimeMs > DAY) drop(f);
  }
 }
 // Backups: as N cópias mais novas de cada conta; transações que falharam ficam 30 dias para recuperação manual.
 function backups() {
  const root = path.join(dataDir, 'backups');
  for (const acc of list(root)) {
   if (!acc.isDirectory()) continue;
   const dir = path.join(root, acc.name);
   if (acc.name === 'artwork') {
    for (const a of list(dir)) {
     if (!a.isDirectory()) continue;
     const tx = list(path.join(dir, a.name)).filter(e => e.isDirectory()).map(e => e.name).sort().reverse();
     for (const name of tx.slice(5)) {
      const f = path.join(dir, a.name, name); let status = '';
      try { status = JSON.parse(fs.readFileSync(path.join(f, 'manifest.json'), 'utf8')).status || ''; } catch {}
      const ts = Number(name.split('-')[0]) || 0;
      if (status === 'recovery-needed' && now() - ts < 30 * DAY) continue;
      drop(f, true);
     }
    }
    continue;
   }
   // Arquivos "<tempo>-<nome>": os 15 mais novos de cada tipo.
   const groups = new Map();
   for (const e of list(dir)) { if (!e.isFile()) continue; const m = e.name.match(/^(\d{10,})-(.+)$/); if (!m) continue; if (!groups.has(m[2])) groups.set(m[2], []); groups.get(m[2]).push(e.name); }
   for (const names of groups.values()) for (const name of names.sort().reverse().slice(15)) drop(path.join(dir, name));
  }
 }
 // Relatórios e diagnósticos antigos: guarda os mais recentes.
 function reports() {
  const keep = (dir, n, test = () => true) => { const files = list(dir).filter(e => e.isFile() && test(e.name)).map(e => ({name: e.name, t: stat(path.join(dir, e.name))?.mtimeMs || 0})).sort((a, b) => b.t - a.t); for (const f of files.slice(n)) drop(path.join(dir, f.name)); };
  keep(path.join(dataDir, 'relatorios'), 20);
  keep(dataDir, 3, n => /^diagnostico-.*\.json$/i.test(n));
 }
 // Miniaturas: some quem tem mais de 30 dias e o total fica abaixo de 120 MB (as mais antigas saem primeiro).
 async function thumbs() {
  const dir = path.join(dataDir, 'cache', 'community-thumbs');
  const files = list(dir).filter(e => e.isFile()).map(e => { const f = path.join(dir, e.name), s = stat(f); return s ? {f, t: s.mtimeMs, n: s.size} : null; }).filter(Boolean).sort((a, b) => b.t - a.t);
  let total = 0, i = 0;
  for (const x of files) { total += x.n; if (now() - x.t > 30 * DAY || total > 120 * 1024 * 1024) drop(x.f); if (++i % 200 === 0) await tick(); }
 }
 // Artes órfãs: tudo o que o programa guarda (jogos, caches, registros em JSON) é lido atrás de nomes de arte;
 // o que ninguém cita e tem 3+ dias sai. Sem a lista de jogos (arquivo ilegível), nada é apagado.
 async function art() {
  const dir = path.join(dataDir, 'art'), files = list(dir).filter(e => e.isFile());
  if (!files.length) return;
  const all = games(); if (!Array.isArray(all) || !all.length) return;
  const refs = new Set();
  const take = text => { for (const m of String(text).matchAll(ART_NAME)) refs.add(m[0].toLowerCase()); };
  take(JSON.stringify(all));
  for (const r of extraRefs() || []) take(r);
  const scan = async d => {
   for (const e of list(d)) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!['art', 'backups', 'updates', 'downloads', 'community-thumbs', 'not-installed'].includes(e.name) && await scan(f) === false) return false; continue; }
    if (!/\.json$/i.test(e.name)) continue;
    const s = stat(f); if (!s || s.size > 64 * 1024 * 1024) { if (s) return false; continue; }
    try { take(fs.readFileSync(f, 'utf8')); } catch { return false; }
    await tick();
   }
   return true;
  };
  if (await scan(dataDir) === false) return;
  let i = 0;
  for (const e of files) {
   const name = e.name.toLowerCase();
   if (!/^[a-f0-9]{16,64}\.(?:png|jpe?g|ico|webp)$/.test(name) || refs.has(name)) continue;
   const f = path.join(dir, e.name), s = stat(f);
   if (s && now() - s.mtimeMs > 3 * DAY) drop(f);
   if (++i % 100 === 0) await tick();
  }
 }

 async function run() {
  if (running) return running;
  removed.files = 0; removed.bytes = 0;
  running = (async () => {
   for (const [name, step] of [['updates', updates], ['backups', backups], ['reports', reports], ['thumbs', thumbs], ['art', art]]) {
    try { await step(); } catch (e) { log('Limpeza (' + name + '): ' + e.message); }
    await tick();
   }
   if (removed.files) log('Limpeza: ' + removed.files + ' arquivo(s) antigo(s) removido(s), ' + (removed.bytes / 1048576).toFixed(1) + ' MB liberados.');
   return {...removed};
  })().finally(() => { running = null; });
  return running;
 }
 // Espaço usado pela pasta de dados, por parte (para a tela de configurações).
 function usage() {
  const parts = {};
  for (const e of list(dataDir)) parts[e.isDirectory() ? e.name : 'files'] = (parts[e.isDirectory() ? e.name : 'files'] || 0) + sizeOf(path.join(dataDir, e.name));
  return {total: Object.values(parts).reduce((a, b) => a + b, 0), parts};
 }
 return {run, usage};
}

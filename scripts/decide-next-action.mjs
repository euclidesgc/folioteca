#!/usr/bin/env node
/* The loop's decision: what the next session does, read from the state.

   ## Why the decision does not live in the shell

   A shell script is the only layer here without lint, types or tests. An
   autonomous engine that decides wrong in silence is the expensive version of
   a gate that exits 0 because it could not measure — it decides wrong all
   night. So the decision is a pure function over the state, exported and
   testable; the `.sh` only calls it and obeys.

   ## What it never decides

   Merging. It opens a stacked PR and stops. Merge is irreversible for someone
   who is asleep, and the stack exists precisely so the merge is a decision the
   developer takes later, awake, all at once.

   ## Usage

   `node scripts/decide-next-action.mjs [--root <dir>]`
   Prints JSON on stdout. Exit code: `0` there is an action, `1` stop. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Same ceiling as the harness state machine. A third attempt without a
   diagnosis reproduces the same error with more tokens, and the developer
   wakes up to thirty identical commits. */
const REJECTION_CEILING = 2;

const STAGE_ORDER = ['discovery', 'prd', 'spec', 'plan', 'execute', 'done'];

const stop = (reason, extra = {}) => ({ action: 'stop', reason, ...extra });

export const countPhases = (root = ROOT, item = '') => {
  const file = join(root, 'product', 'items', item, '03-plan.md');
  if (!existsSync(file)) return 0;
  return [...readFileSync(file, 'utf8').matchAll(/^##+ +Fase +(\d+)/gm)].length;
};

export const readRoadmapQueue = (root = ROOT) => {
  const file = join(root, 'product', 'roadmap.md');
  if (!existsSync(file)) return [];
  const body = readFileSync(file, 'utf8');
  return [...body.matchAll(/- \[( |-)\] `(\d{3}-[a-z0-9-]+)`/g)].map((m) => ({
    id: m[2],
    started: m[1] === '-',
  }));
};

export const decide = (state, root = ROOT, queue = readRoadmapQueue(root)) => {
  if (state === null || state === undefined) {
    return stop('could not read product/state.json');
  }

  const id = state.active_item;
  const items = state.items ?? {};

  if (!id || !items[id] || items[id].stage === 'done') {
    const pending = queue.filter((entry) => !items[entry.id] || items[entry.id].stage !== 'done');
    const next = pending[0];
    if (!next) return stop('every roadmap item is done — nothing left to pull');
    if (items[next.id]) {
      return { action: 'activate', item: next.id, stage: items[next.id].stage };
    }
    return { action: 'create', item: next.id, stage: 'discovery' };
  }

  const item = items[id];

  if (item.status === 'escalada_humana') {
    return stop(`item ${id} escalated to a human — a diagnosis comes before another attempt`);
  }

  const blocking = Object.entries(item.divergences ?? {}).filter(
    ([, d]) => d.type === 'contrato' && d.status !== 'aprovada' && d.status !== 'reconciliada',
  );
  if (blocking.length > 0) {
    return stop(
      `contract divergence ${blocking[0][0]} is unratified — a wrong contract premise spreads to every consumer`,
    );
  }

  const stage = item.stage;
  if (!STAGE_ORDER.includes(stage)) return stop(`unknown stage: ${stage}`);

  if (stage !== 'execute') {
    return { action: 'stage', item: id, stage, plan: null };
  }

  const phases = item.phases ?? {};
  const rejections = Object.values(phases).filter((p) => p?.result === 'REPROVADO').length;
  if (rejections >= REJECTION_CEILING && item.current_phase !== null) {
    const current = phases[String(item.current_phase)];
    if (current?.result === 'REPROVADO') {
      return stop(`phase ${item.current_phase} was rejected ${REJECTION_CEILING}x — the cause is upstream`);
    }
  }

  /* A fase corrente aprovada não é a próxima tarefa: é a anterior. Sem este
     passo o motor reabre a fase que acabou de fechar e a noite anda em círculo
     — que é como o ensaio a seco de 02/09 flagrou o defeito. */
  const current = item.current_phase;
  const aprovada = current !== null && phases[String(current)]?.status === 'aprovada';
  const alvo = aprovada ? Number(current) + 1 : current;
  const total = countPhases(root, id);

  if (total > 0 && alvo !== null && alvo > total) {
    return { action: 'close', item: id, stage, reason: `as ${total} fases estão aprovadas` };
  }

  return {
    action: 'phase',
    item: id,
    stage,
    phase: alvo,
    plan: join('product', 'items', id, '03-plan.md'),
  };
};

const readState = (root) => {
  const file = join(root, 'product', 'state.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const flag = process.argv.indexOf('--root');
  const root = flag === -1 ? ROOT : resolve(process.argv[flag + 1]);
  const decision = decide(readState(root), root);
  decision.prompt = join('product', 'prompt-da-proxima-sessao.md');
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  process.exit(decision.action === 'stop' ? 1 : 0);
}

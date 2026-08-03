#!/usr/bin/env node
/**
 * Memory bank index audit.
 *
 * Enforces the rules in memory_bank/dna/: valid frontmatter, a `derived_from`
 * on every non-root active document, resolvable relative links, and
 * reachability from an index (principle 7 — an orphan file is a defect).
 *
 * Usage: node scripts/check-memory-bank.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANK = join(ROOT, 'memory_bank');
const ROOT_DOC = join(BANK, 'dna', 'principles.md');

const findings = [];
const report = (file, message) => findings.push(`${relative(ROOT, file)}: ${message}`);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** Minimal frontmatter reader: enough for the fields the schema defines. */
function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) {
    return null;
  }
  const end = source.indexOf('\n---', 4);
  if (end === -1) {
    return null;
  }
  const block = source.slice(4, end);
  const fields = {};
  let currentList = null;

  for (const line of block.split('\n')) {
    if (/^\s*-\s+/.test(line) && currentList) {
      fields[currentList].push(line.replace(/^\s*-\s+/, '').trim());
      continue;
    }
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (value === '') {
      currentList = key;
      fields[key] = [];
    } else {
      currentList = null;
      fields[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return fields;
}

const LINK = /\[[^\]]*\]\(([^)]+)\)/g;

function linksOf(source) {
  const out = [];
  for (const match of source.matchAll(LINK)) {
    const target = match[1];
    if (!/^(https?:|mailto:|#)/.test(target)) {
      out.push(target.split('#')[0]);
    }
  }
  return out;
}

const files = walk(BANK).sort();
const linkedTo = new Set();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(source);

  if (!fm) {
    report(file, 'missing or malformed YAML frontmatter');
    continue;
  }
  if (!fm.status) {
    report(file, 'frontmatter is missing required field: status');
  }
  if (!fm.purpose) {
    report(file, 'frontmatter is missing required field: purpose');
  }
  if (fm.status === 'active' && file !== ROOT_DOC && !fm.derived_from) {
    report(file, 'active non-root document must declare derived_from');
  }
  if (fm.doc_kind === 'adr' && fm.doc_function === 'canonical' && !fm.decision_status) {
    report(file, 'ADR must declare decision_status');
  }

  // Templates carry placeholder paths that only resolve once copied into place.
  const isTemplate = file.includes('/templates/');

  for (const entry of isTemplate ? [] : (fm.derived_from ?? [])) {
    const path = entry.startsWith('path:') ? entry.slice(5).trim() : entry;
    if (!path || path.startsWith('{')) {
      continue;
    }
    const resolved = resolve(dirname(file), path);
    try {
      statSync(resolved);
    } catch {
      report(file, `derived_from points at a missing document: ${path}`);
    }
  }

  for (const target of linksOf(source)) {
    if (!target) {
      continue;
    }
    const resolved = resolve(dirname(file), target);
    try {
      statSync(resolved);
      linkedTo.add(resolved);
    } catch {
      // Templates intentionally contain placeholder paths.
      if (!file.includes('/templates/')) {
        report(file, `broken link: ${target}`);
      }
    }
  }
}

const bankRoot = join(BANK, 'README.md');
for (const file of files) {
  if (file === bankRoot || linkedTo.has(file)) {
    continue;
  }
  report(file, 'orphan: not linked from any index (dna/principles.md, rule 7)');
}

if (findings.length > 0) {
  process.stdout.write(`memory bank: ${findings.length} finding(s)\n`);
  for (const finding of findings) {
    process.stdout.write(`  - ${finding}\n`);
  }
  process.exit(1);
}

process.stdout.write(`memory bank: ${files.length} documents, no findings\n`);

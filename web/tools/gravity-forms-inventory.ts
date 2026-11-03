import { stdin } from 'node:process';

// A custom field type can contain arbitrary text. Only these literals may leave the export.
const fieldTypes = new Set([
  'address', 'calculation', 'captcha', 'checkbox', 'consent', 'creditcard', 'date',
  'donation', 'email', 'fileupload', 'hidden', 'html', 'list', 'multiselect', 'name',
  'number', 'option', 'page', 'password', 'phone', 'post_category', 'post_content',
  'post_custom_field', 'post_excerpt', 'post_image', 'post_tags', 'post_title', 'product',
  'quantity', 'radio', 'repeater', 'section', 'select', 'shipping', 'signature',
  'stripe_creditcard', 'text', 'textarea', 'time', 'total', 'website'
]);
const maxBytes = 8 * 1024 * 1024;

function unsupported(): never {
  throw new Error('Unsupported form definition.');
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function id(value: unknown): number {
  const n = typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : unsupported();
}

function optionalList(value: unknown): unknown[] {
  if (value == null || value === '') return [];
  return Array.isArray(value) && value.every(record) ? value : unsupported();
}

function settingCount(value: unknown) {
  if (value == null) return null;
  if (!record(value) && !Array.isArray(value)) return unsupported();
  const settings = Object.values(value);
  return settings.every(record) ? settings.length : unsupported();
}

function requiredFlag(value: unknown) {
  if (value == null || value === '') return null;
  switch (value) {
    case true: case 1: case '1': case 'true': return true;
    case false: case 0: case '0': case 'false': return false;
    default: return unsupported();
  }
}

function conditional(value: unknown) {
  if (value === undefined) return { conditionalStatus: 'omitted', conditionalRuleCount: 0 } as const;
  if (value === null || value === '' || value === false) return { conditionalStatus: 'none', conditionalRuleCount: 0 } as const;
  if (!record(value) || !Array.isArray(value.rules) || !value.rules.every(record)) return unsupported();
  return { conditionalStatus: 'configured', conditionalRuleCount: value.rules.length } as const;
}

type Field = {
  id: number; type: string; required: boolean | null; inputCount: number;
  choiceCount: number; conditionalStatus: 'omitted' | 'none' | 'configured';
  conditionalRuleCount: number; children?: Field[];
};

function summarizeForm(value: unknown) {
  if (!record(value) || !Array.isArray(value.fields) || 'entries' in value) return unsupported();
  const seen = new Set<number>();
  function field(raw: unknown, depth: number): Field {
    if (depth > 8 || !record(raw) || typeof raw.type !== 'string' || !raw.type) return unsupported();
    const fieldId = id(raw.id);
    if (seen.has(fieldId)) return unsupported();
    seen.add(fieldId);
    const children = optionalList(raw.fields);
    return {
      id: fieldId, type: fieldTypes.has(raw.type) ? raw.type : 'other',
      required: requiredFlag(raw.isRequired), inputCount: optionalList(raw.inputs).length,
      choiceCount: optionalList(raw.choices).length, ...conditional(raw.conditionalLogic),
      ...(children.length ? { children: children.map((item) => field(item, depth + 1)) } : {})
    };
  }
  const fields = value.fields.map((item) => field(item, 1));
  return {
    id: id(value.id), fieldCount: seen.size, fields,
    notificationCount: settingCount(value.notifications), confirmationCount: settingCount(value.confirmations)
  };
}

export function inventory(raw: unknown) {
  let definitions: unknown[];
  if (Array.isArray(raw)) definitions = raw;
  else if (record(raw) && 'fields' in raw) definitions = [raw];
  else if (record(raw)) {
    // Gravity Forms exports can wrap numbered forms alongside a version property.
    const entries = Object.entries(raw).filter(([key]) => key !== 'version');
    if (!entries.every(([key]) => /^\d+$/.test(key))) return unsupported();
    definitions = entries.map(([, value]) => value);
  } else return unsupported();
  if (!definitions.length) return unsupported();
  const forms = definitions.map(summarizeForm).sort((a, b) => a.id - b.id);
  if (forms.some((form, i) => form.id === forms[i - 1]?.id)) return unsupported();
  return { schemaVersion: 1, formCount: forms.length, forms };
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2 || stdin.isTTY) throw new Error();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stdin) {
      size += chunk.length;
      if (size > maxBytes) throw new Error();
      chunks.push(chunk);
    }
    const input = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    console.log(JSON.stringify(inventory(JSON.parse(input)), null, 2));
  } catch {
    // Parser errors can quote private input. Never print them or a partial inventory.
    console.error('Inventory failed. Supply a supported UTF-8 Gravity Forms definition export (up to 8 MiB) on standard input.');
    process.exitCode = 1;
  }
}

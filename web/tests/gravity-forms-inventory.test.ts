import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory } from '../tools/gravity-forms-inventory';

function cli(input: string | Buffer) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../tools/gravity-forms-inventory.ts', import.meta.url))], {
    input, encoding: 'utf8'
  });
}

const privateText = 'PRIVATE_FIXTURE_MARKER';
const form = {
  id: '8', title: privateText, fields: [
    { id: '2', type: 'name', isRequired: '1', inputs: [{ id: '2.3', label: privateText }, { id: '2.6' }], label: privateText },
    { id: 4, type: 'repeater', isRequired: 'false', fields: [
      { id: 5, type: privateText, defaultValue: privateText, choices: [{ text: privateText, value: privateText }],
        conditionalLogic: { rules: [{ fieldId: 2, value: privateText }] } }
    ] }
  ], notifications: { [privateText]: { to: privateText, message: privateText } }, confirmations: {},
  feeds: { [privateText]: { settings: privateText } }
};

describe('Gravity Forms definition inventory', () => {
  test('emits only structural field data and counts through the CLI', () => {
    const run = cli(JSON.stringify({ '0': form, version: 'synthetic' }));
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).not.toContain(privateText);
    expect(JSON.parse(run.stdout)).toEqual({
      schemaVersion: 1, formCount: 1, forms: [{
        id: 8, fieldCount: 3, notificationCount: 1, confirmationCount: 0, fields: [
          { id: 2, type: 'name', required: true, inputCount: 2, choiceCount: 0, conditionalStatus: 'omitted', conditionalRuleCount: 0 },
          { id: 4, type: 'repeater', required: false, inputCount: 0, choiceCount: 0, conditionalStatus: 'omitted', conditionalRuleCount: 0, children: [
            { id: 5, type: 'other', required: null, inputCount: 0, choiceCount: 1, conditionalStatus: 'configured', conditionalRuleCount: 1 }
          ] }
        ]
      }]
    });
  });

  test('matches single and wrapped definitions; form order is deterministic', () => {
    const empty = { id: 1, fields: [] };
    expect(inventory(form)).toEqual(inventory([form]));
    expect(inventory([form, empty])).toEqual(inventory({ 8: form, 1: empty }));
    expect(inventory([form, empty]).forms[0]).toMatchObject({ id: 1, fieldCount: 0, notificationCount: null, confirmationCount: null });
  });


  test('distinguishes omitted, disabled and configured conditional logic without rule contents', () => {
    const variants = [undefined, false, null, '', { rules: [] }, { rules: [{ value: privateText }] }];
    const result = inventory({ id: 1, fields: variants.map((conditionalLogic, i) => ({
      id: i + 1, type: 'text', isRequired: i % 2 === 0, conditionalLogic
    })) });
    expect(result.forms[0].fields.map(({ conditionalStatus, conditionalRuleCount }) =>
      [conditionalStatus, conditionalRuleCount])).toEqual([
      ['omitted', 0], ['none', 0], ['none', 0], ['none', 0], ['configured', 0], ['configured', 1]
    ]);
    expect(JSON.stringify(result)).not.toContain(privateText);
  });

  test('accepts the byte limit and rejects excessive nested fields', () => {
    const json = JSON.stringify({ id: 1, fields: [] });
    const run = cli(json + ' '.repeat(8 * 1024 * 1024 - Buffer.byteLength(json)));
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    let field: Record<string, unknown> = { id: 9, type: 'text' };
    for (let n = 8; n > 0; n--) field = { id: n, type: 'repeater', fields: [field] };
    const tooDeep = cli(JSON.stringify({ id: 1, fields: [field] }));
    expect(tooDeep.status).toBe(1);
    expect(tooDeep.stdout).toBe('');
  });

  test('rejects entries, invalid metadata and ambiguous identities without partial output', () => {
    for (const input of [
      { entries: [{ id: 8, form_id: 2, '1': privateText }] }, [{ id: 8, form_id: 2, '1': privateText }],
      { ...form, entries: [] }, {}, [form, form], { ...form, notifications: { unexpected: privateText } },
      { ...form, fields: [{ id: 1, type: 'text' }, { id: '1', type: 'name' }] },
      { ...form, fields: [{ id: 1, type: 'text', isRequired: privateText }] },
      { ...form, fields: [{ id: privateText, type: 'text' }] },
      { ...form, fields: [{ id: 1, type: 'text', choices: [privateText] }] },
      { ...form, fields: [{ id: 1, type: 'text', conditionalLogic: { rules: [privateText] } }] },
      { forms: [form] }, 'valid JSON, unsupported structure', null, [privateText],
      { ...form, id: Number.MAX_SAFE_INTEGER + 1 }
    ]) expect(() => inventory(input)).toThrow('Unsupported form definition.');
    for (const input of [
      '{"title":"' + privateText, JSON.stringify([form, { id: 9, fields: privateText }]),
      JSON.stringify({ entries: [{ email: privateText, token: privateText }] }),
      JSON.stringify({ forms: [form] }), '<xml>' + privateText + '</xml>',
      Buffer.from([0xff, 0xfe]), Buffer.alloc(8 * 1024 * 1024 + 1, 32)
    ]) {
      const run = cli(input);
      expect(run.status).toBe(1);
      expect(run.stdout).toBe('');
      expect(run.stderr).toMatch(/^Inventory failed\.[^\n]+\n$/);
      expect(run.stderr).not.toContain(privateText);
    }
  });
});

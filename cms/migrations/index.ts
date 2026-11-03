import * as migration_20261028_080047 from './20261028_080047';
import * as migration_20261029_053207 from './20261029_053207';
import * as migration_20261029_053550 from './20261029_053550';
import * as migration_20261031_220233 from './20261031_220233';
import * as migration_20261103_012759 from './20261103_012759';

export const migrations = [
  {
    up: migration_20261028_080047.up,
    down: migration_20261028_080047.down,
    name: '20261028_080047',
  },
  {
    up: migration_20261029_053207.up,
    down: migration_20261029_053207.down,
    name: '20261029_053207',
  },
  {
    up: migration_20261029_053550.up,
    down: migration_20261029_053550.down,
    name: '20261029_053550',
  },
  {
    up: migration_20261031_220233.up,
    down: migration_20261031_220233.down,
    name: '20261031_220233',
  },
  {
    up: migration_20261103_012759.up,
    down: migration_20261103_012759.down,
    name: '20261103_012759'
  },
];

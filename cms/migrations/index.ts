import * as migration_20261028_080047 from './20261028_080047';
import * as migration_20261029_053207 from './20261029_053207';
import * as migration_20261029_053550 from './20261029_053550';
import * as migration_20261031_220233 from './20261031_220233';
import * as migration_20261103_012759 from './20261103_012759';
import * as migration_20261103_030159 from './20261103_030159';
import * as migration_20261119_014504 from './20261119_014504';
import * as migration_20261119_023303_member_lifecycle from './20261119_023303_member_lifecycle';
import * as migration_20261119_045216_mirrored_at from './20261119_045216_mirrored_at';
import * as migration_20261119_052852_invitation_link from './20261119_052852_invitation_link';

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
    name: '20261103_012759',
  },
  {
    up: migration_20261103_030159.up,
    down: migration_20261103_030159.down,
    name: '20261103_030159',
  },
  {
    up: migration_20261119_014504.up,
    down: migration_20261119_014504.down,
    name: '20261119_014504',
  },
  {
    up: migration_20261119_023303_member_lifecycle.up,
    down: migration_20261119_023303_member_lifecycle.down,
    name: '20261119_023303_member_lifecycle',
  },
  {
    up: migration_20261119_045216_mirrored_at.up,
    down: migration_20261119_045216_mirrored_at.down,
    name: '20261119_045216_mirrored_at',
  },
  {
    up: migration_20261119_052852_invitation_link.up,
    down: migration_20261119_052852_invitation_link.down,
    name: '20261119_052852_invitation_link'
  },
];

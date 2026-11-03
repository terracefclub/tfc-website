// Only call with a process-group leader created by this release runner's detached spawn.
export async function stopOwnedGroup(pid: number, hooks: {
  signal: (group: number, signal: 'SIGTERM' | 'SIGKILL') => void;
  pause: (milliseconds: number) => Promise<void>;
} = {
  signal: (group, signal) => { process.kill(group, signal) },
  pause: milliseconds => new Promise(done => setTimeout(done, milliseconds)),
}) {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error('Invalid owned process group.')
  try { hooks.signal(-pid, 'SIGTERM') }
  catch (error) { if ((error as { code?: string }).code === 'ESRCH') return; throw new Error('Could not stop owned process group.') }
  await hooks.pause(5000)
  try { hooks.signal(-pid, 'SIGKILL') }
  catch (error) { if ((error as { code?: string }).code !== 'ESRCH') throw new Error('Could not stop owned process group.') }
}

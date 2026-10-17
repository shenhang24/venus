import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Restart only after the previous server has exited and released its port.
function launch() {
  let restart = false;
  const child = fork(fileURLToPath(new URL('./server.mjs', import.meta.url)), [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
  });
  child.on('message', (message) => {
    if (message?.action === 'restart') restart = true;
    if (message?.action === 'shutdown') restart = false;
  });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code) => {
    if (restart) launch();
    else process.exitCode = code || 0;
  });
}
launch();

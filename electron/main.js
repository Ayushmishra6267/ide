const { app, BrowserWindow, ipcMain, dialog, shell: electronShell } = require('electron');
const { loadAll, userDir } = require('./extensions');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

let pty = null;
try { pty = require('node-pty'); } catch {}

let win;
const terms = new Map();
let nextTerm = 1;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#14161b',
    title: 'Mini IDE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  if (process.env.VITE_DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}

ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('fs:readDir', async (_e, dir) => {
  const items = await fs.readdir(dir, { withFileTypes: true });
  return items
    .filter((d) => d.name !== '.git' && d.name !== 'node_modules')
    .map((d) => ({ name: d.name, path: path.join(dir, d.name), isDir: d.isDirectory() }))
    .sort((a, b) => b.isDir - a.isDir || a.name.localeCompare(b.name));
});

ipcMain.handle('fs:readFile', (_e, file) => fs.readFile(file, 'utf8'));
ipcMain.handle('fs:writeFile', (_e, file, text) => fs.writeFile(file, text, 'utf8'));

ipcMain.handle('fs:createFile', async (_e, file) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '', { flag: 'wx' });
});

ipcMain.handle('fs:createDir', async (_e, dir) => {
  const exists = await fs.access(dir).then(() => true, () => false);
  if (exists) throw new Error('EEXIST');
  await fs.mkdir(dir, { recursive: true });
});

const pathExists = (p) => fs.access(p).then(() => true, () => false);

ipcMain.handle('fs:rename', async (_e, from, to) => {
  if (await pathExists(to)) throw new Error('EEXIST');
  await fs.rename(from, to);
});

ipcMain.handle('fs:duplicate', async (_e, src) => {
  const { dir, name, ext } = path.parse(src);
  let i = 1, dest;
  do { dest = path.join(dir, `${name} copy${i > 1 ? ' ' + i : ''}${ext}`); i++; } while (await pathExists(dest));
  await fs.cp(src, dest, { recursive: true });
  return dest;
});

ipcMain.handle('fs:trash', (_e, p) => electronShell.trashItem(p));
ipcMain.handle('fs:reveal', (_e, p) => electronShell.showItemInFolder(p));

const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';

ipcMain.handle('term:create', (_e, cwd, cols, rows) => {
  const id = nextTerm++;
  const send = (d) => win && !win.isDestroyed() && win.webContents.send('term:data', id, d);
  
  if (!cwd || !fsSync.existsSync(cwd)) {
    cwd = os.homedir();
  }

  const safeCols = Math.max(10, cols || 80);
  const safeRows = Math.max(5, rows || 24);

  if (pty) {
    try {
      const p = pty.spawn(shell, [], { name: 'xterm-256color', cols: safeCols, rows: safeRows, cwd, env: process.env });
      p.onData(send);
      terms.set(id, {
        write: (d) => { try { p.write(d); } catch (e) {} },
        resize: (c, r) => { try { if (c > 0 && r > 0) p.resize(c, r); } catch (e) {} },
        kill: () => { try { p.kill(); } catch (e) {} }
      });
      return id;
    } catch (err) {}
  }

  try {
    const p = spawn(shell, [], { cwd, env: process.env });
    let line = '';
    const out = (b) => send(b.toString().replace(/\r?\n/g, '\r\n'));
    if (p.stdout) p.stdout.on('data', out);
    if (p.stderr) p.stderr.on('data', out);
    send('(basic shell mode)\r\n');
    terms.set(id, {
      write: (d) => {
        try {
          for (const c of d) {
            if (c === '\r') { send('\r\n'); p.stdin.write(line + '\n'); line = ''; }
            else if (c === '\x7f') { if (line) { line = line.slice(0, -1); send('\b \b'); } }
            else if (c >= ' ') { line += c; send(c); }
          }
        } catch (e) {}
      },
      resize: () => {},
      kill: () => { try { p.kill(); } catch (e) {} }
    });
  } catch (err) {}

  return id;
});

ipcMain.on('term:write', (_e, id, d) => terms.get(id)?.write(d));
ipcMain.on('term:resize', (_e, id, c, r) => terms.get(id)?.resize(c, r));
ipcMain.on('term:kill', (_e, id) => { terms.get(id)?.kill(); terms.delete(id); });

ipcMain.handle('ext:list', () => loadAll());

ipcMain.handle('ext:detect', () =>
  Promise.all(loadAll().map((x) => new Promise((resolve) => {
    if (!x.check) return resolve({ id: x.id, installed: false, version: '' });
    exec(x.check, { timeout: 5000 }, (err, out, errOut) =>
      resolve({ id: x.id, installed: !err, version: err ? '' : String(out || errOut).split('\n')[0].trim().slice(0, 60) }));
  })))
);

ipcMain.handle('ext:openFolder', async () => {
  await fs.mkdir(userDir, { recursive: true });
  return electronShell.openPath(userDir);
});
ipcMain.handle('ext:openUrl', (_e, url) => /^https:\/\//.test(url) && electronShell.openExternal(url));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  terms.forEach((t) => t.kill());
  app.quit();
});

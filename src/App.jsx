import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import Terminal from './Terminal.jsx';
import ExtensionsPanel from './ExtensionsPanel.jsx';

const isWin = /win/i.test(navigator.platform);
const dirname = (p) => p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));

const basename = (p) => p.split(/[\\/]/).pop();

function TreeNode({ entry, depth, dirs, open, toggle, openFile, activePath, onMenu }) {
  const isOpen = open.has(entry.path);
  return (
    <>
      <div
        className={'row' + (entry.path === activePath ? ' active' : '')}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => (entry.isDir ? toggle(entry.path) : openFile(entry.path))}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e.clientX, e.clientY, entry); }}
      >
        <span className="chev">{entry.isDir ? (isOpen ? '\u25be' : '\u25b8') : ''}</span>
        {entry.name}
      </div>
      {entry.isDir && isOpen &&
        (dirs[entry.path] || []).map((c) => (
          <TreeNode key={c.path} entry={c} depth={depth + 1} {...{ dirs, open, toggle, openFile, activePath, onMenu }} />
        ))}
    </>
  );
}

export default function App() {
  const [root, setRoot] = useState(null);
  const [dirs, setDirs] = useState({});
  const [open, setOpen] = useState(new Set());
  const [tabs, setTabs] = useState([]);
  const [active, setActive] = useState(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [showTerm, setShowTerm] = useState(true);
  const [view, setView] = useState('files');
  const [exts, setExts] = useState([]);
  const [disabled, setDisabled] = useState(() => JSON.parse(localStorage.getItem('mini.disabled') || '[]'));
  const [runReq, setRunReq] = useState(null);
  const [notice, setNotice] = useState('');
  const [selDir, setSelDir] = useState(null);
  const [edit, setEdit] = useState(null);
  const [lang, setLang] = useState('');
  const [menu, setMenu] = useState(null);
  const nameRef = useRef(null);
  const [mode, setMode] = useState(() => localStorage.getItem('mini.theme') || 'dark');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem('mini.theme', mode);
  }, [resolved, mode]);

  useEffect(() => {
    const close = () => setMenu(null);
    const esc = (e) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  const flash = (m) => { setNotice(m); setTimeout(() => setNotice(''), 4000); };

  const toggleExt = (id) => {
    const next = disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id];
    setDisabled(next);
    localStorage.setItem('mini.disabled', JSON.stringify(next));
  };

  useEffect(() => {
    window.api.extList().then((list) => {
      setExts(list);
      const known = new Set(monaco.languages.getLanguages().map((l) => l.id));
      list.forEach((e) => e.language && !known.has(e.language) &&
        monaco.languages.register({ id: e.language, extensions: e.fileExtensions.map((x) => '.' + x) }));
    });
  }, []);

  const loadDir = useCallback(async (p) => {
    const items = await window.api.readDir(p);
    setDirs((d) => ({ ...d, [p]: items }));
  }, []);

  const openFolder = async () => {
    const p = await window.api.pickFolder();
    if (!p) return;
    setRoot(p); setSelDir(p); setEdit(null); setDirs({}); setOpen(new Set()); setTabs([]); setActive(null);
    loadDir(p);
  };

  const toggle = (p) => {
    setSelDir(p);
    setOpen((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
    if (!dirs[p]) loadDir(p);
  };

  const openFile = async (p) => {
    setSelDir(p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))));
    if (!tabs.find((t) => t.path === p)) {
      const content = await window.api.readFile(p);
      setTabs((t) => [...t, { path: p, content, dirty: false }]);
    }
    setActive(p);
  };

  const sep = isWin ? '\\' : '/';

  const knownExts = () => {
    const s = new Set(exts.flatMap((e) => e.fileExtensions));
    monaco.languages.getLanguages().forEach((l) =>
      (l.extensions || []).forEach((x) => s.add(x.replace(/^\./, '').toLowerCase())));
    return s;
  };

  const withLanguage = (name, pick) => {
    const base = name.split(/[\\/]/).pop();
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
    if (ext) {
      return knownExts().has(ext)
        ? { name }
        : { error: `".${ext}" is not a known language. Pick one from the list or add it in Extensions.` };
    }
    return pick
      ? { name: `${name}.${pick}` }
      : { error: 'Choose a language (or end the name with an extension like .py) to create a file.' };
  };

  const startCreate = (type, dir) => {
    setSelDir(dir);
    if (!open.has(dir)) {
      setOpen((s) => new Set(s).add(dir));
      if (!dirs[dir]) loadDir(dir);
    }
    setLang('');
    setEdit({ type });
  };

  const applyRename = (from, to) => {
    const remap = (p) => (p === from ? to : p.startsWith(from + sep) ? to + p.slice(from.length) : p);
    setTabs((ts) => ts.map((t) => ({ ...t, path: remap(t.path) })));
    setActive((a) => a && remap(a));
    setSelDir((s) => s && remap(s));
    setDirs((d) => Object.fromEntries(Object.entries(d).filter(([k]) => remap(k) === k)));
    [...open].filter((p) => remap(p) !== p).forEach((p) => loadDir(remap(p)));
    setOpen((s) => new Set([...s].map(remap)));
  };

  const submitEdit = async (raw) => {
    const name = raw.trim();
    if (!name) return flash('Enter a name.');
    if (/^[\\/]/.test(name) || name.split(/[\\/]/).includes('..')) {
      return flash('Use a relative name without ".." or a leading slash.');
    }
    try {
      if (edit.type === 'rename') {
        const { path: from, isDir } = edit.entry;
        if (/[\\/]/.test(name)) return flash('A new name cannot contain slashes.');
        let finalName = name;
        if (!isDir) {
          const r = withLanguage(name, '');
          if (r.error) return flash(r.error);
          finalName = r.name;
        }
        const parent = dirname(from);
        const to = parent + sep + finalName;
        if (to === from) return setEdit(null);
        await window.api.rename(from, to);
        applyRename(from, to);
        await loadDir(parent);
      } else {
        const parent = selDir || root;
        let finalName = name;
        if (edit.type === 'file') {
          const r = withLanguage(name, lang);
          if (r.error) return flash(r.error);
          finalName = r.name;
        }
        const target = parent + sep + finalName;
        if (edit.type === 'dir') await window.api.createDir(target);
        else await window.api.createFile(target);
        await loadDir(parent);
        setOpen((s) => new Set(s).add(parent));
        if (edit.type === 'file') await openFile(target);
      }
      setEdit(null);
    } catch (e) {
      flash(String(e.message).includes('EEXIST')
        ? `"${name}" already exists.`
        : `That did not work: ${String(e.message).split(':').pop().trim()}`);
    }
  };

  const removeEntry = async (entry) => {
    if (!confirm(`Move "${entry.name}" to the trash?`)) return;
    try {
      await window.api.trash(entry.path);
    } catch {
      return flash(`Could not delete ${entry.name}.`);
    }
    const gone = (p) => p === entry.path || p.startsWith(entry.path + sep);
    const rest = tabs.filter((t) => !gone(t.path));
    setTabs(rest);
    if (active && gone(active)) setActive(rest.length ? rest[rest.length - 1].path : null);
    if (selDir && gone(selDir)) setSelDir(dirname(entry.path));
    setOpen((s) => new Set([...s].filter((p) => !gone(p))));
    setDirs((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !gone(k))));
    await loadDir(dirname(entry.path));
  };

  const menuItems = (en) => [
    ...(en.isDir ? [['New file', () => startCreate('file', en.path)], ['New folder', () => startCreate('dir', en.path)]] : []),
    ...(en.isRoot ? [] : [
      ['Rename', () => setEdit({ type: 'rename', entry: en })],
      ['Duplicate', async () => { await window.api.duplicate(en.path); await loadDir(dirname(en.path)); }],
      ['Delete', () => removeEntry(en)]
    ]),
    ['Copy path', () => navigator.clipboard.writeText(en.path)],
    ['Reveal in file manager', () => window.api.reveal(en.path)]
  ];

  const closeTab = (p) => {
    const tab = tabs.find((t) => t.path === p);
    if (tab?.dirty && !confirm(`Close ${basename(p)} without saving?`)) return;
    const rest = tabs.filter((t) => t.path !== p);
    setTabs(rest);
    if (active === p) setActive(rest.length ? rest[rest.length - 1].path : null);
  };

  const save = useCallback(async () => {
    const tab = tabs.find((t) => t.path === active);
    if (!tab) return;
    await window.api.writeFile(tab.path, tab.content);
    setTabs((ts) => ts.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)));
  }, [tabs, active]);

  const runFile = useCallback(async () => {
    const tab = tabs.find((t) => t.path === active);
    if (!tab) return;
    const sep = Math.max(tab.path.lastIndexOf('/'), tab.path.lastIndexOf('\\'));
    const dot = tab.path.lastIndexOf('.');
    const ext = dot > sep ? tab.path.slice(dot + 1).toLowerCase() : '';
    const x = exts.find((e) => !disabled.includes(e.id) && e.run && e.fileExtensions.includes(ext));
    if (!x) return flash(`No enabled extension can run .${ext || 'this'} files. Open Extensions to add one.`);
    await save();
    const dir = tab.path.slice(0, sep);
    const name = tab.path.slice(sep + 1, dot > sep ? dot : undefined);
    const out = dir + (isWin ? '\\' : '/') + name + (isWin ? '.exe' : '');
    const cmd = x.run.replaceAll('{file}', tab.path).replaceAll('{dir}', dir).replaceAll('{name}', name).replaceAll('{out}', out);
    setShowTerm(true);
    setRunReq({ cmd, n: Date.now() });
  }, [tabs, active, exts, disabled, save]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') { e.preventDefault(); save(); }
      if (mod && e.key === 'o') { e.preventDefault(); openFolder(); }
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); setShowTerm((v) => !v); }
      if (e.key === 'F5') { e.preventDefault(); runFile(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, runFile]);

  const current = tabs.find((t) => t.path === active);

  return (
    <div className="app">
      <aside className="side">
        <div className="side-switch">
          <button className={view === 'files' ? 'on' : ''} onClick={() => setView('files')}>Files</button>
          <button className={view === 'ext' ? 'on' : ''} onClick={() => setView('ext')}>Extensions</button>
        </div>
        {view === 'ext' ? (
          <ExtensionsPanel exts={exts} disabled={disabled} toggle={toggleExt} />
        ) : (<>
        <div className="side-head">
          <span>{root ? basename(root) : 'No folder'}</span>
          <button onClick={openFolder} title="Ctrl+O">Open folder</button>
        </div>
        <div className="side-tools">
          <button disabled={!root} onClick={() => startCreate('file', selDir || root)}>New file</button>
          <button disabled={!root} onClick={() => startCreate('dir', selDir || root)}>New folder</button>
        </div>
        {edit && (
          <div className="edit-bar">
            <input
              ref={nameRef}
              autoFocus
              key={edit.type + (edit.entry?.path || '')}
              defaultValue={edit.type === 'rename' ? edit.entry.name : ''}
              onFocus={(e) => edit.type === 'rename' && e.target.select()}
              placeholder={edit.type === 'rename' ? 'New name' : `${edit.type === 'dir' ? 'Folder' : 'File'} name in ${basename(selDir || root)}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEdit(e.target.value);
                if (e.key === 'Escape') setEdit(null);
              }}
            />
            {edit.type === 'file' && (
              <select value={lang} onChange={(e) => setLang(e.target.value)} title="Language (required unless the name has an extension)">
                <option value="">Language…</option>
                {[...exts].sort((x, y) => x.name.localeCompare(y.name)).map((x) => (
                  <option key={x.id} value={x.fileExtensions[0]}>{x.name} (.{x.fileExtensions[0]})</option>
                ))}
                <option value="txt">Plain text (.txt)</option>
                <option value="md">Markdown (.md)</option>
                <option value="json">JSON (.json)</option>
                <option value="html">HTML (.html)</option>
                <option value="css">CSS (.css)</option>
              </select>
            )}
            <button onClick={() => submitEdit(nameRef.current.value)}>{edit.type === 'rename' ? 'Rename' : 'Create'}</button>
            <button onClick={() => setEdit(null)}>Cancel</button>
          </div>
        )}
        <div
          className="tree"
          onContextMenu={(e) => {
            e.preventDefault();
            if (root) setMenu({ x: e.clientX, y: e.clientY, entry: { path: root, name: basename(root), isDir: true, isRoot: true } });
          }}
        >
          {!root && <p className="hint">Open a folder to browse and edit its files.</p>}
          {root && (dirs[root] || []).map((e) => (
            <TreeNode key={e.path} entry={e} depth={0} {...{ dirs, open, toggle, openFile }} activePath={active} onMenu={(x, y, entry) => setMenu({ x, y, entry })} />
          ))}
        </div>
        </>)}
      </aside>

      <main className="main">
        <div className="tabs">
          {tabs.map((t) => (
            <div key={t.path} className={'tab' + (t.path === active ? ' on' : '')} onClick={() => setActive(t.path)}>
              {basename(t.path)}
              <span className="x" onClick={(e) => { e.stopPropagation(); closeTab(t.path); }}>
                {t.dirty ? '●' : '×'}
              </span>
            </div>
          ))}
          <button className="run" onClick={runFile} disabled={!current} title="Run file (F5)">Run</button>
        </div>

        <div className="editor">
          {current ? (
            <Editor
              theme={resolved === 'dark' ? 'vs-dark' : 'vs'}
              path={current.path}
              value={current.content}
              onChange={(v) =>
                setTabs((ts) => ts.map((t) => (t.path === current.path ? { ...t, content: v ?? '', dirty: true } : t)))
              }
              onMount={(ed) => ed.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }))}
              options={{ fontSize: 14, fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace', minimap: { enabled: true }, automaticLayout: true, smoothScrolling: true }}
            />
          ) : (
            <div className="empty">
              <p>Pick a file from the sidebar.</p>
              <p className="keys">Ctrl+O open folder · Ctrl+S save · F5 run · Ctrl+` terminal</p>
            </div>
          )}
        </div>

        <div className="term" style={{ display: showTerm ? 'block' : 'none' }}>
          <Terminal cwd={root} visible={showTerm} runRequest={runReq} theme={resolved} />
        </div>

        <footer className="status">
          <span>{notice || (current ? current.path : 'Ready')}</span>
          <div className="right">
            <span>{current ? `Ln ${cursor.line}, Col ${cursor.col}` : ''}</span>
            <div className="theme-seg" role="group" aria-label="Color theme">
              {['dark', 'system', 'light'].map((m) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {menu && (
        <div className="ctx" style={{ left: Math.min(menu.x, innerWidth - 190), top: Math.min(menu.y, innerHeight - 230) }}>
          {menuItems(menu.entry).map(([label, fn]) => (
            <button key={label} onClick={() => { setMenu(null); fn(); }}>{label}</button>
          ))}
        </div>
      )}
      {notice && <div className="toast" role="alert">{notice}</div>}
    </div>
  );
}

import { useEffect, useState } from 'react';

export default function ExtensionsPanel({ exts, disabled, toggle }) {
  const [status, setStatus] = useState({});
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState('');

  const scan = async () => {
    setScanning(true);
    const res = await window.api.extDetect();
    setStatus(Object.fromEntries(res.map((r) => [r.id, r])));
    setScanning(false);
  };
  useEffect(() => { scan(); }, [exts.length]);

  const shown = exts.filter((e) =>
    (e.name + e.fileExtensions.join(' ')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="ext">
      <div className="ext-bar">
        <input placeholder="Search languages" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={scan} disabled={scanning}>{scanning ? 'Scanning…' : 'Rescan'}</button>
      </div>
      <div className="ext-list">
        {shown.map((e) => {
          const s = status[e.id];
          const off = disabled.includes(e.id);
          return (
            <div key={e.id} className={'ext-item' + (off ? ' off' : '')}>
              <div className="ext-top">
                <strong>{e.name}</strong>
                <label title="Enable or disable">
                  <input type="checkbox" checked={!off} onChange={() => toggle(e.id)} /> on
                </label>
              </div>
              <div className="ext-meta">
                {e.fileExtensions.map((x) => '.' + x).join(' ')}{e.custom ? ' (custom)' : ''}
              </div>
              <div className="ext-state">
                {!s ? 'Checking…' : s.installed ? (
                  <span className="ok">Found: {s.version}</span>
                ) : (
                  <span className="miss">
                    Not found on PATH.{' '}
                    {e.url && <a href="#" onClick={(ev) => { ev.preventDefault(); window.api.extOpenUrl(e.url); }}>Get {e.name}</a>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!shown.length && <p className="hint">No language matches “{q}”.</p>}
      </div>
      <div className="ext-foot">
        <button onClick={() => window.api.extOpenFolder()}>Add your own language</button>
      </div>
    </div>
  );
}

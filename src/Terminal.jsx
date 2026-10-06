import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const TERM_THEMES = {
  dark: { background: '#14161b', foreground: '#c9cdd6', cursor: '#7cc4d4', selectionBackground: '#2f4a55' },
  light: { background: '#fafbfc', foreground: '#2b303b', cursor: '#1f7a8c', selectionBackground: '#cfe3ea' }
};

function SingleTerminal({ cwd, active, isSplit, runRequest, theme, onClick }) {
  const host = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let tid = null;
    let offData = () => {};

    if (!host.current || !window.api) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
      fontSize: 12,
      cursorBlink: true,
      theme: TERM_THEMES[theme] || TERM_THEMES.dark
    });

    const fit = new FitAddon();
    fitRef.current = fit;
    termRef.current = term;
    term.loadAddon(fit);
    term.open(host.current);

    const safeFit = () => {
      try {
        if (host.current && host.current.offsetWidth > 0 && host.current.offsetHeight > 0) {
          fit.fit();
        }
      } catch (e) {}
    };

    safeFit();

    window.api.termCreate(cwd, term.cols || 80, term.rows || 24).then((createdId) => {
      if (!mounted) {
        if (createdId) window.api.termKill(createdId);
        return;
      }
      tid = createdId;
      idRef.current = tid;

      offData = window.api.onTermData((i, d) => {
        if (mounted && i === tid && termRef.current) {
          try {
            term.write(d);
          } catch (e) {}
        }
      });

      term.onData((d) => {
        if (idRef.current) window.api.termWrite(idRef.current, d);
      });

      term.onResize(({ cols, rows }) => {
        if (idRef.current) window.api.termResize(idRef.current, cols, rows);
      });
    }).catch(() => {});

    const ro = new ResizeObserver(() => {
      if (mounted) safeFit();
    });
    ro.observe(host.current);

    return () => {
      mounted = false;
      ro.disconnect();
      offData();
      if (idRef.current) {
        window.api.termKill(idRef.current);
        idRef.current = null;
      }
      try {
        term.dispose();
      } catch (e) {}
      termRef.current = null;
      fitRef.current = null;
    };
  }, [cwd]);

  useEffect(() => {
    if (runRequest && active && idRef.current && window.api) {
      window.api.termWrite(idRef.current, runRequest.cmd + '\r');
    }
  }, [runRequest, active]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = TERM_THEMES[theme] || TERM_THEMES.dark;
    }
  }, [theme]);

  useEffect(() => {
    if ((active || isSplit) && fitRef.current && host.current) {
      const timer = setTimeout(() => {
        try {
          if (host.current && host.current.offsetWidth > 0 && host.current.offsetHeight > 0) {
            fitRef.current.fit();
          }
        } catch (e) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [active, isSplit]);

  return (
    <div
      className={'term-pane' + (active ? ' active-pane' : '')}
      style={{ display: isSplit || active ? 'flex' : 'none' }}
      onClick={onClick}
    >
      <div className="term-host" ref={host} />
    </div>
  );
}

export default function Terminal({ cwd, visible, runRequest, theme }) {
  const [tabs, setTabs] = useState([{ id: 1, name: '' }]);
  const [activeId, setActiveId] = useState(1);
  const [isSplit, setIsSplit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const nextIdRef = useRef(2);

  const getLowestAvailableNumber = (currentTabs) => {
    const numbers = new Set();
    currentTabs.forEach((t) => {
      const match = t.name && t.name.match(/^Terminal (\d+)$/);
      if (match) numbers.add(parseInt(match[1], 10));
    });
    let n = 1;
    while (numbers.has(n)) n++;
    return n;
  };

  const addTab = () => {
    setTabs((prev) => {
      const num = getLowestAvailableNumber(prev);
      const newId = nextIdRef.current++;
      const newTab = { id: newId, name: `Terminal ${num}` };
      setActiveId(newId);
      return [...prev, newTab];
    });
  };

  const closeTab = (e, id) => {
    e.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id && next.length > 0) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const handleRename = (id, newName) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t))
    );
    setEditingId(null);
  };

  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
    }
  }, [tabs]);

  return (
    <div className="term-container">
      <div className="term-bar">
        <div className="term-tabs">
          {tabs.map((t, idx) => {
            const displayName = t.name || `Terminal ${idx + 1}`;
            return (
              <div
                key={t.id}
                className={'term-tab' + (t.id === activeId ? ' on' : '')}
                onClick={() => setActiveId(t.id)}
                onDoubleClick={() => setEditingId(t.id)}
              >
                {editingId === t.id ? (
                  <input
                    className="term-title-input"
                    autoFocus
                    defaultValue={displayName}
                    onBlur={(e) => handleRename(t.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(t.id, e.target.value);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span>{displayName}</span>
                )}
                <span className="term-x" onClick={(e) => closeTab(e, t.id)} title="Close terminal">
                  ×
                </span>
              </div>
            );
          })}
        </div>
        <div className="term-actions">
          <button className="term-btn" onClick={addTab} title="New terminal (+)">
            + New
          </button>
          <button
            className={'term-btn' + (isSplit ? ' on' : '')}
            onClick={() => setIsSplit(!isSplit)}
            title="Toggle split view to show all terminals at once"
          >
            {isSplit ? 'Single View' : 'Split View'}
          </button>
        </div>
      </div>
      <div className={'term-grid' + (isSplit ? ' split-mode' : '')}>
        {tabs.map((t) => (
          <SingleTerminal
            key={t.id}
            cwd={cwd}
            active={t.id === activeId}
            isSplit={isSplit}
            runRequest={t.id === activeId ? runRequest : null}
            theme={theme}
            onClick={() => setActiveId(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

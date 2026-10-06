import React from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import App from './App.jsx';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  }
};
loader.config({ monaco });

const savedMode = localStorage.getItem('mini.theme') || 'dark';
document.documentElement.dataset.theme =
  savedMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : savedMode;

createRoot(document.getElementById('root')).render(<App />);

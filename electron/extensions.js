const fs = require('fs');
const os = require('os');
const path = require('path');

const win = process.platform === 'win32';
const py = win ? 'python' : 'python3';
const c = (compiler) => `${compiler} "{file}" -o "{out}" && "{out}"`;

const BUILTIN = [
  { id: 'python', name: 'Python', language: 'python', fileExtensions: ['py'], check: `${py} --version`, run: `${py} "{file}"`, url: 'https://www.python.org/downloads/' },
  { id: 'node', name: 'JavaScript (Node.js)', language: 'javascript', fileExtensions: ['js', 'mjs', 'cjs'], check: 'node --version', run: 'node "{file}"', url: 'https://nodejs.org/' },
  { id: 'typescript', name: 'TypeScript', language: 'typescript', fileExtensions: ['ts'], check: 'npx --no-install tsx --version', run: 'npx tsx "{file}"', url: 'https://tsx.is/' },
  { id: 'go', name: 'Go', language: 'go', fileExtensions: ['go'], check: 'go version', run: 'go run "{file}"', url: 'https://go.dev/dl/' },
  { id: 'rust', name: 'Rust', language: 'rust', fileExtensions: ['rs'], check: 'rustc --version', run: c('rustc'), url: 'https://rustup.rs/' },
  { id: 'java', name: 'Java', language: 'java', fileExtensions: ['java'], check: 'java --version', run: 'java "{file}"', url: 'https://adoptium.net/' },
  { id: 'c', name: 'C (gcc)', language: 'c', fileExtensions: ['c'], check: 'gcc --version', run: c('gcc'), url: 'https://gcc.gnu.org/' },
  { id: 'cpp', name: 'C++ (g++)', language: 'cpp', fileExtensions: ['cpp', 'cc', 'cxx'], check: 'g++ --version', run: c('g++'), url: 'https://gcc.gnu.org/' },
  { id: 'csharp', name: 'C# (.NET)', language: 'csharp', fileExtensions: ['cs'], check: 'dotnet --version', run: 'dotnet run "{file}"', url: 'https://dotnet.microsoft.com/download' },
  { id: 'kotlin', name: 'Kotlin', language: 'kotlin', fileExtensions: ['kts'], check: 'kotlinc -version', run: 'kotlinc -script "{file}"', url: 'https://kotlinlang.org/docs/command-line.html' },
  { id: 'swift', name: 'Swift', language: 'swift', fileExtensions: ['swift'], check: 'swift --version', run: 'swift "{file}"', url: 'https://www.swift.org/install/' },
  { id: 'dart', name: 'Dart', language: 'dart', fileExtensions: ['dart'], check: 'dart --version', run: 'dart run "{file}"', url: 'https://dart.dev/get-dart' },
  { id: 'ruby', name: 'Ruby', language: 'ruby', fileExtensions: ['rb'], check: 'ruby --version', run: 'ruby "{file}"', url: 'https://www.ruby-lang.org/en/downloads/' },
  { id: 'php', name: 'PHP', language: 'php', fileExtensions: ['php'], check: 'php --version', run: 'php "{file}"', url: 'https://www.php.net/downloads' },
  { id: 'lua', name: 'Lua', language: 'lua', fileExtensions: ['lua'], check: 'lua -v', run: 'lua "{file}"', url: 'https://www.lua.org/download.html' },
  { id: 'perl', name: 'Perl', language: 'perl', fileExtensions: ['pl'], check: 'perl --version', run: 'perl "{file}"', url: 'https://www.perl.org/get.html' },
  { id: 'r', name: 'R', language: 'r', fileExtensions: ['r'], check: 'Rscript --version', run: 'Rscript "{file}"', url: 'https://cran.r-project.org/' },
  { id: 'julia', name: 'Julia', language: 'julia', fileExtensions: ['jl'], check: 'julia --version', run: 'julia "{file}"', url: 'https://julialang.org/downloads/' },
  { id: 'haskell', name: 'Haskell', language: 'haskell', fileExtensions: ['hs'], check: 'runghc --version', run: 'runghc "{file}"', url: 'https://www.haskell.org/ghcup/' },
  { id: 'elixir', name: 'Elixir', language: 'elixir', fileExtensions: ['exs'], check: 'elixir --version', run: 'elixir "{file}"', url: 'https://elixir-lang.org/install.html' },
  { id: 'bash', name: 'Shell (bash)', language: 'shell', fileExtensions: ['sh'], check: 'bash --version', run: 'bash "{file}"', url: 'https://www.gnu.org/software/bash/' },
  { id: 'powershell', name: 'PowerShell', language: 'powershell', fileExtensions: ['ps1'], check: 'pwsh --version', run: 'pwsh -File "{file}"', url: 'https://learn.microsoft.com/powershell/' }
];

const userDir = path.join(os.homedir(), '.mini-ide', 'extensions');

function loadUser() {
  try {
    return fs.readdirSync(userDir).flatMap((d) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(userDir, d, 'extension.json'), 'utf8'));
        return m.id && m.name && Array.isArray(m.fileExtensions) ? [{ ...m, custom: true }] : [];
      } catch { return []; }
    });
  } catch { return []; }
}

function loadAll() {
  const user = loadUser();
  const ids = new Set(user.map((u) => u.id));
  return [...BUILTIN.filter((b) => !ids.has(b.id)), ...user];
}

module.exports = { loadAll, userDir };

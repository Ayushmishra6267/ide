# Mini IDE

Electron + React + Monaco + xterm.js, with Node.js handling files and the shell over IPC.

## Download & Installation

Download the latest Windows installer for Mini IDE:

- **Windows Installer (.exe)**: [Download Mini IDE Setup 0.1.0.exe](release/Mini%20IDE%20Setup%200.1.0.exe)
- **Standalone Executable**: [Mini IDE Portable](release/win-unpacked/Mini%20IDE.exe)
- **GitHub Releases**: [Latest Release Releases/Tag](https://github.com/your-username/mini-ide/releases/latest)

## Run

    npm install
    npm run dev        # Vite dev server + Electron
    npm start          # production build, then Electron

## Real terminal (optional)

`node-pty` gives you a proper TTY (colors, vim, arrow-key history). It needs a native build:

    npm run rebuild

Without it the terminal falls back to a basic piped shell.

## Shortcuts

Ctrl+O open folder · Ctrl+S save · Ctrl+` toggle terminal · F5 run file

## Layout

    electron/main.js     window, file system + terminal IPC handlers
    electron/preload.js  safe bridge exposed as window.api
    src/App.jsx          sidebar tree, tabs, Monaco editor, status bar
    src/Terminal.jsx     xterm.js panel wired to the shell (with multi-terminal & split view)

## Extensions

Open the **Extensions** tab in the sidebar. It lists 22 built-in languages, checks which runtimes are
installed on your PATH, and lets you switch each one on or off. Press **F5** (or click Run) to save
and run the current file in the terminal with the matching extension.

To add any other language, create `~/.mini-ide/extensions/<name>/extension.json`:

    {
      "id": "zig",
      "name": "Zig",
      "language": "zig",
      "fileExtensions": ["zig"],
      "check": "zig version",
      "run": "zig run \"{file}\"",
      "url": "https://ziglang.org/download/"
    }

Placeholders in `run`: `{file}` full path, `{dir}` folder, `{name}` file name without extension,
`{out}` a build output path next to the file. The `check` command runs on your machine, so only
install extension folders you trust. Restart the app after adding one.

## Themes

Use the Dark / System / Light switch in the bottom-right of the status bar. System follows your OS setting and updates live. The choice is remembered.

## Package an installer

    npm run dist

Output goes to `release/`. Build on each OS you want to ship for (Windows .exe, macOS .dmg, Linux AppImage/.deb).
Optional: put `icon.png` (512x512) in a `build/` folder.

## New file / New folder

Use the buttons under the folder name. Items are created inside the folder you last clicked (or the root). Type a name and press Enter; Esc cancels. Names like `src/utils/math.js` create the missing folders too.

## File operations

New file / New folder buttons, plus right-click any file, folder or empty space for New file, New folder, Rename, Duplicate, Delete (moves to trash), Copy path and Reveal in file manager. A new file must have a language: end the name with a known extension (like `app.py`) or pick one from the Language list, otherwise it is not created.

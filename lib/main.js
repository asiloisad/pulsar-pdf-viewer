'use babel'

import { CompositeDisposable } from 'atom'
import Viewer from './viewer'
const path = require('path')
const fs   = require('fs')
const cp   = require("child_process")

export default {

  config: {
    "autoRefresh": {
      'order': 1,
      "title": "Auto refresh viewer if file changed",
      "type": "boolean",
      "default": true,
    },
    "autoTime": {
      'order': 2,
      "title": "Delay of auto-refresh",
      "type": "integer",
      "default": 2000,
    },
    "closeDeleted": {
      'order': 3,
      "type": "boolean",
      "default": true,
      "description": "Set to true to automatically close the PDF tab when the disk file is deleted",
    },
    "invertMode": {
      'order': 4,
      "title": "Inverse color of pages",
      "type": "boolean",
      "default": false,
    },
  },

  activate() {
    if (!this.active) { this.active = true } else { return }
    this.viewers = new Set()
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.workspace.addOpener( (uri) => {
        if (match = uri.match(/(.+\.pdf)(#.*)?/i)) {
          return this.createViewer(match[1], match[2])
        }
      }),
      atom.commands.add('atom-workspace', {
        'pdf-viewer:reload-all': () => this.reloadAll(),
        'pdf-viewer:invert-colors': () => {
          atom.config.set('pdf-viewer.invertMode', !atom.config.get("pdf-viewer.invertMode"))
        }
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS() ; this.reloadAll()
      }),
      atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
        "pdf-viewer:synctex": () => this.synctex(),
      }),
      atom.config.onDidChange("pdf-viewer.invertMode", (event) => {
        this.invertMode = event.newValue
        this.prepareCSS() ; this.reloadAll()
      }),
    )
    this.invertMode = atom.config.get("pdf-viewer.invertMode")
  },

  deactivate () {
    this.active = false
    this.disposables.dispose()
  },

  deserialize(state) {
    if (!fs.existsSync(state.filePath)) { return }
    this.activate() // prevent multiple activation
    return this.createViewer(state.filePath)
  },

  createViewer(filePath, hash) {
    viewer = new Viewer(filePath, hash)
    this.viewers.add(viewer)
    viewer.onDidDispose(() => { this.viewers.delete(viewer) })
    return viewer
  },

  prepareCSS() {
    lessPath = path.join(__dirname, '..', 'vendors', 'custom', 'viewer.less')
    cssPath  = path.join(__dirname, '..', 'vendors', 'custom', 'viewer.css' )
    css = atom.themes.loadLessStylesheet(lessPath)
    if (this.invertMode) {
      css = css + ["#viewerContainer > #viewer > .page > .canvasWrapper > canvas {", "   filter: grayscale(100%);", "   filter: invert(100%);", "}" ].join('\n')
    }
    fs.writeFileSync(cssPath, css)
  },

  reloadAll() {
    for (viewer of this.viewers) { viewer.reload() }
  },

  synctex() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) { return }
    const file = editor.getPath();
    if (!file || !file.endsWith(".tex")) { return }
    pdfFile = file.substr(0, file.lastIndexOf(".")) + ".pdf";
    if (!fs.existsSync(pdfFile)) { return }
    const position = editor.getLastCursor().getBufferPosition();
    const command = `synctex view -i ${position.row + 1}:${position.column + 1}:"${file}" -o "${pdfFile}"`;
    cp.exec(command, (err, stdout, stderr) => {
      if (err) { console.warn(stderr) ; return }
      const location = this.parseForwardSynctex(stdout);
      for (viewer of this.viewers) {
        if (viewer.filePath===pdfFile) {
          return viewer.scrollToPosition(location, { origin: "TL" });
        }
      }
      atom.workspace.open(pdfFile+`#page=${location.pageIndex+1}`, {split:'right', searchAllPanes:true}).then( () => {
        atom.views.getView(editor).focus();
      })
    });
  },

  parseForwardSynctex(stdout) {
    const location = {};
    const lines = stdout.split(/\r?\n/g);
    for (const line of lines) {
      const match = line.match(/^(\w+):(.+)$/);
      if (!match) { continue }
      const key = match[1];
      const val = match[2];
      switch (key) {
        case "Page":
          location.pageIndex = parseInt(val, 10) - 1;
          break;
        case "x":
          location.pointX = parseFloat(val);
          break;
        case "v":
          location.pointY = parseFloat(val);
          break;
        case "before":
          return location;
      }
    }
    return location;
  },

}

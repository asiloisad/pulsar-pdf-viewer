'use babel'

import { CompositeDisposable } from 'atom'
import Viewer from './viewer'
const path = require('path')
const fs   = require('fs')
const cp   = require("child_process")

export default {

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
        'pdf-viewer:refresh-all': () => this.refreshAll(),
      }),
      atom.commands.add('atom-text-editor', {
        'pdf-viewer:refresh': () => this.refreshAll(),
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS() ; this.refreshAll()
      }),
      atom.commands.add("atom-text-editor", {
        "pdf-viewer:forward-sync": () => this.synctex(),
      })
    )
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
    fs.writeFileSync(cssPath, css)
  },

  refreshAll() {
    for (viewer of this.viewers) { viewer.refresh() }
  },

  synctex() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) { return }
    const file = editor.getPath();
    if (!file || !file.endsWith(".tex")) { return }
    pdfFile = file.substr(0, file.lastIndexOf(".")) + ".pdf";
    if (!fs.existsSync(pdfFile)) { return }
    atom.workspace.open(pdfFile, {split:'right', searchAllPanes:true}).then( (viewer) => {
      const position = editor.getLastCursor().getBufferPosition();
      const command = `synctex view -i ${position.row + 1}:${position.column + 1}:"${file}" -o "${viewer.filePath}"`;
      cp.exec(command, (err, stdout, stderr) => {
        if (err) { console.warn(stderr) ; return }
        const location = this.parseForwardSynctex(stdout);
        viewer.scrollToPosition(location, { origin: "TL" });
      });
    })
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

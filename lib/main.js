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
      "title": "Auto-reload on update",
      "description": "Automatically reload when the file is updated",
      "type": "boolean",
      "default": true,
    },
    "autoTime": {
      'order': 2,
      "title": "Auto-refresh delay",
      "description": "The time in ms before reloading the PDF after the last detected change",
      "type": "integer",
      "default": 2000,
    },
    "closeDeleted": {
      'order': 3,
      "title": "Close panel if file deleted",
      "description": "Set to true to automatically close the PDF tab when the disk file is deleted",
      "type": "boolean",
      "default": true,
    },
    "invertMode": {
      'order': 4,
      "title": "Inverse color",
      "description": "Inverts the colours of the pages",
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
      css += '.page, .thumbnailImage {filter: invert(100%);}\n'
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
    if (!file || !file.endsWith(".tex")) {
      return atom.notifications.addError(`pdf-viewer: Cannot run synctex, because source "${file}" is not TeX file`)
    }
    pdfFile = file.substr(0, file.lastIndexOf(".")) + ".pdf";
    if (!fs.existsSync(pdfFile)) {
      return atom.notifications.addError(`pdf-viewer: Cannot run synctex, because "${pdfFile}" does not exists`)
    }
    position = editor.getLastCursor().getBufferPosition();
    command = `synctex view -i "${position.row + 1}:${position.column + 1}:${file}" -o "${pdfFile}"`;
    cp.exec(command, (err, stdout, stderr) => {
      if (err) { return atom.notifications.addError(`pdf-viewer: synctex error: ${err}: ${stderr}`) }
      synctex = {}
      for (let line of stdout.split(/\r?\n/g)) {
        if (line.startsWith('Page:')) {
          synctex.page = parseInt(line.substr(5),10)-1
        } else if (line.startsWith('x:')) {
          let value = parseFloat(line.substr(2))
          synctex.x = parseInt(value, 10)
        } else if (line.startsWith('y:')) {
          let value = parseFloat(line.substr(2))
          synctex.y = parseInt(value, 10)
        } else if (line.startsWith('before:')) {
          break
        }
      }
      if (!synctex.page) {
        return atom.notifications.addError(`pfd-viewer: synctex stdout parsed with errors`)
      }
      for (viewer of this.viewers) {
        if (viewer.filePath===pdfFile) {
          return viewer.scrollToPosition(synctex.page, synctex.x, synctex.y)
        }
      }
      atom.workspace.open(`${pdfFile}#page=${synctex.page+1}`, { split:'right', searchAllPanes:true }).then( () => { atom.views.getView(editor).focus() })
    })
  },
}

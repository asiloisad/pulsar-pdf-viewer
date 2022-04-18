'use babel'

import { CompositeDisposable, Disposable, File } from 'atom'
const path = require('path')
const cp = require("child_process");

export default class Viewer {

  constructor(filePath, hash) {
    this.disposables = new CompositeDisposable();
    this.file = new File(filePath) ; this.hash = hash ? hash : '' ; this.ready = false
    this.pdfjsPath = path.join(__dirname, "..", "vendors", "pdfjs-2.13.216-legacy-dist", "web", "viewer.html")
    this.element = document.createElement("iframe")
    this.element.classList.add("pdf-viewer")
    this.reload()
    this.disposables.add(
      atom.config.observe('pdf-viewer.autoRefresh', (value) => {
        this.autoRefresh = value
      }),
      atom.config.observe('pdf-viewer.autoTime', (value) => {
        this.autoTime = value
      }),
      atom.config.observe('pdf-viewer.closeDeleted', (value) => {
        this.closeDeleted = value
      }),
    )
    this.disposables.add(
      this.file.onDidChange(() => { if (this.autoRefresh ) { this.refresh() }}),
      this.file.onDidDelete(() => { if (this.closeDeleted) { this.destroy() }}),
      this.file.onDidRename(() => { this.updateTitle() }),
    )
    this.onDidChangeTitleCallbacks = new Set()
    window.addEventListener("message", (message) => {
      if (message.source!==this.element.contentWindow) {
        return
      } else if (message.data.type==='keydown') {
        return this.handleKeydown(message.data)
      } else if (message.data.type==='contextmenu') {
        return this.handleSynctex(message.data)
      }
    })
    this.element.addEventListener('load', () => {
      this.disposables.add(
        atom.config.observe("pdf-viewer.invertMode", (value) => {
          this.sendMessage({type:'invert', initial:value})
        })
      )
    })
  }

  sendMessage(data) {
    try {
      this.element.contentWindow.postMessage(data);
    } catch (err) {
      console.log(`pdf-viewer: Cannot send message to PDFjs: ${err}`)
    }
  }

  get filePath() {
    return this.file.getPath()
  }

  getPath() {
    return this.filePath
  }

  getURI() {
    return `${this.filePath}${this.hash}`
  }

  serialize() {
    return { deserializer:'pdf-viewer', filePath:this.filePath }
  }

  destroy() {
    if (pane = atom.workspace.paneForItem(this)) { pane.destroyItem(this) }
    this.element.remove()
    this.disposables.dispose()
  }

  getTitle() {
    return path.basename(this.filePath)
  }

  reload() {
    this.ready = true
    this.element.src = `${this.pdfjsPath}?file=${encodeURIComponent(this.filePath)}${this.hash}`
  }

  refresh() {
    this.ready = false
    return setTimeout( () => {
      if (this.ready) { return } else {
        this.ready = true
        this.sendMessage({ type:"refresh", filePath:this.filePath });
      }
    }, this.autoTime)
  }

  onDidDispose(callback) {
    this.disposables.add(new Disposable(callback));
  }

  updateTitle() {
    this.onDidChangeTitleCallbacks.forEach(cb => cb());
  }

  onDidChangeTitle(cb) {
    this.onDidChangeTitleCallbacks.add(cb);
    return new Disposable(() => {
      this.onDidChangeTitleCallbacks.delete(cb);
    });
  }

  handleKeydown(data) {
    if (data.action==='command-palette') {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "command-palette:toggle");
    } else if (data.action==='toggle-refreshing') {
      this.autoRefresh = !this.autoRefresh
      if (this.autoRefresh) {
        atom.notifications.addSuccess('pdf-viewer: Auto-refreshing activated in active file')
      } else {
        atom.notifications.addSuccess('pdf-viewer: Auto-refreshing deactivated in active file')
      }
    }
  }

  handleSynctex(data) {
    cmd = `synctex edit -o "${data.pageNo}:${data.x}:${data.y}:${this.filePath}"`
    cp.exec(cmd, (err, stdout, stderr) => {
      if (err) { return console.log(`pdf-viewer: synctex error: ${stderr}`) }
      synctex = {}
      for (let line of stdout.split(/\r?\n/g)) {
        if (line.startsWith('Input:')) {
          synctex.input = line.substr(6)
        } else if (line.startsWith('Line:')) {
          let value = line.substr(5)
          synctex.line = parseInt(value, 10)-1
        } else if (line.startsWith('Column:')) {
          let value = line.substr(7)
          synctex.column = parseInt(value, 10)
        }
      }
      if (!synctex.input) {
        return console.log(`pfd-viewer: synctex stdout parsed with errors`)
      } else if (!fs.existsSync(synctex.input)) {
        return console.log(`pfd-viewer: cannot open synctex input "${synctex.input}", because it does not exists`)
      } else {
        atom.workspace.open(synctex.input, { initialLine:synctex.line, initialColumn:synctex.column, searchAllPanes:true })
      }
    })
  }

  scrollToPosition(page, x, y) {
    this.sendMessage({ type:"setposition", page:page, x:x, y:y });
  }
}

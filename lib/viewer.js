'use babel'

import { CompositeDisposable, Disposable, File } from 'atom'
import path from 'path'
import fs from "fs"
import cp from "child_process"

export default class Viewer {

  constructor(filePath, hash) {
    this.disposables = new CompositeDisposable()
    this.fisposables = new CompositeDisposable()
    this.onDidChangeTitleCallbacks = new Set()
    this.observeOutlineCallbacks   = new Set()
    this.observeCurrentCallbacks   = new Set()
    this.pdfjsPath = path.join(__dirname, "..", "vendors", "pdfjs-3.1.81-legacy-dist", "web", "viewer.html")
    this.element = document.createElement("iframe")
    this.element.classList.add("pdf-viewer")
    this.setFile(filePath, hash) ; this.reload()
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
      atom.config.observe('pdf-viewer.debugMode', (value) => {
        this.debugMode = value
      }),
    )
    this.skipRefresh = false
    window.addEventListener("message", (message) => {
      if (message.source!==this.element.contentWindow) {
        return
      } else if (message.data.type==='click') {
        this.element.focus()
        this.currentdest()
      } else if (message.data.type==='keydown') {
        return this.handleKeydown(message.data)
      } else if (message.data.type==='contextmenu') {
        return this.handleSynctex(message.data)
      } else if (message.data.type==='pdfjsOutline') {
        this.outline = message.data.outline
        this.observeOutlineCallbacks.forEach((callback) => callback(this.outline))
      } else if (message.data.type==='currentOutlineItem') {
        this.destHash = message.data.destHash
        this.observeCurrentCallbacks.forEach((callback) => callback(this.destHash))
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

  setFile(filePath, hash) {
    this.fisposables.dispose()
    this.file = new File(filePath)
    this.hash = hash ? hash : ''
    this.ready = false
    this.fisposables.add(
      this.file.onDidChange(() => {
        if (this.autoRefresh ) {
          this.skipRefresh ? this.skipRefresh = false : this.refresh()
        }
      }),
      this.file.onDidDelete(() => {
        if (this.closeDeleted) {
          this.destroy()
        }
      }),
      this.file.onDidRename(() => {
        this.skipRefresh = true
        this.reload()
      }),
    )
  }

  sendMessage(data) {
    try {
      this.element.contentWindow.postMessage(data);
    } catch (err) {
      if (this.debugMode) {
        console.error(`pdf-viewer: Cannot send message to PDFjs: ${err}`, data)
      }
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
    return { deserializer:'pdf-viewer', filePath:this.filePath, hash:this.hash }
  }

  destroy() {
    let pane = atom.workspace.paneForItem(this)
    if (pane) { pane.destroyItem(this) }
    this.element.remove()
    this.disposables.dispose()
  }

  getTitle() {
    return path.basename(this.filePath)
  }

  reload() {
    this.ready = true
    this.element.src = `${this.pdfjsPath}?file=${encodeURIComponent(this.filePath)}${this.hash}`
    this.updateTitle()
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
    this.onDidChangeTitleCallbacks.forEach(callback => callback());
  }

  onDidChangeTitle(callback) {
    this.onDidChangeTitleCallbacks.add(callback);
    return new Disposable(() => {
      this.onDidChangeTitleCallbacks.delete(callback);
    });
  }

  observeOutline(callback) {
    if (this.outline) { callback(this.outline) }
    this.observeOutlineCallbacks.add(callback);
    return new Disposable(() => {
      this.observeOutlineCallbacks.delete(callback);
    });
  }

  observeCurrent(callback) {
    if (this.destHash) { callback(this.destHash) }
    this.observeCurrentCallbacks.add(callback);
    return new Disposable(() => {
      this.observeCurrentCallbacks.delete(callback);
    });
  }

  handleKeydown(data) {
    if (data.action==='command-palette:toggle') {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "command-palette:toggle")
    } else if (data.action==='navigation-panel:toggle') {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "navigation-panel:toggle")
    } else if (data.action==='open-external:open-external') {
      atom.commands.dispatch(atom.views.getView(this), "open-external:open-external")
    } else if (data.action==='open-external:show-in-folder') {
      atom.commands.dispatch(atom.views.getView(this), "open-external:show-in-folder")
    } else if (data.action==='project-files:recent-toggle') {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "project-files:recent-toggle")
    } else if (data.action==='project-files:projects-toggle') {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "project-files:projects-toggle")
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
    let syncexe = atom.config.get('pdf-viewer.synctexPath')
    let cmd = `"${syncexe}" edit -o "${data.pageNo}:${data.x}:${data.y}:${this.filePath}"`
    cp.exec(cmd, (err, stdout, stderr) => {
      if (err && this.debugMode) { return console.error(`pdf-viewer: synctex error: ${stderr}`) }
      let synctex = {}
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
        if (this.debugMode) {
          return console.error(`pfd-viewer: synctex stdout parsed with errors`)
        }
      } else if (!fs.existsSync(synctex.input)) {
        if (this.debugMode) {
          return console.error(`pfd-viewer: cannot open synctex input "${synctex.input}", because it does not exists`)
        }
      } else {
        atom.workspace.open(synctex.input, { split:'left', initialLine:synctex.line, initialColumn:synctex.column, searchAllPanes:true })
      }
    })
  }

  scrollToPosition(page, x, y) {
    this.sendMessage({ type:"setposition", page:page, x:x, y:y });
  }

  scrollToDestination(item) {
    this.sendMessage({ type:"setdestination", dest:item.dest });
    this.destHash = item.destHash
    this.observeCurrentCallbacks.forEach((callback) => callback(this.destHash))
  }

  currentdest() {
    this.sendMessage({ type:"currentdest" })
  }

}

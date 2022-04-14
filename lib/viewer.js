'use babel'

import { CompositeDisposable, Disposable, File, BufferedProcess } from 'atom'
const path = require('path')

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
      this.file.onDidRename(() => { this.upTitle() }),
    )
    this.onDidChangeTitleCallbacks = new Set()
    this.element.addEventListener('load', () => this.viewerLoaded())
  }

  viewerLoaded() {
    try { // TODO: doesn't work if restart window and pdf opened
      this.element.contentWindow.addEventListener('keydown', (event) => this.handleKey(event), true)
      this.element.contentWindow.addEventListener('contextmenu', (event) => this.handleSynctex(event))
    } catch (err) {
      console.log('pdf-viewer: event listeners cannot start, try close all pdf\' and restart Atom')
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
        this.sendMessage("refresh", { filePath:this.filePath });
      }
    }, this.autoTime)
  }

  onDidDispose(callback) {
    this.disposables.add(new Disposable(callback));
  }

  upTitle() {
    this.onDidChangeTitleCallbacks.forEach(cb => cb());
  }

  onDidChangeTitle(cb) {
    this.onDidChangeTitleCallbacks.add(cb);
    return new Disposable(() => {
      this.onDidChangeTitleCallbacks.delete(cb);
    });
  }

  handleKey(event) {
    if (event.keyCode===112) {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "command-palette:toggle");
      event.stopPropagation()
    } else if (event.keyCode===113) {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "pdf-viewer:invert-colors");
      event.stopPropagation()
    } else if (event.keyCode===116) {
      atom.commands.dispatch(atom.views.getView(atom.workspace), "pdf-viewer:reload-all");
      event.stopPropagation()
    }
  }

  handleSynctex(event) {
    // get enclosing page div
    const page = event.target.closest('div.page')
    if (!page) {
      return
    }
    // get page number
    const pageNo = parseInt(page.getAttribute('data-page-number'), 10)
    if (isNaN(pageNo)) {
      return
    }
    // compute mouse coordinates relative to canvas element
    // taking rotation into account
    const bounds = page.querySelector('canvas').getBoundingClientRect();
    const rot = this.element.contentWindow.PDFViewerApplication.
      pdfViewer.pagesRotation
    switch (rot) {
      case 0:
        var x = event.clientX - bounds.left
        var y = event.clientY - bounds.top
        break;
      case 90:
        var x = event.clientY - bounds.top
        var y = bounds.right - event.clientX
        break;
      case 180:
        var x = bounds.right - event.clientX
        var y = bounds.bottom - event.clientY
        break;
      case 270:
        var x = bounds.bottom - event.clientY
        var y = event.clientX - bounds.left
        break;
    }
    // get PDF view resolution, assuming that currentScale is relative to a
    // fixed browser resolution of 96 dpi; see viewer.js line 3390.
    const res = this.element.contentWindow.PDFViewerApplication.
      pdfViewer.currentScale * 96
    // compute coordinates in points (TeX bp)
    x = Math.round(x / res * 72)
    y = Math.round(y / res * 72)

    // call SyncTeX
    const command = 'synctex'
    const args = [ 'edit', '-o', pageNo + ':' + x + ':' + y + ':' + this.filePath ]
    var synctex = {}  // to collect SyncTeX output values
    const stdout = (output) => this.synctexStdout(output, synctex)
    const exit = (code) => this.synctexExit(code, synctex)
    new BufferedProcess({command, args, stdout, exit}).
      onWillThrowError((errorObject) => {
        errorObject.handle()
        atom.notifications.addError('Could not run SyncTeX', {description: 'Make sure `' + command + '` is installed and on your PATH'})
      })
    // console.log('pdf-viewer: ' + command + ' ' + args.join(' '))
  }

  synctexStdout (output, synctex){
    // parse SyncTeX output for values
    // split buffered lines
    lines = output.split(/\r?\n/g)
    for (let line of lines) {
      if (line.startsWith('Input:')) {
        synctex.input = line.substr(6)
      }
      if (line.startsWith('Line:')) {
        let value = line.substr(5)
        synctex.line = parseInt(value, 10)
      }
    }
  }

  synctexExit(code, synctex) {
    // upon SyncTeX exit, open source file at line number
    if (code == 0) {
      atom.workspace.open(synctex.input, { initialLine: synctex.line-1, searchAllPanes: true })
    } else {
      // console.log('pdf-viewer: SyncTeX failed with code ' + code)
    }
  }

  sendMessage(type, data) {
    this.element.contentWindow.postMessage({ type, data });
  }

  scrollToPosition(pos, options) {
    const payload = pos;
    if (options && options.origin) {
      payload.origin = options.origin;
    }
    this.sendMessage("setposition", pos);
  }
}

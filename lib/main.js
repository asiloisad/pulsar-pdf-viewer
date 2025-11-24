const { CompositeDisposable, Disposable } = require('atom')
const Viewer = require('./viewer')
const path = require('path')
const fs = require('fs')
const cp = require('child_process')

module.exports = {

  activate() {
    if (!this.active) { this.active = true } else { return }
    this.prepareCSS()
    this.viewers = new Set()
    this.buildService = null
    this.buildStatusSubscriptions = null
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      atom.workspace.addOpener((uri) => {
        if (match = uri.match(/(.+\.pdf)($|#.*)/i)) {
          return this.createViewer(match[1], match[2])
        }
      }),
      atom.commands.add('atom-workspace', {
        'pdf-viewer:reload-all': () => this.reloadAll(),
        'pdf-viewer:invert-mode': () => { atom.config.set("pdf-viewer.invertMode", !atom.config.get("pdf-viewer.invertMode")) }
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS(); this.reloadAll()
      }),
      atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
        "pdf-viewer:synctex": () => this.synctex(),
      }),
    )
  },

  deactivate() {
    this.active = false
    for (let viewer of this.viewers) { viewer.destroy() }
    this.disposables.dispose()
    if (this.buildStatusSubscriptions) {
      this.buildStatusSubscriptions.dispose()
    }
  },

  deserialize(state) {
    if (!fs.existsSync(state.filePath)) { return }
    this.activate() // prevent multiple activation
    return this.createViewer(state.filePath, state.hash)
  },

  createViewer(filePath, hash) {
    let viewer = new Viewer(filePath, hash)
    this.viewers.add(viewer)
    viewer.onDidDispose(() => { this.viewers.delete(viewer) })
    return viewer
  },

  consumeBuildStatus(service) {
    console.log('[pdf-viewer] Consuming build status service');
    this.buildService = service;
    this.buildStatusSubscriptions = new CompositeDisposable();
    
    // Subscribe to build events
    this.buildStatusSubscriptions.add(
      service.onDidStartBuild((data) => {
        console.log('[pdf-viewer] Build started:', data.file);
        this.handleBuildStart(data.file);
      }),
      service.onDidFinishBuild((data) => {
        console.log('[pdf-viewer] Build finished:', data.file);
        this.handleBuildFinish(data.file);
      }),
      service.onDidFailBuild((data) => {
        console.log('[pdf-viewer] Build failed:', data.file);
        this.handleBuildFinish(data.file);
      })
    );
    
    return new Disposable(() => {
      console.log('[pdf-viewer] Disposing build status service');
      this.buildService = null;
      if (this.buildStatusSubscriptions) {
        this.buildStatusSubscriptions.dispose();
        this.buildStatusSubscriptions = null;
      }
    });
  },

  handleBuildStart(texFile) {
    // Get the corresponding PDF file path
    const pdfFile = texFile.replace(/\.tex$/, '.pdf');
    
    // Find all viewers showing this PDF and pause their auto-refresh
    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        console.log(`[pdf-viewer] Pausing auto-refresh for ${path.basename(pdfFile)}`);
        viewer.pauseAutoRefresh();
      }
    }
  },

  handleBuildFinish(texFile) {
    // Get the corresponding PDF file path
    const pdfFile = texFile.replace(/\.tex$/, '.pdf');
    
    // Find all viewers showing this PDF and resume their auto-refresh
    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        console.log(`[pdf-viewer] Resuming auto-refresh for ${path.basename(pdfFile)}`);
        viewer.resumeAutoRefresh();
      }
    }
  },

  prepareCSS() {
    let lessPath = path.join(__dirname, '..', 'vendors', 'custom', 'viewer.less')
    let cssPath = path.join(__dirname, '..', 'vendors', 'custom', 'viewer.css')
    let css = atom.themes.loadLessStylesheet(lessPath)
    fs.writeFileSync(cssPath, css)
  },

  reloadAll() {
    for (let viewer of this.viewers) { viewer.reload() }
  },

  synctex() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) { return }
    const file = editor.getPath();
    if (!file || !file.endsWith(".tex")) {
      return console.error(`pdf-viewer: Cannot run synctex, because source "${file}" is not TeX file`)
    }
    let pdfFile = file.substr(0, file.lastIndexOf(".")) + ".pdf";
    if (!fs.existsSync(pdfFile)) {
      return console.error(`pdf-viewer: Cannot run synctex, because "${pdfFile}" does not exists`)
    }
    let position = editor.getLastCursor().getBufferPosition();
    let syncexe = atom.config.get('pdf-viewer.synctexPath')
    let command = `"${syncexe}" view -i "${position.row + 1}:${position.column + 1}:${file}" -o "${pdfFile}"`;
    cp.exec(command, (err, stdout, stderr) => {
      if (err) { return console.error(`pdf-viewer: synctex error: ${stderr}`) }
      let synctex = {}
      for (let line of stdout.split(/\r?\n/g)) {
        if (line.startsWith('Page:')) {
          synctex.page = parseInt(line.substr(5), 10) - 1
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
        return console.error(`pfd-viewer: synctex stdout parsed with errors`)
      }
      for (let viewer of this.viewers) {
        if (viewer.filePath === pdfFile) {
          return viewer.scrollToPosition(synctex.page, synctex.x, synctex.y)
        }
      }
      atom.workspace.open(`${pdfFile}#page=${synctex.page + 1}`, { split: 'right', searchAllPanes: true }).then(() => { atom.views.getView(editor).focus() })
    })
  },
}

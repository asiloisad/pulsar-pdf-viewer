const { CompositeDisposable, Disposable } = require("atom");
const Viewer = require("./viewer");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

/**
 * PDF Viewer Package
 * Provides PDF viewing capabilities with SyncTeX support for LaTeX integration.
 * Supports auto-refresh, invert mode, and integration with latex-tools.
 */
module.exports = {
  /**
   * Activates the package and registers the PDF opener.
   */
  activate() {
    if (!this.active) {
      this.active = true;
    } else {
      return;
    }
    this.prepareCSS();
    this.viewers = new Set();
    this.buildService = null;
    this.buildStatusSubscriptions = null;
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.workspace.addOpener((uri) => {
        if ((match = uri.match(/(.+\.pdf)($|#.*)/i))) {
          return this.createViewer(match[1], match[2]);
        }
      }),
      atom.commands.add("atom-workspace", {
        "pdf-viewer:reload-all": () => this.reloadAll(),
        "pdf-viewer:invert-mode": () => {
          atom.config.set(
            "pdf-viewer.invertMode",
            !atom.config.get("pdf-viewer.invertMode")
          );
        },
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS();
        this.reloadAll();
      }),
      atom.commands.add('atom-text-editor[data-grammar~="latex"]', {
        "pdf-viewer:synctex": () => this.synctex(),
      }),
      atom.commands.add(".pdf-viewer", {
        "pdf-viewer:compile": () => this.compileFromViewer(),
        "pdf-viewer:open-tex": () => this.openTexFromViewer(),
      })
    );
  },

  /**
   * Deactivates the package and destroys all viewers.
   */
  deactivate() {
    this.active = false;
    for (let viewer of this.viewers) {
      viewer.destroy();
    }
    this.disposables.dispose();
    if (this.buildStatusSubscriptions) {
      this.buildStatusSubscriptions.dispose();
    }
  },

  /**
   * Deserializes a viewer from saved state.
   * @param {Object} state - The serialized state
   * @returns {Viewer|undefined} The restored viewer or undefined
   */
  deserialize(state) {
    if (!fs.existsSync(state.filePath)) {
      return;
    }
    this.activate(); // prevent multiple activation
    return this.createViewer(state.filePath, state.hash);
  },

  /**
   * Creates a new PDF viewer instance.
   * @param {string} filePath - Path to the PDF file
   * @param {string} hash - URL hash for page/position
   * @returns {Viewer} The new viewer instance
   */
  createViewer(filePath, hash) {
    let viewer = new Viewer(filePath, hash);
    this.viewers.add(viewer);
    viewer.onDidDispose(() => {
      this.viewers.delete(viewer);
    });
    return viewer;
  },

  /**
   * Consumes the latex-tools build status service.
   * @param {Object} service - The build status service
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeBuildStatus(service) {
    if (atom.config.get("pdf-viewer.debug")) {
      console.log("[pdf-viewer] Consuming build status service");
    }
    this.buildService = service;
    this.buildStatusSubscriptions = new CompositeDisposable();

    // Subscribe to build events
    this.buildStatusSubscriptions.add(
      service.onDidStartBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build started:", data.file);
        }
        this.handleBuildStart(data.file);
      }),
      service.onDidFinishBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build finished:", data.file);
        }
        this.handleBuildFinish(data.file);
      }),
      service.onDidFailBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build failed:", data.file);
        }
        this.handleBuildFinish(data.file);
      })
    );

    return new Disposable(() => {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log("[pdf-viewer] Disposing build status service");
      }
      this.buildService = null;
      if (this.buildStatusSubscriptions) {
        this.buildStatusSubscriptions.dispose();
        this.buildStatusSubscriptions = null;
      }
    });
  },

  /**
   * Handles LaTeX build start by pausing auto-refresh.
   * @param {string} texFile - Path to the .tex file being compiled
   */
  handleBuildStart(texFile) {
    // Get the corresponding PDF file path
    const pdfFile = texFile.replace(/\.tex$/, ".pdf");

    // Find all viewers showing this PDF and pause their auto-refresh
    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log(
            `[pdf-viewer] Pausing auto-refresh for ${path.basename(pdfFile)}`
          );
        }
        viewer.pauseAutoRefresh();
      }
    }
  },

  /**
   * Handles LaTeX build finish by resuming auto-refresh.
   * @param {string} texFile - Path to the .tex file that was compiled
   */
  handleBuildFinish(texFile) {
    // Get the corresponding PDF file path
    const pdfFile = texFile.replace(/\.tex$/, ".pdf");

    // Find all viewers showing this PDF and resume their auto-refresh
    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log(
            `[pdf-viewer] Resuming auto-refresh for ${path.basename(pdfFile)}`
          );
        }
        viewer.resumeAutoRefresh();
      }
    }
  },

  /**
   * Compiles LESS styles to CSS for the PDF viewer.
   */
  prepareCSS() {
    let lessPath = path.join(
      __dirname,
      "..",
      "vendors",
      "custom",
      "viewer.less"
    );
    let cssPath = path.join(__dirname, "..", "vendors", "custom", "viewer.css");
    let css = atom.themes.loadLessStylesheet(lessPath);
    fs.writeFileSync(cssPath, css);
  },

  /**
   * Reloads all open PDF viewers.
   */
  reloadAll() {
    for (let viewer of this.viewers) {
      viewer.reload();
    }
  },

  /**
   * Triggers LaTeX compilation from the active PDF viewer.
   */
  compileFromViewer() {
    // Get the active PDF viewer
    const pane = atom.workspace.getActivePane();
    const activeItem = pane ? pane.getActiveItem() : null;

    if (
      !activeItem ||
      !activeItem.filePath ||
      !activeItem.filePath.endsWith(".pdf")
    ) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log("[pdf-viewer] No active PDF viewer found");
      }
      return;
    }

    const pdfFile = activeItem.filePath;
    const texFile = pdfFile.replace(/\.pdf$/, ".tex");

    // Check if the .tex file exists
    if (!fs.existsSync(texFile)) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log(
          `[pdf-viewer] No .tex file found for ${path.basename(pdfFile)}`
        );
      }
      atom.notifications.addWarning(
        `pdf-viewer: No .tex file found for ${path.basename(pdfFile)}`
      );
      return;
    }

    // Check if build service is available
    if (!this.buildService) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log(
          "[pdf-viewer] Build service not available (latex-tools not active?)"
        );
      }
      atom.notifications.addWarning(
        "pdf-viewer: latex-tools build service not available"
      );
      return;
    }

    // If .tex file is open in an editor, save it first
    const editors = atom.workspace.getTextEditors();
    for (const editor of editors) {
      if (editor.getPath() === texFile && editor.isModified()) {
        editor.save();
        break;
      }
    }

    // Trigger compilation
    if (atom.config.get("pdf-viewer.debug")) {
      console.log(
        `[pdf-viewer] Triggering compilation of ${path.basename(texFile)}`
      );
    }
    this.buildService.compile(texFile);
  },

  /**
   * Opens the corresponding .tex file from the active PDF viewer.
   */
  openTexFromViewer() {
    // Get the active PDF viewer
    const pane = atom.workspace.getActivePane();
    const activeItem = pane ? pane.getActiveItem() : null;

    if (
      !activeItem ||
      !activeItem.filePath ||
      !activeItem.filePath.endsWith(".pdf")
    ) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log("[pdf-viewer] No active PDF viewer found");
      }
      return;
    }

    const pdfFile = activeItem.filePath;
    const texFile = pdfFile.replace(/\.pdf$/, ".tex");

    // Check if the .tex file exists
    if (!fs.existsSync(texFile)) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log(
          `[pdf-viewer] No .tex file found for ${path.basename(pdfFile)}`
        );
      }
      atom.notifications.addWarning(
        `pdf-viewer: No .tex file found for ${path.basename(pdfFile)}`
      );
      return;
    }

    // Open the .tex file
    if (atom.config.get("pdf-viewer.debug")) {
      console.log(`[pdf-viewer] Opening ${path.basename(texFile)}`);
    }
    atom.workspace.open(texFile, { split: "left", searchAllPanes: true });
  },

  /**
   * Performs forward SyncTeX synchronization from editor to PDF.
   */
  synctex() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }
    const file = editor.getPath();
    if (!file || !file.endsWith(".tex")) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.error(
          `pdf-viewer: Cannot run synctex, because source "${file}" is not TeX file`
        );
      }
      return;
    }
    let pdfFile = file.substr(0, file.lastIndexOf(".")) + ".pdf";
    if (!fs.existsSync(pdfFile)) {
      if (atom.config.get("pdf-viewer.debug")) {
        console.error(
          `pdf-viewer: Cannot run synctex, because "${pdfFile}" does not exists`
        );
      }
      return;
    }
    let position = editor.getLastCursor().getBufferPosition();
    let syncexe = atom.config.get("pdf-viewer.synctexPath");
    let command = `"${syncexe}" view -i "${position.row + 1}:${
      position.column + 1
    }:${file}" -o "${pdfFile}"`;
    cp.exec(command, (err, stdout, stderr) => {
      if (err) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.error(`pdf-viewer: synctex error: ${stderr}`);
        }
        return;
      }
      let synctex = {};
      for (let line of stdout.split(/\r?\n/g)) {
        if (line.startsWith("Page:")) {
          synctex.page = parseInt(line.substr(5), 10) - 1;
        } else if (line.startsWith("x:")) {
          let value = parseFloat(line.substr(2));
          synctex.x = parseInt(value, 10);
        } else if (line.startsWith("y:")) {
          let value = parseFloat(line.substr(2));
          synctex.y = parseInt(value, 10);
        } else if (line.startsWith("before:")) {
          break;
        }
      }
      if (!synctex.page) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.error(`pfd-viewer: synctex stdout parsed with errors`);
        }
        return;
      }
      for (let viewer of this.viewers) {
        if (viewer.filePath === pdfFile) {
          return viewer.scrollToPosition(synctex.page, synctex.x, synctex.y);
        }
      }
      atom.workspace
        .open(`${pdfFile}#page=${synctex.page + 1}`, {
          split: "right",
          searchAllPanes: true,
        })
        .then(() => {
          atom.views.getView(editor).focus();
        });
    });
  },
};

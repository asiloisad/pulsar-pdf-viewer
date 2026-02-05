const { CompositeDisposable, Disposable } = require("atom");
const Viewer = require("./viewer");
const path = require("path");
const fs = require("fs");

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
    this.viewerObservers = new Set();
    this.latexTools = null;
    this.latexToolsSubscriptions = null;
    this.disposables = new CompositeDisposable(
      atom.workspace.addOpener((uri) => {
        const match = uri.match(/(.+\.pdf)($|#.*)/i);
        if (match) {
          return this.createViewer(match[1], match[2]);
        }
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS();
        this.reloadAll();
      }),
      atom.commands.add("atom-workspace", {
        "pdf-viewer:reload-all":
          () => this.reloadAll(),
        "pdf-viewer:invert-mode":
          () => {
            atom.config.set(
              "pdf-viewer.invertMode",
              !atom.config.get("pdf-viewer.invertMode")
            );
          },
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
    if (this.latexToolsSubscriptions) {
      this.latexToolsSubscriptions.dispose();
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
    viewer.getLatexTools = () => this.latexTools; // Getter for latex-tools service
    this.viewers.add(viewer);
    viewer.onDidDispose(() => {
      this.viewers.delete(viewer);
    });
    this.viewerObservers.forEach((callback) => callback(viewer));
    return viewer;
  },

  /**
   * Provides the pdf-viewer service for other packages.
   * @returns {Object} Service object with viewer management methods
   */
  provideViewer() {
    return {
      /**
       * Get all active viewers
       * @returns {Set<Viewer>} Set of active viewer instances
       */
      getViewers: () => this.viewers,

      /**
       * Observe viewers - calls callback for existing and new viewers
       * @param {Function} callback - Called with each viewer
       * @returns {Disposable} Disposable to stop observing
       */
      observeViewers: (callback) => {
        for (const viewer of this.viewers) {
          callback(viewer);
        }
        this.viewerObservers.add(callback);
        return new Disposable(() => {
          this.viewerObservers.delete(callback);
        });
      },

      /**
       * Find a viewer by file path
       * @param {string} filePath - The PDF file path
       * @returns {Viewer|null} The viewer or null
       */
      getViewerByPath: (filePath) => {
        for (const viewer of this.viewers) {
          if (viewer.filePath === filePath) {
            return viewer;
          }
        }
        return null;
      },

      /**
       * Find a viewer by tag in hash
       * @param {string} tag - Tag to search for in viewer hash
       * @returns {Viewer|null} The viewer or null
       */
      getViewerByTag: (tag) => {
        for (const viewer of this.viewers) {
          if (viewer.hash && viewer.hash.includes(tag)) {
            return viewer;
          }
        }
        return null;
      },

      /**
       * Open a PDF file in the viewer
       * @param {string} filePath - Path to the PDF file
       * @param {Object} options - Options for opening
       * @param {string} options.dest - Named destination to scroll to
       * @param {string} options.tag - Tag to identify the viewer
       * @param {string} options.split - Split direction ('left', 'right', 'up', 'down')
       * @param {boolean} options.activatePane - Whether to activate the pane
       * @returns {Promise<Viewer>} The viewer instance
       */
      open: (filePath, options = {}) => {
        const { dest, tag, split = "right", activatePane = false } = options;
        let hash = "";
        if (dest) {
          hash += `#nameddest=${dest}`;
        }
        if (tag) {
          hash += hash ? `&${tag}` : `#${tag}`;
        }
        return atom.workspace.open(`${filePath}${hash}`, {
          split,
          activatePane,
          searchAllPanes: true,
        });
      },

      /**
       * Scroll an existing viewer to a named destination
       * @param {Viewer} viewer - The viewer instance
       * @param {string} dest - Named destination
       */
      scrollToDestination: (viewer, dest) => {
        if (viewer && dest) {
          viewer.scrollToDestination({ dest, destHash: `#${dest}` });
        }
      },

      /**
       * Update a viewer to show a different file
       * @param {Viewer} viewer - The viewer instance
       * @param {string} filePath - New PDF file path
       * @param {string} dest - Optional named destination
       * @param {string} tag - Optional tag
       */
      setFile: (viewer, filePath, dest, tag) => {
        if (!viewer) return;
        let hash = "";
        if (dest) {
          hash += `#nameddest=${dest}`;
        }
        if (tag) {
          hash += hash ? `&${tag}` : `#${tag}`;
        }
        viewer.setFile(filePath, hash);
        viewer.reload();
      },
    };
  },

  /**
   * Consumes the latex-tools build status service.
   * @param {Object} service - The build status service
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeLatexTools(service) {
    if (atom.config.get("pdf-viewer.debug")) {
      console.log("[pdf-viewer] Consuming build status service");
    }
    this.latexTools = service;
    this.latexToolsSubscriptions = new CompositeDisposable();

    // Subscribe to build events
    this.latexToolsSubscriptions.add(
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
      this.latexTools = null;
      if (this.latexToolsSubscriptions) {
        this.latexToolsSubscriptions.dispose();
        this.latexToolsSubscriptions = null;
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
};

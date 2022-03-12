"use babel"

import { CompositeDisposable, Disposable, File } from 'atom'
import { PdfEditorView } from "./pdf-editor-view"
const fs = require("fs");
const path = require("path");

class PdfEditor {

  constructor(filePath, params) {
    this.file = new File(filePath);
    this.params = params;
    this.subscriptions = new CompositeDisposable();
    this.fubscriptions = new CompositeDisposable();
    this.view = new PdfEditorView(this);
    this.onDidChangeTitleCallbacks = new Set();
    this.autoReload = true;
    this.subscribeToFile();
  }

  static deserialize({ filePath }) {
    let isFile = false;
    try {
      isFile = fs.statSync(filePath).isFile();
    }
    catch (e) { }
    if (isFile) {
      return new PdfEditor(filePath, '');
    }
    else {
      console.warn(`Could not deserialise PDF view for path ${filePath} because that file no longer exists`);
    }
  }

  subscribeToFile() {
    this.fubscriptions.add(

      this.file.onDidRename(() => { this.updateTitle() }),

      this.file.onDidChange(() => { if (this.autoReload) {
        console.log('PDF changed')
        this.view.update() }}),

      this.file.onDidDelete(() => {
        if (atom.config.get("pdf-viewer.closeViewWhenFileDeleted")) {
          try {
            this.destroy();
          }
          catch (e) {
            console.warn(`Could not destroy pane after external file was deleted: ${e}`);
          }
        }
      }),

    );
  }

  get element() {
    return this.view.element;
  }

  serialize() {
    return {
      filePath: this.getPath(),
      deserializer: this.constructor.name,
    };
  }

  destroy() {
    this.subscriptions.dispose();
    this.fubscriptions.dispose();
    this.view.destroy();
    if (pane = atom.workspace.paneForItem(this)) { pane.destroyItem(this) }
  }

  onDidDispose(cb) {
    this.subscriptions.add(new Disposable(cb));
  }

  getPath() {
    return this.file.getPath();
  }

  getUri() {
    return this.getURI();
  }

  getURI() {
    return this.getPath();
  }

  getTitle() {
    const filePath = this.getPath();
    return filePath ? path.basename(filePath) : "untitled";
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

  isEqual(other) {
    return other instanceof PdfEditor && this.getURI() === other.getURI();
  }

  onDidInteract(cb) {
    return this.view.events.on("click", (click) => {
      if (click.ctrlKey) {
        cb(click);
      }
    });
  }

  onDidClick(cb) {
    return this.view.events.on("click", cb);
  }

  onDidDoubleClick(cb) {
    return this.view.events.on("dblclick", cb);
  }

  scrollToPosition(pos, options) {
    this.view.scrollToPosition(pos, options);
  }

  setAutoReload(enabled) {
    this.autoReload = enabled;
  }

  reload(uri) {
    if (uri && uri !== this.getURI()) {
      this.fubscriptions.dispose();
      this.fubscriptions = new CompositeDisposable();
      this.file = new File(uri);
      this.subscribeToFile();
    }
    this.view.update();
  }
}

exports.PdfEditor = PdfEditor;

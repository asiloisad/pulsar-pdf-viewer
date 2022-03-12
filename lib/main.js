"use babel"

import { CompositeDisposable, Disposable } from 'atom'
import { SynctexConsumer } from "./synctex-consumer"
import { PdfEditor } from "./pdf-editor"

class PdfViewPackage {

  constructor() {
    this.disposables = new CompositeDisposable();
    this.pdfExtensions = new Set();
    this.openSubscriptions = new Set();
    this.editors = new Set();
  }

  activate() {
    this.disposables.add(

      atom.workspace.addOpener( (uri) => {
        if (match = uri.match(/(.+\.pdf)(#.*)?/i)) {
          const editor = new PdfEditor(match[1], match[2]);
          this.subscribeToEditor(editor);
          return editor;
        }
      }),

      atom.config.observe("pdf-viewer.fileExtensions", this.updateFileExtensions.bind(this)),

      atom.config.observe("pdf-viewer.enableSynctex", this.toggleSynctex.bind(this)),

      atom.commands.add('atom-workspace', {
        'pdf-viewer:reload-all': () => this.editors.forEach((e)=>{e.view.update()}),
      }),

    );
  }

  deserialize(params) {
    const pdfEditor = PdfEditor.deserialize(params);
    if (pdfEditor) {
      this.subscribeToEditor(pdfEditor);
    }
    return pdfEditor;
  }

  subscribeToEditor(editor) {
    this.editors.add(editor);
    editor.onDidDispose(() => { this.editors.delete(editor) });
    this.openSubscriptions.forEach(cb => { cb(editor) });
  }

  dispose() {
    this.disposables.dispose();
  }

  deactivate() {
    this.dispose();
  }

  updateFileExtensions(extensions) {
    this.pdfExtensions.clear();
    for (let extension of extensions) {
      extension = extension.toLowerCase().replace(/^\.*/, ".");
      this.pdfExtensions.add(extension);
    }
  }

  toggleSynctex(enabled) {
    if (enabled) {
      if (!this.synctexConsumer) {
        this.synctexConsumer = new SynctexConsumer();
        this.synctexConsumer.consumePdfview(this.providePdfEvents());
      }
    }
    else if (this.synctexConsumer) {
      atom.notifications.addInfo("Restart to disable SyncTeX");
    }
  }

  providePdfEvents() {
    return {

      observePdfViews: (cb) => {
        this.editors.forEach(editor => { cb(editor) });
        this.openSubscriptions.add(cb);
        return new Disposable(() => { this.openSubscriptions.delete(cb) });
      },

      onDidOpenPdfView: cb => {
        this.openSubscriptions.add(cb);
        return new Disposable(() => { this.openSubscriptions.delete(cb) });
      },

    };
  }

}

module.exports = new PdfViewPackage();

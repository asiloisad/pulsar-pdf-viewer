"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfEditorView = void 0;
const path = require("path");
const atom_1 = require("atom");
class PdfEditorView {
    constructor(editor) {
        const frame = document.createElement("iframe");
        frame.setAttribute("id", "pdf-frame");
        this.events = new atom_1.Emitter();
        this.editor = editor;
        this.element = frame;
        this.ready = false;
        frame.onload = () => {
            this.ready = true;
        };
        window.addEventListener("message", evt => {
            this.handleMessage(evt);
        });
        this.setFile(this.filepath);
    }
    sendMessage(type, data) {
        this.element.contentWindow.postMessage({ type, data });
    }
    handleMessage(msg) {
        if (msg.source !== this.element.contentWindow) {
            return;
        }
        const type = msg.data.type;
        const data = msg.data.data;
        switch (type) {
            case "link":
                this.handleLink(data);
                return;
            case "click":
                this.handleClick(data);
                return;
            case "dblclick":
                this.handleDblclick(data);
                return;
            default:
                throw new Error(`Unexpected message type ${type} from iframe`);
        }
    }
    async handleLink({ link }) {
        if (typeof link !== "string") {
            throw new Error("Expected external link to be a string");
        }
        (await Promise.resolve().then(() => require("electron"))).shell.openExternal(link);
    }
    handleClick(clickData) {
        this.events.emit("click", clickData);
    }
    handleDblclick(clickData) {
        this.events.emit("dblclick", clickData);
    }
    get filepath() {
        return this.editor.getPath();
    }
    viewerSrc() {
        return path.join(__dirname, "..", "pdfjs", "web", "viewer.html");
    }
    setFile(filepath) {
        let params;
        if (this.editor.params) {
            params = this.editor.params.substring(1);
        }
        else {
            params = '';
        }
        const src = `${this.viewerSrc()}?file=${encodeURIComponent(filepath)}#` + params;
        this.ready = false;
        this.element.setAttribute("src", src);
    }
    update() {
        if (this.ready) {
            this.sendMessage("refresh", { filepath: this.filepath });
        }
        else {
            this.setFile(this.filepath);
        }
    }
    destroy() {
        this.ready = false;
    }
    scrollToPosition(pos, options) {
        const payload = pos;
        if (options && options.origin) {
            payload.origin = options.origin;
        }
        this.sendMessage("setposition", pos);
    }
}
exports.PdfEditorView = PdfEditorView;

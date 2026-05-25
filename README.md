# pdf-viewer

View PDF files directly in Pulsar. Based on Mozilla's PDF.js with theme integration, SyncTeX support, and document outline.

![title-pic](https://github.com/asiloisad/pulsar-pdf-viewer/blob/master/assets/title-pic.png?raw=true)

## Features

- **PDF.js integration**: Full-featured PDF viewing in editor panes.
- **Theme support**: Adapts to Pulsar UI and syntax themes.
- **Auto-reload**: Watches for file changes and refreshes automatically.
- **Color inversion**: Dark mode for PDFs toggle or via [invert-colors](https://github.com/asiloisad/pulsar-invert-colors).
- **LaTeX integration**: Compile `.tex` files and SyncTeX support via [latex-tools](https://github.com/asiloisad/pulsar-latex-tools).
- **Typst integration**: Compile `.typ` files via [typst-tools](https://github.com/asiloisad/pulsar-typst-tools).
- **Build coordination**: Pauses auto-refresh during builds and reloads on completion.
- **Document outline**: Navigate via [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel).
- **Scrollmap**: Shows outline markers via [scrollmap-pdf-viewer](https://github.com/asiloisad/pulsar-scrollmap-pdf-viewer).
- **SOFiSTiK help**: Search keywords at current scope via [sofistik-tools](https://github.com/asiloisad/pulsar-sofistik-tools).

## Installation

To install `pdf-viewer` search for [pdf-viewer](https://web.pulsar-edit.dev/packages/pdf-viewer) in the Install pane of the Pulsar settings or run `ppm install pdf-viewer`. Alternatively, you can run `ppm install asiloisad/pulsar-pdf-viewer` to install a package directly from the GitHub repository.

## Commands

Commands available in `atom-workspace`:

- `pdf-viewer:reload-all`: reload all open PDF viewers,
- `pdf-viewer:invert-mode`: toggle color inversion for all viewers.

Commands available in `.pdf-viewer`:

- `pdf-viewer:refresh`: refresh content for the current viewer,
- `pdf-viewer:toggle-refreshing`: toggle auto-refresh for the current viewer,
- `pdf-viewer:invert-current`: invert colors for the current viewer,
- `pdf-viewer:compile`: compile the source `.typ` or `.tex` file,
- `pdf-viewer:open-tex`: open the corresponding `.typ` or `.tex` source file,
- `pdf-viewer:next-page`: go to the next page,
- `pdf-viewer:previous-page`: go to the previous page,
- `pdf-viewer:first-page`: go to the first page,
- `pdf-viewer:last-page`: go to the last page,
- `pdf-viewer:scroll-up`: scroll up,
- `pdf-viewer:scroll-down`: scroll down,
- `pdf-viewer:scroll-left`: scroll left,
- `pdf-viewer:scroll-right`: scroll right,
- `pdf-viewer:page-up`: scroll up by one viewport,
- `pdf-viewer:page-down`: scroll down by one viewport,
- `pdf-viewer:zoom-in`: zoom in,
- `pdf-viewer:zoom-out`: zoom out,
- `pdf-viewer:zoom-reset`: reset zoom,
- `pdf-viewer:rotate-clockwise`: rotate clockwise,
- `pdf-viewer:rotate-counterclockwise`: rotate counterclockwise,
- `pdf-viewer:select-tool`: enable the text selection tool,
- `pdf-viewer:hand-tool`: enable the hand tool,
- `pdf-viewer:find`: open find,
- `pdf-viewer:find-next`: find next match,
- `pdf-viewer:find-previous`: find previous match,
- `pdf-viewer:copy`: copy the selected text to the clipboard,
- `pdf-viewer:toggle-sidebar`: toggle the PDF sidebar,
- `pdf-viewer:presentation-mode`: enter presentation mode,
- `pdf-viewer:download`: download the PDF,
- `pdf-viewer:print`: print the PDF.

## Style

The style of the documents has been adapted to match the theme in Pulsar. As the style changes, you may notice the menu colors change. An additional option has been introduced to invert the colors of the document itself. To invert the document colors, change the options in the package settings, use `pdf-viewer:invert-mode` from the command palette, or press keybind while viewing an active file.

![dark-mode](https://github.com/asiloisad/pulsar-pdf-viewer/blob/master/assets/dark-mode.png?raw=true)

## Document outline

The viewer supports the [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel) package via the `navigation-adapter` service. You can search through the document using the all-in outline tree instead of the PDFjs outline. Scroll position is tracked and the active section is highlighted in the panel.

## URI options

The package supports additional options when opening a PDF. These options allow you to open a PDF on a specific page, set the initial zoom level, open the file to a named destination, or select a sidebar state. For more information, see [pdf.js viewer options](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## LaTeX

This package integrates with [latex-tools](https://github.com/asiloisad/pulsar-latex-tools) for compilation and SyncTeX support:

- **Compile**: Use directly from the PDF viewer to compile the corresponding `.tex` file.
- **Forward SyncTeX** (source → PDF): Use synctex trigger from the editor.
- **Backward SyncTeX** (PDF → source): Right-click on a location in the PDF.
- **Build coordination**: Auto-refresh pauses during compilation and resumes when the build finishes.

For PDF files created by TeX using the `--synctex=1` option, clicking on the PDF will take you to the corresponding source code. The `synctex` binary path can be configured in the latex-tools package settings.

## Typst

This package integrates with [typst-tools](https://github.com/asiloisad/pulsar-typst-tools) for compilation:

- **Compile**: Use directly from the PDF viewer to compile the corresponding `.typ` file.
- **Open source**: Use `pdf-viewer:open-tex` to open the `.typ` source file.
- **Build coordination**: Auto-refresh pauses during compilation and resumes when the build finishes.

When both `.typ` and `.tex` source files exist, the Typst source takes priority.

## SOFiSTiK

This package is adapted to support `sofistik-tools` for help functions using search keywords at the current scope. For more information, see the [sofistik-tools](https://github.com/asiloisad/pulsar-sofistik-tools) package.

## Provided Service `pdf-viewer`

Allows other packages to manage PDF viewers programmatically. Open PDFs, observe viewer instances, scroll to destinations, and update viewer files.

In your `package.json`:

```json
{
  "consumedServices": {
    "pdf-viewer": {
      "versions": {
        "1.0.0": "consumePdfViewer"
      }
    }
  }
}
```

In your main module:

```javascript
consumePdfViewer(service) {
  // Observe all viewers (existing and new)
  this.subscriptions.add(
    service.observeViewers((viewer) => {
      console.log(`Viewer opened: ${viewer.filePath}`);
    })
  );

  // Open a PDF in a split pane
  service.open('/path/to/file.pdf', {
    split: 'right',
    dest: 'chapter1',
    activatePane: false,
  });

  // Find a viewer by file path
  const viewer = service.getViewerByPath('/path/to/file.pdf');

  // Scroll to a named destination
  service.scrollToDestination(viewer, 'section2');
}
```

## Provided Service `navigation-adapter`

Exposes the PDF document outline to [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel). Registers automatically when both packages are installed.

In your `package.json`:

```json
{
  "consumedServices": {
    "navigation-adapter": {
      "versions": {
        "1.0.0": "consumeNavigationAdapter"
      }
    }
  }
}
```

In your main module:

```javascript
consumeNavigationAdapter(adapter) {
  // adapter follows the navigation-adapter protocol:
  // handlesItem(item), observeHeaders(item, callback), navigateTo(item, header)
}
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!

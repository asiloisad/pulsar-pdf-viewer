# pdf-viewer

View PDF files directly in Pulsar. Based on Mozilla's PDF.js with theme integration, SyncTeX support, and document outline.

![title-pic](https://github.com/asiloisad/pulsar-pdf-viewer/blob/master/assets/title-pic.png?raw=true)

## Features

- **PDF.js integration**: Full-featured PDF viewing in editor panes.
- **Theme support**: Adapts to Pulsar UI and syntax themes.
- **Color inversion**: Dark mode for PDFs with `F8` toggle.
- **SyncTeX**: Forward and backward search for LaTeX files.
- **Auto-reload**: Watches for file changes and refreshes.
- **Document outline**: Navigate via [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel).
- **Scrollmap**: Shows outline markers via [scrollmap-pdf-viewer](https://github.com/asiloisad/pulsar-scrollmap-pdf-viewer).

## Installation

To install `pdf-viewer` search for [pdf-viewer](https://web.pulsar-edit.dev/packages/pdf-viewer) in the Install pane of the Pulsar settings or run `ppm install pdf-viewer`. Alternatively, you can run `ppm install asiloisad/pulsar-pdf-viewer` to install a package directly from the GitHub repository.

## Commands

Commands available in `atom-workspace`:

- `pdf-viewer:reload-all`: reload all open PDF viewers,
- `pdf-viewer:invert-mode`: (`F8`) toggle color inversion for all viewers.

Commands available in `atom-text-editor[data-grammar~="latex"]`:

- `pdf-viewer:synctex`: (`Alt+F8`) jump to corresponding PDF location.

Commands available in `.pdf-viewer`:

- `pdf-viewer:compile`: compile the source `.tex` file,
- `pdf-viewer:open-tex`: open the corresponding `.tex` file.

## Keyboard shortcuts

The keyboard shortcuts within the PDF.js viewer remain unchanged and cannot be modified from within Pulsar. For more information, refer to the [default keymap](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-shortcuts):

- The `Home`, `End`, `PageUp`, `PageDown`, and arrow keys can be used to navigate the document.
- Next page: `N`, `J`, `Space` (presentation mode only), `Enter` (presentation mode only), or `LeftClick` (presentation mode only).
- Previous page: `P`, `K`, `Shift+Space` (presentation mode only), `Shift+Enter` (presentation mode only), or `Shift+LeftClick` (presentation mode only).
- User interface buttons or `Ctrl+MouseWheel` can be used to change the zoom level.
- Zoom in: `Ctrl++`, `Ctrl+=`.
- Zoom out: `Ctrl+-`.
- Restore normal zoom: `Ctrl+0`.
- Rotate the document clockwise: `R`.
- Rotate the document counterclockwise: `Shift+R`.
- Activate presentation mode: `Ctrl+Alt+P`.
- Enable the hand tool: `H`.
- Enable the text selection tool: `S`.
- Move focus to the 'go to page' box: `Ctrl+Alt+G`.
- Find text in the document: `Ctrl+F`.
- Find the next occurrence of text in the document: `Ctrl+G`.
- Find the previous occurrence of text in the document: `Ctrl+Shift+G`.
- Print the document: unset.
- Download the document: `Ctrl+S`.
- Open a file: `Ctrl+O`.
- Use `F4` to toggle the visibility of the sidebar.

After showing the sidebar, click on the "Show document outline" button to display the document outline (if the PDF file has one). Nested outline items can be expanded/collapsed by clicking on the triangles to the left of an item. To expand/collapse all items under the selected item, press `Shift` while clicking on the triangle. Double-click on the "Show document outline" button to expand/collapse all outline items.

Additional keyboard shortcuts have been introduced:

- Open command palette: `Ctrl+Shift+P`, `F1`.
- Refresh content for the current viewer: `F5`.
- Toggle auto-refresh for the current viewer: `Ctrl+F5`.
- Invert colors for the current viewer: `F8`.
- Use SyncTeX and go to the corresponding `.tex` file if available: `Right-click`.
- Focus pane on left: `Alt+Left`
- Focus pane above: `Alt+Up`
- Focus pane on right: `Alt+Right`
- Focus pane below: `Alt+Down`

Some keymap of external packages have been implemented:

- [[navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel)] Toggle panel: `Alt+N`
- [[open-external](https://github.com/asiloisad/pulsar-open-external)] Open external: `Alt+F12`
- [[open-external](https://github.com/asiloisad/pulsar-open-external)] Show in folder: `Ctrl+F12`
- [[project-list](https://github.com/asiloisad/pulsar-project-list)] Toggle recent list: `Alt+F10`
- [[project-list](https://github.com/asiloisad/pulsar-project-list)] Toggle project list: `F10`
- [[fuzzy-files](https://github.com/asiloisad/pulsar-fuzzy-files)] Toggle file list: `Ctrl+P`

## Style

The style of the documents has been adapted to match the theme in Pulsar. As the style changes, you may notice the menu colors change. An additional option has been introduced to invert the colors of the document itself. To invert the document colors, change the options in the package settings, use `pdf-viewer:invert-mode` from the command palette, or press `F8` while viewing an active file.

![dark-mode](https://github.com/asiloisad/pulsar-pdf-viewer/blob/master/assets/dark-mode.png?raw=true)

## Document outline

The viewer supports the [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel) package. You can search through the document using the all-in outline tree instead of the PDFjs outline.

## URI options

The package supports additional options when opening a PDF. These options allow you to open a PDF on a specific page, set the initial zoom level, open the file to a named destination, or select a sidebar state. For more information, see [pdf.js viewer options](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## LaTeX

This package supports SyncTeX for `.tex` and `.pdf` files in both directions. To go from a `.tex` file to a `.pdf` file, use the `pdf-viewer:synctex` command from the command palette. To go from a `.pdf` file to a `.tex` file, right-click on the desired location in the PDF.

For PDF files created by TeX using the `--synctex=1` option, clicking on the PDF will take you to the corresponding source code. If the `synctex` command (part of modern TeX distributions) is in your PATH, this functionality will work out of the box. Otherwise, you can configure the path to the `synctex` binary in the package settings.

The viewer can remember the page before a refresh and set it as the initial page after the refresh.

![latex-synctex](https://github.com/asiloisad/pulsar-pdf-viewer/blob/master/assets/latex-synctex.png?raw=true)

## SOFiSTiK

This package is adapted to support `sofistik-tools` for help functions using search keywords at the current scope. For more information, see the [sofistik-tools](https://github.com/asiloisad/pulsar-sofistik-tools) package.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!

# pdf-viewer

<p align="center">
  <a href="https://github.com/bacadra/pulsar-pdf-viewer/tags">
  <img src="https://img.shields.io/github/v/tag/bacadra/pulsar-pdf-viewer?style=for-the-badge&label=Latest&color=blue" alt="Latest">
  </a>
  <a href="https://github.com/bacadra/pulsar-pdf-viewer/issues">
  <img src="https://img.shields.io/github/issues-raw/bacadra/pulsar-pdf-viewer?style=for-the-badge&color=blue" alt="OpenIssues">
  </a>
  <a href="https://github.com/bacadra/pulsar-pdf-viewer/blob/master/package.json">
  <img src="https://img.shields.io/github/languages/top/bacadra/pulsar-pdf-viewer?style=for-the-badge&color=blue" alt="Language">
  </a>
  <a href="https://github.com/bacadra/pulsar-pdf-viewer/blob/master/LICENSE">
  <img src="https://img.shields.io/github/license/bacadra/pulsar-pdf-viewer?style=for-the-badge&color=blue" alt="Licence">
  </a>
</p>

![title-pic](https://github.com/bacadra/pulsar-pdf-viewer/blob/master/assets/title-pic.png?raw=true)

The pdf-viewer package is a PDF viewer for Pulsar. It is a wrapper around Mozilla's PDF.js library, including its viewer application, adapted for the Pulsar environment.

PDF files can be opened from the Pulsar user interface, such as from the project tree view, or programmatically using `atom.workspace.open(uri)`. The package watches for file changes and reloads the PDF if necessary. Viewer panes are persistent across Pulsar runs. The `uri` consists of the filepath and optional [parameters](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## Installation

To install `pdf-viewer` search for [pdf-viewer](https://web.pulsar-edit.dev/packages/pdf-viewer) in the Install pane of the Pulsar settings or run `ppm install pdf-viewer`.

Alternatively, you can run `ppm install bacadra/pulsar-pdf-viewer` to install a package directly from the Github repository.

## Keyboard shortcuts

The keyboard shortcuts within the PDF.js viewer remain unchanged and cannot be modified from within Pulsar. For more information, refer to the [default keymap](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-shortcuts):

* The `Home`, `End`, `PageUp`, `PageDown`, and arrow keys can be used to navigate the document.
* Next page: `N`, `J`, `Space` (presentation mode only), `Enter` (presentation mode only), or `LeftClick` (presentation mode only).
* Previous page: `P`, `K`, `Shift-Space` (presentation mode only), `Shift-Enter` (presentation mode only), or `Shift-LeftClick` (presentation mode only).
* User interface buttons or `Ctrl-MouseWheel` can be used to change the zoom level.
* Zoom in: `Ctrl-+`, `Ctrl-=`.
* Zoom out: `Ctrl--`.
* Restore normal zoom: `Ctrl-0`.
* Rotate the document clockwise: `r`.
* Rotate the document counterclockwise: `Shift-R`.
* Activate presentation mode: `Ctrl-Alt-P`.
* Enable the hand tool: `h`.
* Enable the text selection tool: `s`.
* Move focus to the 'go to page' box: `Ctrl-Alt-G`.
* Find text in the document: `Ctrl-F`.
* Find the next occurrence of text in the document: `Ctrl-G`.
* Find the previous occurrence of text in the document: Shift + `Ctrl-G`.
* Print the document: unset.
* Download the document: `Ctrl-S`.
* Open a file: `Ctrl-O`.
* Use `F4` to toggle the visibility of the sidebar.

After showing the sidebar, click on the "Show document outline" button to display the document outline (if the PDF file has one). Nested outline items can be expanded/collapsed by clicking on the triangles to the left of an item. To expand/collapse all items under the selected item, press `Shift` while clicking on the triangle. Double-click on the "Show document outline" button to expand/collapse all outline items.

Additional keyboard shortcuts have been introduced:

* Open command palette: `Ctrl-Shift-P`, `F1`.
* Refresh content for the current viewer: `F5`.
* Toggle auto-refresh for the current viewer: `Ctrl-F5`.
* Invert colors for the current viewer: `F8`.
* Use SyncTeX and go to the corresponding `.tex` file (if available): Right-click.
* Focus pane on left: `Alt-Left`
* Focus pane above: `Alt-Up`
* Focus pane on right: `Alt-Right`
* Focus pane below: `Alt-Down`

Some keymap of external packages have been implemented:
* [[navigation-panel](https://github.com/bacadra/pulsar-navigation-panel)] Toggle panel: `Alt-N`
* [[open-external](https://github.com/bacadra/pulsar-open-external)] Open external: `Alt-F12`
* [[open-external](https://github.com/bacadra/pulsar-open-external)] Show in folder: `Ctrl-F12`
* [[project-list](https://github.com/bacadra/pulsar-project-list)] Toggle recent list: `Alt-F10`
* [[project-list](https://github.com/bacadra/pulsar-project-list)] Toggle project list: `F10`
* [[fuzzy-files](https://github.com/bacadra/pulsar-fuzzy-files)] Toggle file list: `Ctrl-P`

## Style

The style of the documents has been adapted to match the theme in Pulsar. As the style changes, you may notice the menu colors change. An additional option has been introduced to invert the colors of the document itself. To invert the document colors, change the options in the package settings, use `pdf-viewer:invert-mode` from the command palette, or press `F8` while viewing an active file.

![dark-mode](https://github.com/bacadra/pulsar-pdf-viewer/blob/master/assets/dark-mode.png?raw=true)

## Document outline

The viewer supports the [navigation-panel](https://github.com/bacadra/pulsar-navigation-panel) package. You can search through the document using the all-in outline tree instead of the PDFjs outline.

## URI options

The package supports additional options when opening a PDF. These options allow you to open a PDF on a specific page, set the initial zoom level, open the file to a named destination, or select a sidebar state. For more information, see [pdf.js viewer options](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## LaTeX

This package supports SyncTeX for `.tex` and `.pdf` files in both directions. To go from a `.tex` file to a `.pdf` file, use the `pdf-viewer:synctex` command from the command palette. To go from a `.pdf` file to a `.tex` file, right-click on the desired location in the PDF.

For PDF files created by TeX using the `--synctex=1` option, clicking on the PDF will take you to the corresponding source code. If the `synctex` command (part of modern TeX distributions) is in your PATH, this functionality will work out of the box. Otherwise, you can configure the path to the `synctex` binary in the package settings.

The viewer can remember the page before a refresh and set it as the initial page after the refresh.

![latex-synctex](https://github.com/bacadra/pulsar-pdf-viewer/blob/master/assets/latex-synctex.png?raw=true)

## SOFiSTiK

This package is adapted to support `sofistik-tools` for help functions using search keywords at the current scope. For more information, see the [sofistik-tools](https://github.com/bacadra/pulsar-sofistik-tools) package.

# Contributing [🍺](https://www.buymeacoffee.com/asiloisad)

If you have any ideas on how to improve the package, spot any bugs, or would like to support the development of new features, please feel free to share them via GitHub.

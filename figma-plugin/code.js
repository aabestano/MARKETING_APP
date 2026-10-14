figma.showUI(__html__, { width: 320, height: 220, title: "IDEAte SVG" });

figma.ui.onmessage = (msg) => {
  if (!msg || msg.type !== "import-svg" || typeof msg.svg !== "string" || msg.svg.indexOf("<svg") === -1) {
    figma.notify("Choose an IDEAte Figma SVG file.");
    return;
  }
  const node = figma.createNodeFromSvg(msg.svg);
  figma.currentPage.appendChild(node);
  figma.viewport.scrollAndZoomIntoView([node]);
  figma.closePlugin("Imported the IDEAte SVG as layers.");
};

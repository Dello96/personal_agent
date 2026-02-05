const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/generate-pdf.js <markdown-file>");
  process.exit(1);
}

const absInput = path.isAbsolute(inputPath)
  ? inputPath
  : path.join(process.cwd(), inputPath);

if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

const content = fs.readFileSync(absInput, "utf-8");
const lines = content.split(/\r?\n/);

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 60, left: 55, right: 55 },
  bufferPages: true,
});

const outputPath = absInput.replace(/\.md$/i, ".pdf");
doc.pipe(fs.createWriteStream(outputPath));

const fontCandidates = [
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/System/Library/Fonts/Supplemental/AppleMyungjo.ttf",
  "/Library/Fonts/AppleGothic.ttf",
  "/Library/Fonts/AppleMyungjo.ttf",
  "/System/Library/Fonts/Supplemental/NotoSansCJKkr-Regular.otf",
  "/Library/Fonts/NotoSansCJKkr-Regular.otf",
];

const pickFontPath = () =>
  fontCandidates.find((fontPath) => fs.existsSync(fontPath));
const customFontPath = pickFontPath();
const hasCustomFont = Boolean(customFontPath);
if (customFontPath) {
  doc.registerFont("Korean", customFontPath);
  doc.registerFont("Korean-Bold", customFontPath);
} else {
  console.warn(
    "Korean font not found. Falling back to Helvetica; Hangul may render incorrectly."
  );
}

const colors = {
  primary: "#6B4EFF",
  text: "#222222",
  muted: "#666666",
  line: "#E6E6E6",
};

const fontName = hasCustomFont ? "Korean" : "Helvetica";
const fontNameBold = hasCustomFont ? "Korean-Bold" : "Helvetica-Bold";

const setHeading = (level) => {
  if (level === 1)
    doc.fontSize(22).font(fontNameBold).fillColor(colors.primary);
  else if (level === 2)
    doc.fontSize(16).font(fontNameBold).fillColor(colors.text);
  else doc.fontSize(13).font(fontNameBold).fillColor(colors.text);
};

const setBody = () => {
  doc.fontSize(11).font(fontName).fillColor(colors.text);
};

// Cover (first H1)
let coverDone = false;
const firstH1Index = lines.findIndex((l) => l.startsWith("# "));
if (firstH1Index !== -1) {
  const title = lines[firstH1Index].replace(/^# /, "").trim();
  doc.fontSize(28).font(fontNameBold).fillColor(colors.primary);
  doc.text(title, { align: "left" });
  doc.moveDown(0.6);
  doc.fontSize(12).font(fontName).fillColor(colors.muted);
  doc.text("Portfolio Document", { align: "left" });
  doc.moveDown(1.4);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor(colors.line)
    .lineWidth(1)
    .stroke();
  doc.moveDown(1.2);
  coverDone = true;
}

lines.forEach((line, idx) => {
  if (idx === firstH1Index && coverDone) return;
  if (line.trim() === "---") {
    doc.moveDown(0.8);
    return;
  }
  if (line.startsWith("# ")) {
    setHeading(1);
    doc.text(line.replace(/^# /, ""), { paragraphGap: 6 });
    setBody();
    return;
  }
  if (line.startsWith("## ")) {
    doc.moveDown(0.2);
    setHeading(2);
    doc.text(line.replace(/^## /, ""), { paragraphGap: 4 });
    setBody();
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor(colors.line)
      .lineWidth(0.7)
      .stroke();
    doc.moveDown(0.4);
    return;
  }
  if (line.startsWith("### ")) {
    setHeading(3);
    doc.text(line.replace(/^### /, ""), { paragraphGap: 3 });
    setBody();
    return;
  }
  if (line.startsWith("- ")) {
    setBody();
    doc.fillColor(colors.text);
    doc.text(`• ${line.replace(/^- /, "")}`, {
      indent: 12,
      paragraphGap: 2,
    });
    return;
  }
  setBody();
  doc.fillColor(colors.text);
  doc.text(line, { paragraphGap: 2 });
});

// Footer with page numbers
const addPageNumbers = () => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(9).fillColor(colors.muted);
    doc.text(
      `Page ${i + 1} / ${range.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 20,
      {
        align: "right",
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      }
    );
  }
};

addPageNumbers();
doc.end();

console.log(`Generated: ${outputPath}`);

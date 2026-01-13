import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';

export class DocumentConverter {
  /**
   * Helper to replace non-standard characters with ASCII equivalents
   * pdf-lib StandardFonts do not support UTF-8 characters like Turkish ones.
   */
  private static sanitizeText(text: string): string {
    if (!text) return "";
    return text
      .replace(/ğ/g, "g").replace(/Ğ/g, "G")
      .replace(/ü/g, "u").replace(/Ü/g, "U")
      .replace(/ş/g, "s").replace(/Ş/g, "S")
      .replace(/ı/g, "i").replace(/İ/g, "I")
      .replace(/ö/g, "o").replace(/Ö/g, "O")
      .replace(/ç/g, "c").replace(/Ç/g, "C")
      // Remove other non-ascii if needed, or hope for the best
      .replace(/[^\x00-\x7F]/g, "?");
  }

  /**
   * Convert Excel buffer to PDF buffer
   */
  static async excelToPdf(buffer: Buffer): Promise<Uint8Array> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      // Use header: 1 to get array of arrays
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length === 0) continue;

      // Initial page
      let page = pdfDoc.addPage([842, 595]); // A4 landscape
      const { width, height } = page.getSize();
      let yPosition = height - 50;

      // Sheet title
      page.drawText(this.sanitizeText(sheetName), {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 30;

      // Cell dimensions
      const cellHeight = 20;
      // Heuristic: limit columns to fit or calculate based on content
      // For simplicity using logic from snippet: max 10 cols
      const maxCols = Math.min(jsonData[0]?.length || 0, 10);
      const cellWidth = (width - 100) / (maxCols || 1);

      // Draw Loop
      for (let i = 0; i < jsonData.length; i++) {
        // Check for new page space
        if (yPosition < 50) {
          page = pdfDoc.addPage([842, 595]);
          yPosition = height - 50;
        }

        const row = jsonData[i];
        if (!row) continue;

        for (let j = 0; j < Math.min(row.length, maxCols); j++) {
          const rawValue = String(row[j] || '');
          const cellValue = this.sanitizeText(rawValue);
          const xPosition = 50 + (j * cellWidth);

          // Cell border
          page.drawRectangle({
            x: xPosition,
            y: yPosition - cellHeight,
            width: cellWidth,
            height: cellHeight,
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 0.5,
          });

          // Cell content (truncated)
          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(cellValue, fontSize);

          let truncatedText = cellValue;
          if (textWidth > cellWidth - 10) {
            // Handle potential division by zero if string length is 0 (though sanitizeText usually avoids this if rawValue was not empty)
            const charWidth = cellValue.length > 0 ? textWidth / cellValue.length : 0;
            if (charWidth > 0) {
              const maxChars = Math.floor((cellWidth - 10) / charWidth);
              truncatedText = cellValue.substring(0, Math.max(0, maxChars)) + '...';
            }
          }

          page.drawText(truncatedText, {
            x: xPosition + 5,
            y: yPosition - 15,
            size: fontSize,
            font: i === 0 ? boldFont : font,
            color: rgb(0, 0, 0),
          });
        }
        yPosition -= cellHeight;
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Convert Word/Docx buffer to PDF buffer
   */
  static async docToPdf(buffer: Buffer): Promise<Uint8Array> {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4 portrait
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Simple text extraction from HTML
    // Note: robust HTML to PDF is complex, this is a basic text extraction
    const rawText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const text = this.sanitizeText(rawText);

    const { width, height } = page.getSize();
    const fontSize = 12;
    const maxWidth = width - 100; // 50 margin each side
    let yPosition = height - 50;

    const words = text.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (textWidth > maxWidth) {
        // Print current line
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        // Move down
        yPosition -= (fontSize + 5);

        // New page if needed
        if (yPosition < 50) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        line = word + ' ';
      } else {
        line = testLine;
      }
    }

    // Last line
    if (line) {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    return await pdfDoc.save();
  }
}

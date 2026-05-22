import { Injectable } from '@angular/core';
import { DocumentType, PaperSize } from './photo-state.service';

const PRINT_DPI = 300;

@Injectable({ providedIn: 'root' })
export class PhotoDownloadService {
  private lastJpegUrl: string | null = null;

  async renderPhotoJpeg(
    processedImageUrl: string,
    docType: DocumentType,
    paper: PaperSize
  ): Promise<{ url: string; qualityWarning: boolean }> {
    const { canvas: layoutCanvas, qualityWarning } = await this.renderLayoutCanvas(processedImageUrl, docType, paper);
    const url = await new Promise<string>((resolve, reject) => {
      layoutCanvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob failed')); return; }
        resolve(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.95);
    });
    if (this.lastJpegUrl) {
      URL.revokeObjectURL(this.lastJpegUrl);
    }
    this.lastJpegUrl = url;
    return { url, qualityWarning };
  }

  async renderLayoutPdf(
    processedImageUrl: string,
    docType: DocumentType,
    paper: PaperSize
  ): Promise<void> {
    const { canvas: paperCanvas } = await this.renderLayoutCanvas(processedImageUrl, docType, paper);
    const dataUrl = paperCanvas.toDataURL('image/png');
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      unit: 'mm',
      format: [paper.widthMm, paper.heightMm],
      orientation: paper.orientation === 'landscape' ? 'landscape' : 'portrait'
    });
    doc.addImage(dataUrl, 'PNG', 0, 0, paper.widthMm, paper.heightMm);
    doc.save('photo-layout.pdf');
  }

  private async renderLayoutCanvas(
    processedImageUrl: string,
    docType: DocumentType,
    paper: PaperSize
  ): Promise<{ canvas: HTMLCanvasElement; qualityWarning: boolean }> {
    const { canvas: photoCanvas, qualityWarning } = await this.renderPhotoCanvas(processedImageUrl, docType);

    const cols = Math.floor(paper.widthMm / docType.widthMm);
    const rows = Math.floor(paper.heightMm / docType.heightMm);
    const marginXmm = (paper.widthMm - cols * docType.widthMm) / 2;
    const marginYmm = (paper.heightMm - rows * docType.heightMm) / 2;

    const paperW = Math.round(paper.widthMm / 25.4 * PRINT_DPI);
    const paperH = Math.round(paper.heightMm / 25.4 * PRINT_DPI);
    const slotW = photoCanvas.width;
    const slotH = photoCanvas.height;
    const marginX = Math.round(marginXmm / 25.4 * PRINT_DPI);
    const marginY = Math.round(marginYmm / 25.4 * PRINT_DPI);

    const canvas = document.createElement('canvas');
    canvas.width = paperW;
    canvas.height = paperH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paperW, paperH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.drawImage(photoCanvas, marginX + col * slotW, marginY + row * slotH, slotW, slotH);
      }
    }

    return { canvas, qualityWarning };
  }

  private async renderPhotoCanvas(
    processedImageUrl: string,
    docType: DocumentType
  ): Promise<{ canvas: HTMLCanvasElement; qualityWarning: boolean }> {
    const img = await this.loadImage(processedImageUrl);
    const targetW = Math.round(docType.widthMm / 25.4 * PRINT_DPI);
    const targetH = Math.round(docType.heightMm / 25.4 * PRINT_DPI);
    const qualityWarning = Math.min(img.naturalWidth, img.naturalHeight) < Math.max(targetW, targetH);

    const side = img.naturalWidth; // processedImage is always square
    let srcX = 0, srcY = 0, srcW = side, srcH = side;

    if (docType.widthMm === docType.heightMm) {
      // Square — no crop
    } else if (docType.widthMm < docType.heightMm) {
      // Portrait: reduce width
      srcW = Math.round(side * (docType.widthMm / docType.heightMm));
      srcX = Math.round((side - srcW) / 2);
    } else {
      // Landscape: reduce height
      srcH = Math.round(side * (docType.heightMm / docType.widthMm));
      srcY = Math.round((side - srcH) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

    return { canvas, qualityWarning };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

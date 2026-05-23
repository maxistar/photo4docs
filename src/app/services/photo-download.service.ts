import { Injectable } from '@angular/core';
import { DocumentType, FaceLandmarks, PaperSize, PhotoStateService } from './photo-state.service';
import { CropResult, PhotoCropService } from './photo-crop.service';

const PRINT_DPI = 300;
export const EXPORT_SITE_URL = 'photo.preloader.org';
export type ExportScope = 'layout' | 'single';
export type ExportFormat = 'jpeg' | 'png' | 'pdf';
export type ExportImageFormat = Exclude<ExportFormat, 'pdf'>;

export interface LayoutGeometry {
  cols: number;
  rows: number;
  marginX: number;
  marginY: number;
  labelBandHeight: number;
  labelY: number | null;
}

@Injectable({ providedIn: 'root' })
export class PhotoDownloadService {
  private lastImageUrl: string | null = null;

  constructor(private photoCropService: PhotoCropService, private photoState: PhotoStateService) {}

  async renderLayoutJpeg(
    sourceImageUrl: string,
    docType: DocumentType,
    paper: PaperSize,
    landmarks: FaceLandmarks | null = null
  ): Promise<{ url: string; qualityWarning: boolean; result: CropResult }> {
    return this.renderLayoutImage(sourceImageUrl, docType, paper, 'jpeg', landmarks);
  }

  async renderLayoutImage(
    sourceImageUrl: string,
    docType: DocumentType,
    paper: PaperSize,
    format: ExportImageFormat,
    landmarks: FaceLandmarks | null = null
  ): Promise<{ url: string; qualityWarning: boolean; result: CropResult }> {
    const result = await this.renderPhotoCanvas(sourceImageUrl, docType, landmarks, false, 'image/png');
    const paperCanvas = this.renderLayoutCanvas(result.canvas, docType, paper);
    const blob = await this.canvasToBlob(paperCanvas, this.getImageMimeType(format), format === 'jpeg' ? 0.95 : undefined);
    const url = this.replaceLastImageUrl(blob);
    return { url, qualityWarning: result.qualityWarning, result };
  }

  async renderSinglePhotoImage(
    sourceImageUrl: string,
    docType: DocumentType,
    format: ExportImageFormat,
    landmarks: FaceLandmarks | null = null
  ): Promise<{ url: string; qualityWarning: boolean; result: CropResult }> {
    const result = await this.renderPhotoCanvas(sourceImageUrl, docType, landmarks, false, 'image/png');
    const blob = await this.canvasToBlob(result.canvas, this.getImageMimeType(format), format === 'jpeg' ? 0.95 : undefined);
    const url = this.replaceLastImageUrl(blob);
    return { url, qualityWarning: result.qualityWarning, result };
  }

  async renderLayoutPdf(
    sourceImageUrl: string,
    docType: DocumentType,
    paper: PaperSize,
    landmarks: FaceLandmarks | null = null
  ): Promise<void> {
    const photoResult = await this.renderPhotoCanvas(sourceImageUrl, docType, landmarks, false, 'image/png');
    const paperCanvas = this.renderLayoutCanvas(photoResult.canvas, docType, paper);
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

  async getQualityInfo(
    sourceImageUrl: string,
    docType: DocumentType,
    landmarks: FaceLandmarks | null = null
  ): Promise<CropResult> {
    return this.renderPhotoCanvas(sourceImageUrl, docType, landmarks, false, 'image/png');
  }

  formatExportLabel(docType: DocumentType, paper: PaperSize, cols: number, rows: number): string {
    return [
      docType.name,
      `${this.formatMm(docType.widthMm)}x${this.formatMm(docType.heightMm)}mm`,
      `${paper.name} ${this.formatMm(paper.widthMm)}x${this.formatMm(paper.heightMm)}mm ${paper.orientation}`,
      `${cols}x${rows} (${cols * rows})`,
      EXPORT_SITE_URL
    ].join(' · ');
  }

  calculateLayoutGeometry(
    photoWidth: number,
    photoHeight: number,
    paperWidth: number,
    paperHeight: number,
    labelBandHeight = Math.round(4 / 25.4 * PRINT_DPI)
  ): LayoutGeometry {
    const labelGap = Math.round(1 / 25.4 * PRINT_DPI);
    const labelReserve = labelBandHeight + labelGap;
    const cols = Math.floor(paperWidth / photoWidth);
    let rows = Math.floor(Math.max(0, paperHeight - labelReserve) / photoHeight);
    let availableHeight = paperHeight - labelReserve;

    if (rows === 0) {
      rows = Math.floor(paperHeight / photoHeight);
      availableHeight = paperHeight;
    }

    const gridWidth = cols * photoWidth;
    const gridHeight = rows * photoHeight;
    const marginX = Math.round((paperWidth - gridWidth) / 2);
    const marginY = Math.round((availableHeight - gridHeight) / 2);
    const labelY = rows > 0 && paperHeight - (marginY + gridHeight) >= labelReserve
      ? marginY + gridHeight + labelGap
      : null;

    return { cols, rows, marginX, marginY, labelBandHeight, labelY };
  }

  private async renderPhotoCanvas(
    sourceImageUrl: string,
    docType: DocumentType,
    landmarks: FaceLandmarks | null,
    createUrl: boolean,
    mimeType: string,
    quality?: number
  ): Promise<CropResult> {
    const targetW = Math.round(docType.widthMm / 25.4 * PRINT_DPI);
    const targetH = Math.round(docType.heightMm / 25.4 * PRINT_DPI);
    return this.photoCropService.renderDocumentCrop(sourceImageUrl, docType, landmarks, {
      targetWidthPx: targetW,
      targetHeightPx: targetH,
      mimeType,
      quality,
      createUrl,
      fillBackground: docType.backgroundColor ?? this.photoState.selectedBackgroundColor.getValue()
    });
  }

  private renderLayoutCanvas(photoCanvas: HTMLCanvasElement, docType: DocumentType, paper: PaperSize): HTMLCanvasElement {
    const paperW = Math.round(paper.widthMm / 25.4 * PRINT_DPI);
    const paperH = Math.round(paper.heightMm / 25.4 * PRINT_DPI);
    const geometry = this.calculateLayoutGeometry(photoCanvas.width, photoCanvas.height, paperW, paperH);

    const canvas = document.createElement('canvas');
    canvas.width = paperW;
    canvas.height = paperH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paperW, paperH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < geometry.rows; row++) {
      for (let col = 0; col < geometry.cols; col++) {
        ctx.drawImage(
          photoCanvas,
          geometry.marginX + col * photoCanvas.width,
          geometry.marginY + row * photoCanvas.height,
          photoCanvas.width,
          photoCanvas.height
        );
      }
    }

    this.drawExportLabel(ctx, docType, paper, geometry, paperW);

    return canvas;
  }

  private drawExportLabel(
    ctx: CanvasRenderingContext2D,
    docType: DocumentType,
    paper: PaperSize,
    geometry: LayoutGeometry,
    paperWidth: number
  ): void {
    if (geometry.labelY === null || geometry.cols === 0 || geometry.rows === 0) return;

    const paddingX = Math.round(3 / 25.4 * PRINT_DPI);
    const fontSize = Math.max(12, Math.round(2.2 / 25.4 * PRINT_DPI));
    const maxWidth = paperWidth - paddingX * 2;
    if (maxWidth <= 0) return;

    ctx.save();
    ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#555555';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = this.fitText(ctx, this.formatExportLabel(docType, paper, geometry.cols, geometry.rows), maxWidth);
    ctx.fillText(label, paperWidth / 2, geometry.labelY + geometry.labelBandHeight / 2);
    ctx.restore();
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;

    const ellipsis = '...';
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return text.slice(0, low).trimEnd() + ellipsis;
  }

  private formatMm(value: number): string {
    return Number.isInteger(value) ? `${value}` : `${Math.round(value * 10) / 10}`;
  }

  getImageMimeType(format: ExportImageFormat): 'image/jpeg' | 'image/png' {
    return format === 'jpeg' ? 'image/jpeg' : 'image/png';
  }

  private replaceLastImageUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    if (this.lastImageUrl) {
      URL.revokeObjectURL(this.lastImageUrl);
    }
    this.lastImageUrl = url;
    return url;
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Unable to render downloadable image'));
        }
      }, mimeType, quality);
    });
  }
}

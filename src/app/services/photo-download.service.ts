import { Injectable } from '@angular/core';
import { DocumentType, FaceLandmarks, PaperSize } from './photo-state.service';
import { CropResult, PhotoCropService } from './photo-crop.service';

const PRINT_DPI = 300;

@Injectable({ providedIn: 'root' })
export class PhotoDownloadService {
  private lastJpegUrl: string | null = null;

  constructor(private photoCropService: PhotoCropService) {}

  async renderPhotoJpeg(
    sourceImageUrl: string,
    docType: DocumentType,
    landmarks: FaceLandmarks | null = null
  ): Promise<{ url: string; qualityWarning: boolean; result: CropResult }> {
    const result = await this.renderPhotoCanvas(sourceImageUrl, docType, landmarks, true, 'image/jpeg', 0.95);
    if (!result.url) throw new Error('JPEG render did not create a URL');

    if (this.lastJpegUrl) {
      URL.revokeObjectURL(this.lastJpegUrl);
    }
    this.lastJpegUrl = result.url;
    return { url: result.url, qualityWarning: result.qualityWarning, result };
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
      fillBackground: docType.backgroundColor ?? '#ffffff'
    });
  }

  private renderLayoutCanvas(photoCanvas: HTMLCanvasElement, docType: DocumentType, paper: PaperSize): HTMLCanvasElement {
    const cols = Math.floor(paper.widthMm / docType.widthMm);
    const rows = Math.floor(paper.heightMm / docType.heightMm);
    const marginXmm = (paper.widthMm - cols * docType.widthMm) / 2;
    const marginYmm = (paper.heightMm - rows * docType.heightMm) / 2;

    const paperW = Math.round(paper.widthMm / 25.4 * PRINT_DPI);
    const paperH = Math.round(paper.heightMm / 25.4 * PRINT_DPI);
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
        ctx.drawImage(
          photoCanvas,
          marginX + col * photoCanvas.width,
          marginY + row * photoCanvas.height,
          photoCanvas.width,
          photoCanvas.height
        );
      }
    }

    return canvas;
  }
}

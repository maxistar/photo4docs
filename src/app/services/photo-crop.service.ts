import { Injectable } from '@angular/core';
import { CropGuide, DocumentType, FaceLandmarks } from './photo-state.service';

export interface CropWarning {
  type: 'clamped' | 'upscaled';
  message: string;
}

export interface CropRenderOptions {
  targetWidthPx?: number;
  targetHeightPx?: number;
  mimeType?: string;
  quality?: number;
  createUrl?: boolean;
  fillBackground?: string;
}

export interface CropResult {
  url: string | null;
  canvas: HTMLCanvasElement;
  guides: CropGuide[];
  warnings: CropWarning[];
  qualityWarning: boolean;
  sourceSize: { width: number; height: number };
  requiredSize: { width: number; height: number };
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  clamped: boolean;
  ruleAware: boolean;
  scalePxPerMm: number;
}

@Injectable({ providedIn: 'root' })
export class PhotoCropService {
  private lastUrl: string | null = null;

  async cropToAspectRatio(sourceUrl: string, widthMm: number, heightMm: number): Promise<string> {
    const result = await this.renderDocumentCrop(sourceUrl, { id: 'custom', name: 'Custom', widthMm, heightMm });
    if (!result.url) throw new Error('Crop URL was not created');
    return result.url;
  }

  async renderDocumentCrop(
    sourceUrl: string,
    docType: DocumentType,
    landmarks: FaceLandmarks | null = null,
    options: CropRenderOptions = {}
  ): Promise<CropResult> {
    if (options.createUrl !== false && this.lastUrl) {
      URL.revokeObjectURL(this.lastUrl);
      this.lastUrl = null;
    }

    const img = await this.loadImage(sourceUrl);
    const crop = this.calculateCropRect(img.naturalWidth, img.naturalHeight, docType, landmarks);
    const targetW = options.targetWidthPx ?? Math.round(crop.width);
    const targetH = options.targetHeightPx ?? Math.round(crop.height);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d')!;
    if (options.fillBackground) {
      ctx.fillStyle = options.fillBackground;
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, targetW, targetH);

    this.applyDecorations(ctx, docType, targetW, targetH);

    const warnings: CropWarning[] = [];
    if (crop.clamped) {
      warnings.push({
        type: 'clamped',
        message: 'The selected photo does not have enough margin for this document format.'
      });
    }

    const qualityWarning = crop.width < targetW || crop.height < targetH;
    if (qualityWarning) {
      warnings.push({
        type: 'upscaled',
        message: 'The source crop is smaller than the requested output size.'
      });
    }

    const url = options.createUrl === false
      ? null
      : await this.canvasToUrl(canvas, options.mimeType ?? 'image/png', options.quality);
    if (url) this.lastUrl = url;

    return {
      url,
      canvas,
      guides: this.buildGuides(docType, crop, targetW, targetH),
      warnings,
      qualityWarning,
      sourceSize: { width: img.naturalWidth, height: img.naturalHeight },
      requiredSize: { width: targetW, height: targetH }
    };
  }

  calculateCropRect(
    sourceWidth: number,
    sourceHeight: number,
    docType: DocumentType,
    landmarks: FaceLandmarks | null = null
  ): CropRect {
    if (this.hasPlacementRules(docType) && landmarks) {
      return this.calculateRuleAwareCrop(sourceWidth, sourceHeight, docType, landmarks);
    }
    return this.calculateAspectCrop(sourceWidth, sourceHeight, docType);
  }

  hasPlacementRules(docType: DocumentType): boolean {
    return docType.headHeightMinMm !== undefined
      && docType.headHeightMaxMm !== undefined
      && docType.topOffsetMinMm !== undefined
      && docType.topOffsetMaxMm !== undefined;
  }

  private calculateRuleAwareCrop(
    sourceWidth: number,
    sourceHeight: number,
    docType: DocumentType,
    landmarks: FaceLandmarks
  ): CropRect {
    const headHeightMm = this.midpoint(docType.headHeightMinMm!, docType.headHeightMaxMm!);
    const topOffsetMm = this.midpoint(docType.topOffsetMinMm!, docType.topOffsetMaxMm!);
    const head = landmarks.headBox ?? landmarks.faceBox;
    const headCenterX = head.x + head.width / 2;
    const scalePxPerMm = head.height / headHeightMm;

    const requestedW = docType.widthMm * scalePxPerMm;
    const requestedH = docType.heightMm * scalePxPerMm;
    const requestedX = headCenterX - requestedW / 2;
    const requestedY = head.y - topOffsetMm * scalePxPerMm;

    return this.clampCrop(sourceWidth, sourceHeight, requestedX, requestedY, requestedW, requestedH, true, scalePxPerMm);
  }

  private calculateAspectCrop(sourceWidth: number, sourceHeight: number, docType: DocumentType): CropRect {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = docType.widthMm / docType.heightMm;
    let width = sourceWidth;
    let height = sourceHeight;
    let x = 0;
    let y = 0;

    if (sourceRatio > targetRatio) {
      width = sourceHeight * targetRatio;
      x = (sourceWidth - width) / 2;
    } else if (sourceRatio < targetRatio) {
      height = sourceWidth / targetRatio;
      y = (sourceHeight - height) / 2;
    }

    return this.clampCrop(sourceWidth, sourceHeight, x, y, width, height, false, width / docType.widthMm);
  }

  private clampCrop(
    sourceWidth: number,
    sourceHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
    ruleAware: boolean,
    scalePxPerMm: number
  ): CropRect {
    const clampedWidth = Math.min(width, sourceWidth);
    const clampedHeight = Math.min(height, sourceHeight);
    const clampedX = Math.max(0, Math.min(x, sourceWidth - clampedWidth));
    const clampedY = Math.max(0, Math.min(y, sourceHeight - clampedHeight));
    const clamped = Math.abs(clampedX - x) > 0.5
      || Math.abs(clampedY - y) > 0.5
      || Math.abs(clampedWidth - width) > 0.5
      || Math.abs(clampedHeight - height) > 0.5;

    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      clamped,
      ruleAware,
      scalePxPerMm
    };
  }

  private buildGuides(docType: DocumentType, crop: CropRect, targetW: number, targetH: number): CropGuide[] {
    if (!crop.ruleAware) return [];

    const xScale = targetW / crop.width;
    const yScale = targetH / crop.height;
    const yForMm = (mm: number) => mm * crop.scalePxPerMm * yScale;
    const xForMm = (mm: number) => mm * crop.scalePxPerMm * xScale;
    const guides: CropGuide[] = [];

    if (docType.topOffsetMinMm !== undefined && docType.topOffsetMaxMm !== undefined) {
      const y = yForMm(this.midpoint(docType.topOffsetMinMm, docType.topOffsetMaxMm));
      guides.push({ x1: 0, y1: y, x2: targetW, y2: y, label: 'Top offset', orientation: 'horizontal' });
    }

    if (docType.headHeightMinMm !== undefined && docType.headHeightMaxMm !== undefined) {
      const top = yForMm(this.midpoint(docType.topOffsetMinMm ?? 0, docType.topOffsetMaxMm ?? 0));
      const bottom = top + yForMm(this.midpoint(docType.headHeightMinMm, docType.headHeightMaxMm));
      guides.push({ x1: 0, y1: bottom, x2: targetW, y2: bottom, label: 'Head height', orientation: 'horizontal' });
    }

    if (docType.headWidthMinMm !== undefined && docType.headWidthMaxMm !== undefined) {
      const width = xForMm(this.midpoint(docType.headWidthMinMm, docType.headWidthMaxMm));
      const center = targetW / 2;
      guides.push({ x1: center - width / 2, y1: 0, x2: center + width / 2, y2: targetH, label: 'Head width', orientation: 'box' });
    }

    if (docType.eyesLineMinMm !== undefined && docType.eyesLineMaxMm !== undefined) {
      const headBottom = yForMm(
        this.midpoint(docType.topOffsetMinMm ?? 0, docType.topOffsetMaxMm ?? 0)
        + this.midpoint(docType.headHeightMinMm ?? docType.heightMm * 0.66, docType.headHeightMaxMm ?? docType.heightMm * 0.66)
      );
      const y = headBottom - yForMm(this.midpoint(docType.eyesLineMinMm, docType.eyesLineMaxMm));
      guides.push({ x1: 0, y1: y, x2: targetW, y2: y, label: 'Eye line', orientation: 'horizontal' });
    }

    return guides;
  }

  private applyDecorations(ctx: CanvasRenderingContext2D, docType: DocumentType, width: number, height: number): void {
    if (docType.colorMode === 'bw') {
      const image = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < image.data.length; i += 4) {
        const gray = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114);
        image.data[i] = gray;
        image.data[i + 1] = gray;
        image.data[i + 2] = gray;
      }
      ctx.putImageData(image, 0, 0);
    }

    const cornerColor = docType.backgroundColor ?? '#ffffff';
    if (docType.decoration === 'rightcorner') {
      ctx.fillStyle = cornerColor;
      ctx.beginPath();
      ctx.moveTo(width, height * 0.6);
      ctx.lineTo(width, height);
      ctx.lineTo(width * 0.5, height);
      ctx.closePath();
      ctx.fill();
    } else if (docType.decoration === 'leftcorner') {
      ctx.fillStyle = cornerColor;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.7);
      ctx.lineTo(width * 0.5, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }
  }

  private midpoint(min: number, max: number): number {
    return (min + max) / 2;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for cropping'));
      img.src = url;
    });
  }

  private canvasToUrl(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas to blob failed')); return; }
        resolve(URL.createObjectURL(blob));
      }, mimeType, quality);
    });
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrintLayoutService {
  private lastUrl: string | null = null;

  async generateLayoutPreview(
    croppedUrl: string,
    photoWidthMm: number,
    photoHeightMm: number,
    paperWidthMm: number,
    paperHeightMm: number
  ): Promise<{ url: string; cols: number; rows: number }> {
    const cols = Math.floor(paperWidthMm / photoWidthMm);
    const rows = Math.floor(paperHeightMm / photoHeightMm);

    if (cols === 0 || rows === 0) {
      return { url: '', cols: 0, rows: 0 };
    }

    const scale = 360 / paperWidthMm;
    const canvasW = Math.round(paperWidthMm * scale);
    const canvasH = Math.round(paperHeightMm * scale);
    const slotW = Math.round(photoWidthMm * scale);
    const slotH = Math.round(photoHeightMm * scale);
    const marginX = Math.round((canvasW - cols * slotW) / 2);
    const marginY = Math.round((canvasH - rows * slotH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = await this.loadImage(croppedUrl);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.drawImage(img, marginX + col * slotW, marginY + row * slotH, slotW, slotH);
      }
    }

    const url = await new Promise<string>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob failed')); return; }
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    });

    if (this.lastUrl) {
      URL.revokeObjectURL(this.lastUrl);
    }
    this.lastUrl = url;
    return { url, cols, rows };
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

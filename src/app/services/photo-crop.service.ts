import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PhotoCropService {
  private lastUrl: string | null = null;

  async cropToAspectRatio(sourceUrl: string, widthMm: number, heightMm: number): Promise<string> {
    // Revoke previous object URL to prevent memory leaks
    if (this.lastUrl) {
      URL.revokeObjectURL(this.lastUrl);
      this.lastUrl = null;
    }

    const img = await this.loadImage(sourceUrl);
    const side = img.naturalWidth; // processedImage is always square

    let srcX: number, srcY: number, srcW: number, srcH: number;
    let outW: number, outH: number;

    if (widthMm === heightMm) {
      // Square — no crop needed
      srcX = 0; srcY = 0; srcW = side; srcH = side;
      outW = side; outH = side;
    } else if (widthMm < heightMm) {
      // Portrait: full height, reduced width centred horizontally
      srcH = side;
      srcW = Math.round(side * (widthMm / heightMm));
      srcX = Math.round((side - srcW) / 2);
      srcY = 0;
      outW = srcW; outH = srcH;
    } else {
      // Landscape: full width, reduced height centred vertically
      srcW = side;
      srcH = Math.round(side * (heightMm / widthMm));
      srcX = 0;
      srcY = Math.round((side - srcH) / 2);
      outW = srcW; outH = srcH;
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    const url = await this.canvasToUrl(canvas);
    this.lastUrl = url;
    return url;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for cropping'));
      img.src = url;
    });
  }

  private canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas to blob failed')); return; }
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    });
  }
}

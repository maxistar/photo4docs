import { Injectable, NgZone } from '@angular/core';
import * as faceapi from 'face-api.js';
import { removeBackground } from '@imgly/background-removal';
import { EyeCoordinates, FaceLandmarks, ImageBox, PhotoStateService, PointCoordinates } from './photo-state.service';

interface AlignmentResult {
  canvas: HTMLCanvasElement;
  angle: number;
  origWidth: number;
  origHeight: number;
}


@Injectable({ providedIn: 'root' })
export class ImagePreprocessingService {
  private modelsLoaded = false;
  private modelsLoadingPromise: Promise<void> | null = null;

  constructor(private photoState: PhotoStateService, private ngZone: NgZone) {}

  // --- Model loading ---

  private loadModels(): Promise<void> {
    if (this.modelsLoaded) return Promise.resolve();
    if (this.modelsLoadingPromise) return this.modelsLoadingPromise;

    this.modelsLoadingPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('/assets/models'),
    ]).then(() => {
      this.modelsLoaded = true;
      this.modelsLoadingPromise = null;
    });

    return this.modelsLoadingPromise;
  }

  // --- Face detection ---

  private async detectFace(img: HTMLImageElement): Promise<FaceLandmarks> {
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks(true);

    if (detections.length === 0) {
      throw new Error('No face detected. Please use a clear front-facing photo.');
    }

    const largest = detections.reduce((best, d) =>
      d.detection.box.area > best.detection.box.area ? d : best
    );

    const box = largest.detection.box;
    const pts = largest.landmarks.positions;
    const eyeBox = (indices: number[]) => {
      const eyePoints = indices.map(index => pts[index]);
      return {
        x1: Math.min(...eyePoints.map(point => point.x)),
        y1: Math.min(...eyePoints.map(point => point.y)),
        x2: Math.max(...eyePoints.map(point => point.x)),
        y2: Math.max(...eyePoints.map(point => point.y)),
      };
    };

    return {
      faceBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      chin: { x: pts[8].x, y: pts[8].y },
      browCenter: { x: (pts[19].x + pts[24].x) / 2, y: (pts[19].y + pts[24].y) / 2 },
      leftEye: eyeBox([36, 37, 38, 39, 40, 41]),
      rightEye: eyeBox([42, 43, 44, 45, 46, 47]),
      faceCount: detections.length,
    };
  }

  // --- Background removal ---

  private async removeBg(file: File): Promise<string> {
    const blob = await removeBackground(file);
    return URL.createObjectURL(blob);
  }

  // --- Canvas helpers ---

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load processed image'));
      img.src = url;
    });
  }

  private imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas;
  }

  private canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas serialisation failed')); return; }
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    });
  }

  // --- Face alignment (rotation) ---

  private alignFace(canvas: HTMLCanvasElement, landmarks: FaceLandmarks): AlignmentResult {
    const leftCx = (landmarks.leftEye.x1 + landmarks.leftEye.x2) / 2;
    const leftCy = (landmarks.leftEye.y1 + landmarks.leftEye.y2) / 2;
    const rightCx = (landmarks.rightEye.x1 + landmarks.rightEye.x2) / 2;
    const rightCy = (landmarks.rightEye.y1 + landmarks.rightEye.y2) / 2;

    const angle = Math.atan2(rightCy - leftCy, rightCx - leftCx);
    const w = canvas.width;
    const h = canvas.height;

    if (Math.abs(angle) < 0.5 * Math.PI / 180) {
      return { canvas, angle: 0, origWidth: w, origHeight: h };
    }

    const diagonal = Math.ceil(Math.sqrt(w * w + h * h));
    const rotated = document.createElement('canvas');
    rotated.width = diagonal;
    rotated.height = diagonal;

    const ctx = rotated.getContext('2d')!;
    ctx.translate(diagonal / 2, diagonal / 2);
    ctx.rotate(-angle);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(canvas, 0, 0);

    return { canvas: rotated, angle, origWidth: w, origHeight: h };
  }

  private transformLandmarks(landmarks: FaceLandmarks, alignment: AlignmentResult): FaceLandmarks {
    if (alignment.angle === 0) {
      return {
        ...landmarks,
        faceBox: { ...landmarks.faceBox },
        headBox: landmarks.headBox ? { ...landmarks.headBox } : undefined,
        chin: landmarks.chin ? { ...landmarks.chin } : undefined,
        browCenter: landmarks.browCenter ? { ...landmarks.browCenter } : undefined,
        leftEye: { ...landmarks.leftEye },
        rightEye: { ...landmarks.rightEye }
      };
    }

    const face = landmarks.faceBox;
    const corners = [
      { x: face.x, y: face.y },
      { x: face.x + face.width, y: face.y },
      { x: face.x, y: face.y + face.height },
      { x: face.x + face.width, y: face.y + face.height },
    ].map(point => this.transformPoint(point, alignment));

    const minX = Math.min(...corners.map(point => point.x));
    const minY = Math.min(...corners.map(point => point.y));
    const maxX = Math.max(...corners.map(point => point.x));
    const maxY = Math.max(...corners.map(point => point.y));

    return {
      faceBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      chin: landmarks.chin ? this.transformPoint(landmarks.chin, alignment) : undefined,
      browCenter: landmarks.browCenter ? this.transformPoint(landmarks.browCenter, alignment) : undefined,
      leftEye: this.transformEye(landmarks.leftEye, alignment),
      rightEye: this.transformEye(landmarks.rightEye, alignment),
      faceCount: landmarks.faceCount,
    };
  }

  private transformEye(eye: EyeCoordinates, alignment: AlignmentResult): EyeCoordinates {
    const p1 = this.transformPoint({ x: eye.x1, y: eye.y1 }, alignment);
    const p2 = this.transformPoint({ x: eye.x2, y: eye.y2 }, alignment);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }

  private transformPoint(point: PointCoordinates, alignment: AlignmentResult): PointCoordinates {
    const dx = point.x - alignment.origWidth / 2;
    const dy = point.y - alignment.origHeight / 2;
    const cos = Math.cos(-alignment.angle);
    const sin = Math.sin(-alignment.angle);
    return {
      x: dx * cos - dy * sin + alignment.canvas.width / 2,
      y: dx * sin + dy * cos + alignment.canvas.height / 2,
    };
  }


  private estimateHeadBox(canvas: HTMLCanvasElement, landmarks: FaceLandmarks): FaceLandmarks {
    const face = landmarks.faceBox;
    const chin = landmarks.chin ?? { x: face.x + face.width / 2, y: face.y + face.height };
    const centerX = face.x + face.width / 2;
    const bandHalfWidth = Math.max(face.width * 0.8, 40);
    const scanLeft = Math.max(0, Math.floor(centerX - bandHalfWidth));
    const scanRight = Math.min(canvas.width, Math.ceil(centerX + bandHalfWidth));
    const scanTop = 0;
    const scanBottom = Math.max(1, Math.min(canvas.height, Math.ceil(chin.y)));
    const scanWidth = Math.max(1, scanRight - scanLeft);
    const scanHeight = Math.max(1, scanBottom - scanTop);
    const ctx = canvas.getContext('2d');

    let headTop = this.estimateHeadTopFromLandmarks(landmarks);
    let minPersonX = face.x;
    let maxPersonX = face.x + face.width;

    if (ctx) {
      const data = ctx.getImageData(scanLeft, scanTop, scanWidth, scanHeight).data;
      const rowThreshold = Math.max(3, Math.floor(scanWidth * 0.02));
      let foundTop: number | null = null;
      let foundMinX = scanRight;
      let foundMaxX = scanLeft;

      for (let y = 0; y < scanHeight; y++) {
        let rowAlphaCount = 0;
        for (let x = 0; x < scanWidth; x++) {
          const alpha = data[(y * scanWidth + x) * 4 + 3];
          if (alpha > 12) {
            rowAlphaCount++;
            foundMinX = Math.min(foundMinX, scanLeft + x);
            foundMaxX = Math.max(foundMaxX, scanLeft + x);
          }
        }
        if (foundTop === null && rowAlphaCount >= rowThreshold) {
          foundTop = scanTop + y;
        }
      }

      if (foundTop !== null && foundTop < chin.y) {
        headTop = foundTop;
        minPersonX = Math.min(foundMinX, face.x);
        maxPersonX = Math.max(foundMaxX, face.x + face.width);
      }
    }

    headTop = Math.max(0, Math.min(headTop, chin.y - 1));
    const headHeight = Math.max(1, chin.y - headTop);
    const headWidth = Math.max(face.width, maxPersonX - minPersonX);
    const headBox: ImageBox = {
      x: centerX - headWidth / 2,
      y: headTop,
      width: headWidth,
      height: headHeight,
    };

    return { ...landmarks, headBox };
  }

  private estimateHeadTopFromLandmarks(landmarks: FaceLandmarks): number {
    const face = landmarks.faceBox;
    const chin = landmarks.chin ?? { x: face.x + face.width / 2, y: face.y + face.height };
    const brow = landmarks.browCenter ?? { x: face.x + face.width / 2, y: face.y + face.height * 0.28 };
    return chin.y - (chin.y - brow.y) * 1.45;
  }

  // --- Face crop ---

  private cropToFace(canvas: HTMLCanvasElement, landmarks: FaceLandmarks): HTMLCanvasElement {
    const head = landmarks.headBox ?? landmarks.faceBox;
    const faceCx = head.x + head.width / 2;
    const faceCy = head.y + head.height / 2;
    const side = Math.max(Math.round(head.height * 1.45), 400);

    let cropX = Math.round(faceCx - side / 2);
    let cropY = Math.round(faceCy - side / 2);
    cropX = Math.max(0, Math.min(cropX, canvas.width - side));
    cropY = Math.max(0, Math.min(cropY, canvas.height - side));

    const srcW = Math.min(side, canvas.width);
    const srcH = Math.min(side, canvas.height);
    const output = document.createElement('canvas');
    output.width = side;
    output.height = side;

    const ctx = output.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, cropX, cropY, srcW, srcH, 0, 0, side, side);

    return output;
  }

  // --- Main pipeline ---

  async preprocess(file: File, imgElement: HTMLImageElement): Promise<void> {
    this.ngZone.run(() => {
      this.photoState.preprocessingStatus.next('running');
      this.photoState.preprocessingError.next(null);
      this.photoState.faceLandmarks.next(null);
      this.photoState.alignedFaceLandmarks.next(null);
      this.photoState.setAlignedImage(null);
      this.photoState.setProcessedImage(null);
    });

    let landmarks: FaceLandmarks | null = null;
    let alignedLandmarks: FaceLandmarks | null = null;
    let alignedUrl: string | null = null;
    let finalUrl: string | null = null;
    let bgUrl: string | null = null;
    let errorMessage: string | null = null;

    await this.ngZone.runOutsideAngular(async () => {
      try {
        await this.loadModels();

        [landmarks, bgUrl] = await Promise.all([
          this.detectFace(imgElement),
          this.removeBg(file),
        ]);

        const bgImg = await this.loadImage(bgUrl);
        const bgCanvas = this.imageToCanvas(bgImg);
        const alignment = this.alignFace(bgCanvas, landmarks);
        alignedLandmarks = this.estimateHeadBox(alignment.canvas, this.transformLandmarks(landmarks, alignment));
        alignedUrl = await this.canvasToUrl(alignment.canvas);

        const croppedCanvas = this.cropToFace(alignment.canvas, alignedLandmarks);
        finalUrl = await this.canvasToUrl(croppedCanvas);
      } catch (err: any) {
        errorMessage = err?.message ?? 'Preprocessing failed. Please try a different photo.';
      } finally {
        if (bgUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(bgUrl);
        }
      }
    });

    this.ngZone.run(() => {
      if (errorMessage || !landmarks || !alignedLandmarks || !alignedUrl || !finalUrl) {
        if (alignedUrl?.startsWith('blob:')) URL.revokeObjectURL(alignedUrl);
        if (finalUrl?.startsWith('blob:')) URL.revokeObjectURL(finalUrl);
        this.photoState.preprocessingError.next(errorMessage ?? 'Unknown error');
        this.photoState.preprocessingStatus.next('error');
      } else {
        this.photoState.faceLandmarks.next(landmarks);
        this.photoState.alignedFaceLandmarks.next(alignedLandmarks);
        this.photoState.setAlignedImage(alignedUrl);
        this.photoState.setProcessedImage(finalUrl);
        this.photoState.preprocessingStatus.next('done');
      }
    });
  }
}

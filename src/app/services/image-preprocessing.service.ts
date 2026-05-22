import { Injectable, NgZone } from '@angular/core';
import * as faceapi from 'face-api.js';
import { removeBackground } from '@imgly/background-removal';
import { PhotoStateService, FaceLandmarks } from './photo-state.service';

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

    // 68-point model: left eye outer=36, inner=39; right eye inner=42, outer=45
    return {
      faceBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      leftEye: { x1: pts[36].x, y1: pts[36].y, x2: pts[39].x, y2: pts[39].y },
      rightEye: { x1: pts[42].x, y1: pts[42].y, x2: pts[45].x, y2: pts[45].y },
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

  // Rotates `canvas` so the eye line is horizontal.
  // Returns the rotated canvas (diagonal×diagonal) and the angle used.
  private alignFace(
    canvas: HTMLCanvasElement,
    landmarks: FaceLandmarks
  ): { canvas: HTMLCanvasElement; angle: number } {
    // Eye centres as midpoints of corner coordinates
    const leftCx = (landmarks.leftEye.x1 + landmarks.leftEye.x2) / 2;
    const leftCy = (landmarks.leftEye.y1 + landmarks.leftEye.y2) / 2;
    const rightCx = (landmarks.rightEye.x1 + landmarks.rightEye.x2) / 2;
    const rightCy = (landmarks.rightEye.y1 + landmarks.rightEye.y2) / 2;

    const angle = Math.atan2(rightCy - leftCy, rightCx - leftCx);

    // Skip rotation if already level within 0.5°
    if (Math.abs(angle) < 0.5 * Math.PI / 180) {
      return { canvas, angle: 0 };
    }

    const w = canvas.width;
    const h = canvas.height;
    // Diagonal is the minimum canvas size that fits the entire rotated image
    const diagonal = Math.ceil(Math.sqrt(w * w + h * h));

    const rotated = document.createElement('canvas');
    rotated.width = diagonal;
    rotated.height = diagonal;

    const ctx = rotated.getContext('2d')!;
    // Rotate around canvas centre; preserve alpha (default transparent background)
    ctx.translate(diagonal / 2, diagonal / 2);
    ctx.rotate(-angle);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(canvas, 0, 0);

    return { canvas: rotated, angle };
  }

  // --- Face crop ---

  // Crops `canvas` to a square centred on the face so face height ≈ 50% of output.
  // `angle` and `origWidth/origHeight` are used to map the face centre from original
  // image space into the (potentially rotated) canvas space.
  private cropToFace(
    canvas: HTMLCanvasElement,
    landmarks: FaceLandmarks,
    angle: number,
    origWidth: number,
    origHeight: number
  ): HTMLCanvasElement {
    // Face centre in original image space
    const origCx = landmarks.faceBox.x + landmarks.faceBox.width / 2;
    const origCy = landmarks.faceBox.y + landmarks.faceBox.height / 2;

    // Map to rotated canvas space
    let faceCx: number;
    let faceCy: number;

    if (angle === 0) {
      faceCx = origCx;
      faceCy = origCy;
    } else {
      // The rotated canvas is diagonal×diagonal, original image centred at (diagonal/2, diagonal/2).
      // A point (px, py) in original space maps to canvas space by:
      //   rotate( (px - origW/2, py - origH/2), -angle ) + (diagonal/2, diagonal/2)
      const diagonal = canvas.width; // canvas is square after alignFace
      const dx = origCx - origWidth / 2;
      const dy = origCy - origHeight / 2;
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      faceCx = dx * cos - dy * sin + diagonal / 2;
      faceCy = dx * sin + dy * cos + diagonal / 2;
    }

    // Output side: face height × 2 so face is 50% of output height; minimum 400 px
    const side = Math.max(Math.round(landmarks.faceBox.height * 2), 400);

    // Top-left of crop rect, clamped so it stays within canvas bounds
    let cropX = Math.round(faceCx - side / 2);
    let cropY = Math.round(faceCy - side / 2);
    cropX = Math.max(0, Math.min(cropX, canvas.width - side));
    cropY = Math.max(0, Math.min(cropY, canvas.height - side));

    // Source dimensions clamped in case canvas is smaller than the desired side
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
      this.photoState.processedImage.next(null);
    });

    let landmarks: FaceLandmarks | null = null;
    let finalUrl: string | null = null;
    let errorMessage: string | null = null;

    await this.ngZone.runOutsideAngular(async () => {
      try {
        await this.loadModels();

        // Stage 1: face detection + background removal (concurrent)
        let bgUrl: string;
        [landmarks, bgUrl] = await Promise.all([
          this.detectFace(imgElement),
          this.removeBg(file),
        ]);

        // Stage 2: load background-removed result into a canvas
        const bgImg = await this.loadImage(bgUrl);
        const bgCanvas = this.imageToCanvas(bgImg);

        // Stage 3: rotate so eyes are level
        const { canvas: alignedCanvas, angle } = this.alignFace(bgCanvas, landmarks);

        // Stage 4: crop so face height is ~50% of output
        const croppedCanvas = this.cropToFace(
          alignedCanvas, landmarks, angle, bgCanvas.width, bgCanvas.height
        );

        // Stage 5: serialise to object URL for display
        finalUrl = await this.canvasToUrl(croppedCanvas);
      } catch (err: any) {
        errorMessage = err?.message ?? 'Preprocessing failed. Please try a different photo.';
      }
    });

    this.ngZone.run(() => {
      if (errorMessage || !landmarks || !finalUrl) {
        this.photoState.preprocessingError.next(errorMessage ?? 'Unknown error');
        this.photoState.preprocessingStatus.next('error');
      } else {
        this.photoState.faceLandmarks.next(landmarks);
        this.photoState.processedImage.next(finalUrl);
        this.photoState.preprocessingStatus.next('done');
      }
    });
  }
}

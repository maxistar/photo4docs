// src/app/services/photo-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DOCUMENT_TYPES } from './document-types';

export type PreprocessingStatus = 'idle' | 'running' | 'done' | 'error';
export type SubStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface EyeCoordinates {
  x1: number; y1: number; x2: number; y2: number;
}

export interface PointCoordinates {
  x: number;
  y: number;
}

export interface ImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  faceBox: ImageBox;
  headBox?: ImageBox;
  chin?: PointCoordinates;
  browCenter?: PointCoordinates;
  leftEye: EyeCoordinates;
  rightEye: EyeCoordinates;
  faceCount: number;
}

export interface CropGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  orientation: 'horizontal' | 'vertical' | 'box';
}

export interface DocumentType {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description?: string;
  topOffsetMinMm?: number;
  topOffsetMaxMm?: number;
  headHeightMinMm?: number;
  headHeightMaxMm?: number;
  headWidthMinMm?: number;
  headWidthMaxMm?: number;
  eyesLineMinMm?: number;
  eyesLineMaxMm?: number;
  colorMode?: 'color' | 'bw' | 'any';
  paperType?: 'glossy' | 'matte' | 'any';
  backgroundColor?: string;
  decoration?: 'leftcorner' | 'rightcorner' | 'blurredoval';
}

export interface PaperSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
}

export type OutputFormat = 'jpg' | 'png' | 'pdf';

@Injectable({
  providedIn: 'root',
})
export class PhotoStateService {
  // --- Configuration Data ---
  readonly DPI = 300; // Dots Per Inch - Standard for printing

  readonly documentTypes: DocumentType[] = DOCUMENT_TYPES;

  readonly paperSizes: PaperSize[] = [
    { id: 'photo_9x13', name: 'Photo 9x13 cm', widthMm: 127, heightMm: 89, orientation: 'landscape' },
    { id: 'photo_10x15', name: 'Photo 10x15 cm', widthMm: 152, heightMm: 102, orientation: 'landscape' },
    { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    { id: 'letter', name: 'Letter', widthMm: 215.9, heightMm: 279.4, orientation: 'portrait' },
  ];

  readonly outputFormats: OutputFormat[] = ['jpg', 'png', 'pdf'];

  // --- Wizard State ---
  originalImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  croppedPhotoDataUrl: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  selectedDocumentType: BehaviorSubject<DocumentType | null> = new BehaviorSubject<DocumentType | null>(null);
  selectedPaperSize: BehaviorSubject<PaperSize | null> = new BehaviorSubject<PaperSize | null>(null);
  selectedOutputFormat: BehaviorSubject<OutputFormat> = new BehaviorSubject<OutputFormat>('jpg');

  // --- Preprocessing State ---
  preprocessingStatus: BehaviorSubject<PreprocessingStatus> = new BehaviorSubject<PreprocessingStatus>('idle');
  preprocessingError: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  faceDetectionStatus: BehaviorSubject<SubStepStatus> = new BehaviorSubject<SubStepStatus>('idle');
  bgRemovalStatus: BehaviorSubject<SubStepStatus> = new BehaviorSubject<SubStepStatus>('idle');
  faceLandmarks: BehaviorSubject<FaceLandmarks | null> = new BehaviorSubject<FaceLandmarks | null>(null);
  alignedFaceLandmarks: BehaviorSubject<FaceLandmarks | null> = new BehaviorSubject<FaceLandmarks | null>(null);
  alignedImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  alignedOriginalImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  processedImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  processedOriginalImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  alignmentAngle: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  useOriginalBackground: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  removeBackgroundEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  selectedBackgroundColor: BehaviorSubject<string> = new BehaviorSubject<string>('#ffffff');
  layoutPreviewUrl: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor() {}

  // --- Helper Functions ---
  mmToPixels(mm: number): number {
    return Math.round((mm / 25.4) * this.DPI);
  }

  pixelsToMm(px: number): number {
    return (px / this.DPI) * 25.4;
  }

  getDocumentPixelDimensions(docType: DocumentType): { width: number; height: number } {
    return {
      width: this.mmToPixels(docType.widthMm),
      height: this.mmToPixels(docType.heightMm)
    };
  }

  getPaperPixelDimensions(paperSize: PaperSize): { width: number; height: number } {
    return {
      width: this.mmToPixels(paperSize.widthMm),
      height: this.mmToPixels(paperSize.heightMm)
    };
  }

  setAlignedImage(url: string | null): void {
    this.replaceObjectUrl(this.alignedImage, url);
  }

  setAlignedOriginalImage(url: string | null): void {
    this.replaceObjectUrl(this.alignedOriginalImage, url);
  }

  setProcessedImage(url: string | null): void {
    this.replaceObjectUrl(this.processedImage, url);
  }

  setProcessedOriginalImage(url: string | null): void {
    this.replaceObjectUrl(this.processedOriginalImage, url);
  }

  getActiveAlignedImage(): string | null {
    return this.useOriginalBackground.getValue()
      ? this.alignedOriginalImage.getValue()
      : this.alignedImage.getValue();
  }

  getActiveProcessedImage(): string | null {
    return this.useOriginalBackground.getValue()
      ? this.processedOriginalImage.getValue()
      : this.processedImage.getValue();
  }

  setCroppedPhotoDataUrl(url: string | null): void {
    this.replaceObjectUrl(this.croppedPhotoDataUrl, url);
  }

  setLayoutPreviewUrl(url: string | null): void {
    this.replaceObjectUrl(this.layoutPreviewUrl, url);
  }

  resetState() {
    this.originalImage.next(null);
    this.setCroppedPhotoDataUrl(null);
    this.selectedDocumentType.next(null);
    this.selectedPaperSize.next(null);
    this.selectedOutputFormat.next('jpg');
    this.preprocessingStatus.next('idle');
    this.preprocessingError.next(null);
    this.faceDetectionStatus.next('idle');
    this.bgRemovalStatus.next('idle');
    this.faceLandmarks.next(null);
    this.alignedFaceLandmarks.next(null);
    this.setAlignedImage(null);
    this.setAlignedOriginalImage(null);
    this.setProcessedImage(null);
    this.setProcessedOriginalImage(null);
    this.alignmentAngle.next(0);
    this.useOriginalBackground.next(false);
    this.removeBackgroundEnabled.next(true);
    this.selectedBackgroundColor.next('#ffffff');
    this.setLayoutPreviewUrl(null);
  }

  private replaceObjectUrl(subject: BehaviorSubject<string | null>, nextUrl: string | null): void {
    const previous = subject.getValue();
    if (previous && previous !== nextUrl && previous.startsWith('blob:')) {
      URL.revokeObjectURL(previous);
    }
    subject.next(nextUrl);
  }
}

// src/app/services/photo-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PreprocessingStatus = 'idle' | 'running' | 'done' | 'error';

export interface EyeCoordinates {
  x1: number; y1: number; x2: number; y2: number;
}

export interface FaceLandmarks {
  faceBox: { x: number; y: number; width: number; height: number };
  leftEye: EyeCoordinates;
  rightEye: EyeCoordinates;
  faceCount: number;
}

export interface DocumentType {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  // Add specific rules like head height percentage, eye line if needed for validation/guides
  description?: string;
  headHeightPercentMin?: number; // Example: 70
  headHeightPercentMax?: number; // Example: 80
  eyeLineFromTopPercent?: number; // Example: 50-60 (might need min/max)
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

  readonly documentTypes: DocumentType[] = [
    { id: 'passport_eu', name: 'Passport/Schengen Visa (EU Standard)', widthMm: 35, heightMm: 45 },
    { id: 'visa_usa', name: 'USA Visa', widthMm: 51, heightMm: 51 }, // Often 2x2 inches
    { id: 'passport_india', name: 'Indian Passport', widthMm: 51, heightMm: 51 },
    // Add more types
  ];

  readonly paperSizes: PaperSize[] = [
    { id: 'photo_9x13', name: 'Photo 9x13 cm', widthMm: 127, heightMm: 89, orientation: 'landscape' }, // Approx 5x3.5 inches
    { id: 'photo_10x15', name: 'Photo 10x15 cm', widthMm: 152, heightMm: 102, orientation: 'landscape' }, // Approx 6x4 inches
    { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    { id: 'letter', name: 'Letter', widthMm: 215.9, heightMm: 279.4, orientation: 'portrait' }, // 8.5x11 inches
    // Add more sizes
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
  faceLandmarks: BehaviorSubject<FaceLandmarks | null> = new BehaviorSubject<FaceLandmarks | null>(null);
  processedImage: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
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

  resetState() {
    this.originalImage.next(null);
    this.croppedPhotoDataUrl.next(null);
    this.selectedDocumentType.next(null);
    this.selectedPaperSize.next(null);
    this.selectedOutputFormat.next('jpg');
    this.preprocessingStatus.next('idle');
    this.preprocessingError.next(null);
    this.faceLandmarks.next(null);
    this.processedImage.next(null);
    this.layoutPreviewUrl.next(null);
  }
}
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CropGuide, DocumentType, FaceLandmarks, PhotoStateService } from '../../services/photo-state.service';
import { CropResult, PhotoCropService } from '../../services/photo-crop.service';

@Component({
  selector: 'app-step2-document-type',
  templateUrl: './step2-document-type.component.html',
  styleUrls: ['./step2-document-type.component.css'],
})
export class Step2DocumentTypeComponent implements OnInit {
  documentTypes: DocumentType[] = [];
  selectedDocumentType: DocumentType | null = null;
  previewUrl: string | null = null;
  previewLoading = false;
  cropWarning: string | null = null;
  guides: CropGuide[] = [];

  @ViewChild('previewImg') previewImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('guideCanvas') guideCanvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(
    public photoState: PhotoStateService,
    private photoCropService: PhotoCropService
  ) {}

  ngOnInit(): void {
    this.documentTypes = this.photoState.documentTypes;
    if (this.documentTypes.length > 0) {
      this.applyDocumentType(this.documentTypes[0]);
    }
  }

  onDocumentTypeChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const doc = this.documentTypes.find(d => d.id === id) || null;
    if (doc) this.applyDocumentType(doc);
  }

  onPreviewLoaded(): void {
    this.drawGuides();
  }

  formatColorMode(doc: DocumentType): string {
    if (!doc.colorMode || doc.colorMode === 'any') return 'Any';
    return doc.colorMode === 'bw' ? 'Black and white' : 'Color';
  }

  formatPaperType(doc: DocumentType): string {
    if (!doc.paperType || doc.paperType === 'any') return 'Any';
    return doc.paperType === 'matte' ? 'Matte' : 'Glossy';
  }

  hasRuleMetadata(doc: DocumentType): boolean {
    return this.photoCropService.hasPlacementRules(doc)
      || doc.headWidthMinMm !== undefined
      || doc.eyesLineMinMm !== undefined;
  }

  private async applyDocumentType(doc: DocumentType): Promise<void> {
    this.selectedDocumentType = doc;
    this.photoState.selectedDocumentType.next(doc);
    this.cropWarning = null;
    this.guides = [];

    const source = this.getCropSource(doc);
    if (!source.url) return;

    this.previewLoading = true;
    try {
      const result = await this.photoCropService.renderDocumentCrop(source.url, doc, source.landmarks);
      this.applyCropResult(result);
    } finally {
      this.previewLoading = false;
    }
  }

  private getCropSource(doc: DocumentType): { url: string | null; landmarks: FaceLandmarks | null } {
    const alignedLandmarks = this.photoState.alignedFaceLandmarks.getValue();
    if (alignedLandmarks && this.photoCropService.hasPlacementRules(doc)) {
      return { url: this.photoState.getActiveAlignedImage(), landmarks: alignedLandmarks };
    }
    return { url: this.photoState.getActiveProcessedImage(), landmarks: null };
  }

  private applyCropResult(result: CropResult): void {
    this.previewUrl = result.url;
    this.guides = result.guides;
    this.cropWarning = result.warnings.find(warning => warning.type === 'clamped')?.message ?? null;
    this.photoState.setCroppedPhotoDataUrl(result.url);
    setTimeout(() => this.drawGuides(), 0);
  }

  private drawGuides(): void {
    const img = this.previewImgRef?.nativeElement;
    const canvas = this.guideCanvasRef?.nativeElement;
    if (!img || !canvas || !img.naturalWidth) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    ctx.lineWidth = 1.5;
    ctx.font = '11px Arial, sans-serif';
    for (const guide of this.guides) {
      const x1 = guide.x1 * scaleX;
      const y1 = guide.y1 * scaleY;
      const x2 = guide.x2 * scaleX;
      const y2 = guide.y2 * scaleY;
      ctx.strokeStyle = guide.label === 'Eye line' ? '#1b8a5a' : '#1a73e8';
      ctx.fillStyle = ctx.strokeStyle;

      if (guide.orientation === 'box') {
        ctx.strokeRect(x1, 0, x2 - x1, canvas.height);
        ctx.fillText(guide.label, Math.max(4, x1 + 4), 14);
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillText(guide.label, 4, Math.max(12, y1 - 4));
      }
    }
  }
}

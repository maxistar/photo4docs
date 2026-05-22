import { Component, OnInit } from '@angular/core';
import { PhotoStateService, DocumentType, FaceLandmarks, PaperSize } from '../../services/photo-state.service';
import { PhotoDownloadService } from '../../services/photo-download.service';
import { PhotoCropService } from '../../services/photo-crop.service';

@Component({
  selector: 'app-step4-download',
  templateUrl: './step4-download.component.html',
  styleUrls: ['./step4-download.component.css']
})
export class Step4DownloadComponent implements OnInit {
  qualityWarning = false;
  sourceSize = '';
  requiredSize = '';
  jpegLoading = false;
  pdfLoading = false;
  previewUrl: string | null = null;

  private sourceImageUrl: string | null = null;
  private landmarks: FaceLandmarks | null = null;
  private docType: DocumentType | null = null;
  private paper: PaperSize | null = null;

  constructor(
    public photoState: PhotoStateService,
    private photoDownloadService: PhotoDownloadService,
    private photoCropService: PhotoCropService
  ) {}

  ngOnInit(): void {
    this.docType = this.photoState.selectedDocumentType.getValue();
    this.paper = this.photoState.selectedPaperSize.getValue();
    this.previewUrl = this.photoState.layoutPreviewUrl.getValue();

    const source = this.resolveCropSource();
    this.sourceImageUrl = source.url;
    this.landmarks = source.landmarks;

    if (this.sourceImageUrl && this.docType) {
      this.photoDownloadService.getQualityInfo(this.sourceImageUrl, this.docType, this.landmarks)
        .then(result => {
          this.qualityWarning = result.qualityWarning || result.warnings.some(warning => warning.type === 'clamped');
          this.sourceSize = `${result.sourceSize.width}x${result.sourceSize.height}px`;
          this.requiredSize = `${result.requiredSize.width}x${result.requiredSize.height}px`;
        });
    }
  }

  hasSource(): boolean {
    return !!(this.sourceImageUrl && this.docType && this.paper);
  }

  async onDownloadJpeg(): Promise<void> {
    if (!this.sourceImageUrl || !this.docType || !this.paper) return;
    this.jpegLoading = true;
    try {
      const { url } = await this.photoDownloadService.renderLayoutJpeg(this.sourceImageUrl, this.docType, this.paper, this.landmarks);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'photo-layout.jpg';
      a.click();
    } finally {
      this.jpegLoading = false;
    }
  }

  async onDownloadPdf(): Promise<void> {
    if (!this.sourceImageUrl || !this.docType || !this.paper) return;
    this.pdfLoading = true;
    try {
      await this.photoDownloadService.renderLayoutPdf(this.sourceImageUrl, this.docType, this.paper, this.landmarks);
    } finally {
      this.pdfLoading = false;
    }
  }

  private resolveCropSource(): { url: string | null; landmarks: FaceLandmarks | null } {
    if (this.docType && this.photoCropService.hasPlacementRules(this.docType)) {
      const alignedUrl = this.photoState.alignedImage.getValue();
      const alignedLandmarks = this.photoState.alignedFaceLandmarks.getValue();
      if (alignedUrl && alignedLandmarks) {
        return { url: alignedUrl, landmarks: alignedLandmarks };
      }
    }

    return { url: this.photoState.processedImage.getValue(), landmarks: null };
  }
}

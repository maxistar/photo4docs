import { Component, OnInit } from '@angular/core';
import { PhotoStateService, DocumentType, FaceLandmarks, PaperSize } from '../../services/photo-state.service';
import { ExportFormat, PhotoDownloadService } from '../../services/photo-download.service';
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
  downloadLoading = false;
  previewUrl: string | null = null;
  selectedFormat: ExportFormat = 'jpeg';

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

  get formatOptions(): Array<{ value: ExportFormat; label: string }> {
    return ['jpeg', 'png', 'pdf'].map(format => ({ value: format as ExportFormat, label: format.toUpperCase() }));
  }

  selectFormat(format: ExportFormat): void {
    if (this.formatOptions.some(option => option.value === format)) {
      this.selectedFormat = format;
    }
  }

  getSelectedDescription(): string {
    if (!this.docType || !this.paper) return '';

    return `${this.paper.name} · ${this.paper.widthMm}mm × ${this.paper.heightMm}mm · ${this.paper.orientation} · 300 DPI · print at 100%`;
  }

  getDownloadLabel(): string {
    return this.downloadLoading ? 'Rendering…' : `Download ${this.selectedFormat.toUpperCase()}`;
  }

  async onDownload(): Promise<void> {
    if (!this.sourceImageUrl || !this.docType || !this.paper) return;
    this.downloadLoading = true;
    try {
      if (this.selectedFormat === 'pdf') {
        await this.photoDownloadService.renderLayoutPdf(this.sourceImageUrl, this.docType, this.paper, this.landmarks);
        return;
      }

      const imageFormat = this.selectedFormat === 'png' ? 'png' : 'jpeg';
      const { url } = await this.photoDownloadService.renderLayoutImage(this.sourceImageUrl, this.docType, this.paper, imageFormat, this.landmarks);

      const a = document.createElement('a');
      a.href = url;
      a.download = this.getDownloadFilename(imageFormat);
      a.click();
    } finally {
      this.downloadLoading = false;
    }
  }

  private getDownloadFilename(format: 'jpeg' | 'png'): string {
    const extension = format === 'jpeg' ? 'jpg' : 'png';
    return `photo-layout.${extension}`;
  }

  private resolveCropSource(): { url: string | null; landmarks: FaceLandmarks | null } {
    const alignedLandmarks = this.photoState.alignedFaceLandmarks.getValue();
    if (this.docType && alignedLandmarks && this.photoCropService.hasPlacementRules(this.docType)) {
      return { url: this.photoState.getActiveAlignedImage(), landmarks: alignedLandmarks };
    }
    return { url: this.photoState.getActiveProcessedImage(), landmarks: null };
  }
}

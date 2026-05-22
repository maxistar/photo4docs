import { Component, OnInit } from '@angular/core';
import { PhotoStateService, DocumentType, PaperSize } from '../../services/photo-state.service';
import { PhotoDownloadService } from '../../services/photo-download.service';

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

  private processedImageUrl: string | null = null;
  private docType: DocumentType | null = null;
  private paper: PaperSize | null = null;

  constructor(
    public photoState: PhotoStateService,
    private photoDownloadService: PhotoDownloadService
  ) {}

  ngOnInit(): void {
    this.processedImageUrl = this.photoState.processedImage.getValue();
    this.docType = this.photoState.selectedDocumentType.getValue();
    this.paper = this.photoState.selectedPaperSize.getValue();
    this.previewUrl = this.photoState.layoutPreviewUrl.getValue();

    if (this.processedImageUrl && this.docType) {
      const targetW = Math.round(this.docType.widthMm / 25.4 * 300);
      const targetH = Math.round(this.docType.heightMm / 25.4 * 300);
      const img = new Image();
      img.onload = () => {
        const minSrc = Math.min(img.naturalWidth, img.naturalHeight);
        const maxTarget = Math.max(targetW, targetH);
        if (minSrc < maxTarget) {
          this.qualityWarning = true;
          this.sourceSize = `${img.naturalWidth}×${img.naturalHeight}px`;
          this.requiredSize = `${targetW}×${targetH}px`;
        }
      };
      img.src = this.processedImageUrl;
    }
  }

  hasSource(): boolean {
    return !!(this.processedImageUrl && this.docType && this.paper);
  }

  async onDownloadJpeg(): Promise<void> {
    if (!this.processedImageUrl || !this.docType || !this.paper) return;
    this.jpegLoading = true;
    try {
      const { url } = await this.photoDownloadService.renderPhotoJpeg(this.processedImageUrl, this.docType, this.paper);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biometric-photo.jpg';
      a.click();
    } finally {
      this.jpegLoading = false;
    }
  }

  async onDownloadPdf(): Promise<void> {
    if (!this.processedImageUrl || !this.docType || !this.paper) return;
    this.pdfLoading = true;
    try {
      await this.photoDownloadService.renderLayoutPdf(this.processedImageUrl, this.docType, this.paper);
    } finally {
      this.pdfLoading = false;
    }
  }
}

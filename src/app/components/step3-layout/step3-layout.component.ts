import { Component, OnInit } from '@angular/core';
import { PhotoStateService, PaperSize } from '../../services/photo-state.service';
import { PrintLayoutService } from '../../services/print-layout.service';

@Component({
  selector: 'app-step3-layout',
  templateUrl: './step3-layout.component.html',
  styleUrls: ['./step3-layout.component.css']
})
export class Step3LayoutComponent implements OnInit {
  paperSizes: PaperSize[] = [];
  selectedPaperSize: PaperSize | null = null;

  previewUrl: string | null = null;
  previewLoading = false;
  gridCols = 0;
  gridRows = 0;

  constructor(
    private photoState: PhotoStateService,
    private printLayoutService: PrintLayoutService
  ) {}

  ngOnInit(): void {
    this.paperSizes = this.photoState.paperSizes;
    if (this.paperSizes.length > 0) {
      this.selectedPaperSize = this.paperSizes[0];
      this.applyPaperSize(this.paperSizes[0]);
    }
  }

  onPaperSizeChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const paper = this.paperSizes.find(p => p.id === selectElement.value) || null;
    this.selectedPaperSize = paper;
    if (paper) {
      this.applyPaperSize(paper);
    }
  }

  private async applyPaperSize(paper: PaperSize): Promise<void> {
    this.photoState.selectedPaperSize.next(paper);

    const croppedUrl = this.photoState.croppedPhotoDataUrl.getValue();
    const docType = this.photoState.selectedDocumentType.getValue();

    if (!croppedUrl || !docType) {
      this.previewUrl = null;
      this.previewLoading = false;
      return;
    }

    this.previewLoading = true;
    try {
      const result = await this.printLayoutService.generateLayoutPreview(
        croppedUrl,
        docType.widthMm,
        docType.heightMm,
        paper.widthMm,
        paper.heightMm
      );
      this.previewUrl = result.url;
      this.gridCols = result.cols;
      this.gridRows = result.rows;
      this.photoState.setLayoutPreviewUrl(result.url);
    } finally {
      this.previewLoading = false;
    }
  }
}

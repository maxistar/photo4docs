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
  selectedLayoutPaperSize: PaperSize | null = null;
  selectedOrientation: PaperSize['orientation'] = 'landscape';

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
      this.selectedOrientation = this.paperSizes[0].orientation;
      this.applySelectedLayout();
    }
  }

  onPaperSizeChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const paper = this.paperSizes.find(p => p.id === selectElement.value) || null;
    this.selectedPaperSize = paper;
    if (paper) {
      this.applySelectedLayout();
    }
  }

  onOrientationChange(orientation: PaperSize['orientation']): void {
    this.selectedOrientation = orientation;
    if (this.selectedPaperSize) {
      this.applySelectedLayout();
    }
  }

  private applySelectedLayout(): void {
    if (!this.selectedPaperSize) return;
    const paper = this.orientPaperSize(this.selectedPaperSize, this.selectedOrientation);
    this.selectedLayoutPaperSize = paper;
    this.applyPaperSize(paper);
  }

  private orientPaperSize(paper: PaperSize, orientation: PaperSize['orientation']): PaperSize {
    const shortSide = Math.min(paper.widthMm, paper.heightMm);
    const longSide = Math.max(paper.widthMm, paper.heightMm);

    return {
      ...paper,
      id: `${paper.id}_${orientation}`,
      widthMm: orientation === 'landscape' ? longSide : shortSide,
      heightMm: orientation === 'landscape' ? shortSide : longSide,
      orientation
    };
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

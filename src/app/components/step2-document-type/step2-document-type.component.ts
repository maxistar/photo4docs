import { Component, OnInit } from '@angular/core';
import { PhotoStateService, DocumentType } from '../../services/photo-state.service';
import { PhotoCropService } from '../../services/photo-crop.service';

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

  private async applyDocumentType(doc: DocumentType): Promise<void> {
    this.selectedDocumentType = doc;
    this.photoState.selectedDocumentType.next(doc);

    const source = this.photoState.processedImage.getValue();
    if (!source) return;

    this.previewLoading = true;
    try {
      const url = await this.photoCropService.cropToAspectRatio(source, doc.widthMm, doc.heightMm);
      this.previewUrl = url;
      this.photoState.croppedPhotoDataUrl.next(url);
    } finally {
      this.previewLoading = false;
    }
  }
}

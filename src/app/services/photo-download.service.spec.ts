import { TestBed } from '@angular/core/testing';
import { PhotoDownloadService, EXPORT_SITE_URL } from './photo-download.service';
import { PhotoCropService } from './photo-crop.service';
import { DocumentType, PaperSize } from './photo-state.service';

describe('PhotoDownloadService', () => {
  let service: PhotoDownloadService;

  const docType: DocumentType = {
    id: 'passport',
    name: 'Passport',
    widthMm: 35,
    heightMm: 45,
  };

  const paper: PaperSize = {
    id: 'photo_10x15_landscape',
    name: 'Photo 10x15 cm',
    widthMm: 152,
    heightMm: 102,
    orientation: 'landscape',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PhotoDownloadService, PhotoCropService]
    });
    service = TestBed.inject(PhotoDownloadService);
  });

  it('maps image export formats to browser mime types', () => {
    expect(service.getImageMimeType('jpeg')).toBe('image/jpeg');
    expect(service.getImageMimeType('png')).toBe('image/png');
  });

  it('formats export labels with document type, layout details, grid count, and site url', () => {
    const label = service.formatExportLabel(docType, paper, 4, 2);

    expect(label).toContain('Passport');
    expect(label).toContain('35x45mm');
    expect(label).toContain('Photo 10x15 cm 152x102mm landscape');
    expect(label).toContain('4x2 (8)');
    expect(label).toContain(EXPORT_SITE_URL);
  });

  it('reserves safe label space below photo tiles when possible', () => {
    const geometry = service.calculateLayoutGeometry(413, 531, 1795, 1205);

    expect(geometry.cols).toBe(4);
    expect(geometry.rows).toBe(2);
    expect(geometry.labelY).not.toBeNull();
    expect(geometry.labelY as number).toBeGreaterThanOrEqual(geometry.marginY + geometry.rows * 531);
  });

  it('preserves tile dimensions by changing only grid placement, not tile size', () => {
    const photoWidth = 413;
    const photoHeight = 531;
    const geometry = service.calculateLayoutGeometry(photoWidth, photoHeight, 1795, 1205);

    expect(geometry.marginX + geometry.cols * photoWidth).toBeLessThanOrEqual(1795);
    expect(geometry.marginY + geometry.rows * photoHeight).toBeLessThanOrEqual(1205);
  });
});

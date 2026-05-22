import { TestBed } from '@angular/core/testing';
import { PhotoCropService } from './photo-crop.service';
import { DocumentType, FaceLandmarks } from './photo-state.service';

describe('PhotoCropService', () => {
  let service: PhotoCropService;

  const landmarks: FaceLandmarks = {
    faceBox: { x: 300, y: 220, width: 120, height: 200 },
    headBox: { x: 280, y: 160, width: 160, height: 260 },
    chin: { x: 360, y: 420 },
    browCenter: { x: 360, y: 255 },
    leftEye: { x1: 320, y1: 290, x2: 345, y2: 290 },
    rightEye: { x1: 375, y1: 290, x2: 400, y2: 290 },
    faceCount: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PhotoCropService);
  });

  it('calculates a rule-aware crop from head height and top offset', () => {
    const doc: DocumentType = {
      id: 'passport',
      name: 'Passport',
      widthMm: 35,
      heightMm: 45,
      topOffsetMinMm: 5,
      topOffsetMaxMm: 5,
      headHeightMinMm: 25,
      headHeightMaxMm: 25,
    };

    const crop = service.calculateCropRect(1000, 1000, doc, landmarks);

    expect(crop.ruleAware).toBeTrue();
    expect(crop.clamped).toBeFalse();
    expect(crop.width).toBeCloseTo(364, 0);
    expect(crop.height).toBeCloseTo(468, 0);
    expect(crop.x).toBeCloseTo(178, 0);
    expect(crop.y).toBeCloseTo(108, 0);
  });

  it('falls back to centered aspect-ratio crop without placement rules', () => {
    const doc: DocumentType = { id: 'portrait', name: 'Portrait', widthMm: 35, heightMm: 45 };

    const crop = service.calculateCropRect(800, 800, doc, null);

    expect(crop.ruleAware).toBeFalse();
    expect(crop.clamped).toBeFalse();
    expect(crop.height).toBe(800);
    expect(crop.width).toBeCloseTo(622.22, 2);
    expect(crop.x).toBeCloseTo(88.89, 2);
    expect(crop.y).toBe(0);
  });

  it('flags rule-aware crops that need clamping', () => {
    const doc: DocumentType = {
      id: 'tight',
      name: 'Tight',
      widthMm: 35,
      heightMm: 45,
      topOffsetMinMm: 2,
      topOffsetMaxMm: 2,
      headHeightMinMm: 20,
      headHeightMaxMm: 20,
    };
    const edgeLandmarks: FaceLandmarks = {
      ...landmarks,
      faceBox: { x: 10, y: 10, width: 120, height: 200 },
      headBox: { x: 0, y: 0, width: 160, height: 260 },
    };

    const crop = service.calculateCropRect(400, 400, doc, edgeLandmarks);

    expect(crop.ruleAware).toBeTrue();
    expect(crop.clamped).toBeTrue();
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(0);
  });
});

import { TestBed } from '@angular/core/testing';

import { PhotoStateService } from './photo-state.service';

describe('PhotoStateService', () => {
  let service: PhotoStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PhotoStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step1UploadComponent } from './step1-upload.component';

describe('Step1UploadComponent', () => {
  let component: Step1UploadComponent;
  let fixture: ComponentFixture<Step1UploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Step1UploadComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step1UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

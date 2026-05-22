import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step2DocumentTypeComponent } from './step2-document-type.component';

describe('Step2DocumentTypeComponent', () => {
  let component: Step2DocumentTypeComponent;
  let fixture: ComponentFixture<Step2DocumentTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Step2DocumentTypeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step2DocumentTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

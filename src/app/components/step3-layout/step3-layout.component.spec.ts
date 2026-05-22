import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step3LayoutComponent } from './step3-layout.component';

describe('Step3LayoutComponent', () => {
  let component: Step3LayoutComponent;
  let fixture: ComponentFixture<Step3LayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Step3LayoutComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step3LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

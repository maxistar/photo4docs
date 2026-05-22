// src/app/components/wizard/wizard.component.ts
import { Component } from '@angular/core';
import { PhotoStateService } from '../../services/photo-state.service'; // Correct path

@Component({
  selector: 'app-wizard',
  templateUrl: './wizard.component.html',
  styleUrls: ['./wizard.component.css'] // or .scss
})
export class WizardComponent {
  currentStep = 1;

  constructor(public photoState: PhotoStateService) {} // Inject service

  nextStep() {
    if (this.canProceed()) {
        this.currentStep++;
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
        this.currentStep--;
    }
  }

  canProceed(): boolean {
      switch (this.currentStep) {
          case 1: return this.photoState.preprocessingStatus.getValue() === 'done';
          case 2: return true;
          case 3: return true;
          case 4: return false;
          default: return false;
      }
  }

  isStepVisible(step: number): boolean {
      return this.currentStep === step;
  }

  resetWizard() {
      this.photoState.resetState();
      this.currentStep = 1;
      // Potentially force re-render or reset child components if needed
      // For simple cases, resetting the service state might be enough.
  }
}
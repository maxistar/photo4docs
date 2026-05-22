import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { WizardComponent } from './components/wizard/wizard.component';
import { Step1UploadComponent } from './components/step1-upload/step1-upload.component';
import { Step2DocumentTypeComponent } from './components/step2-document-type/step2-document-type.component';
import { Step3LayoutComponent } from './components/step3-layout/step3-layout.component';
import { Step4DownloadComponent } from './components/step4-download/step4-download.component';

@NgModule({
  declarations: [
    AppComponent,
    WizardComponent,
    Step1UploadComponent,
    Step2DocumentTypeComponent,
    Step3LayoutComponent,
    Step4DownloadComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

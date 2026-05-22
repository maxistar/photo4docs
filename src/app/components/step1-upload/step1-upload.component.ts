import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ImagePreprocessingService } from '../../services/image-preprocessing.service';
import { FaceLandmarks, PhotoStateService, PreprocessingStatus } from '../../services/photo-state.service';

@Component({
  selector: 'app-step1-upload',
  templateUrl: './step1-upload.component.html',
  styleUrls: ['./step1-upload.component.css'],
})
export class Step1UploadComponent implements OnInit, OnDestroy {
  fileName = '';
  originalPreview: string | null = null;
  displayImage: string | null = null;
  status: PreprocessingStatus = 'idle';
  errorMessage: string | null = null;
  faceLandmarks: FaceLandmarks | null = null;

  @ViewChild('previewImg') previewImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('previewCanvas') previewCanvasRef!: ElementRef<HTMLCanvasElement>;

  private subs: Subscription[] = [];

  constructor(
    private preprocessingService: ImagePreprocessingService,
    public photoState: PhotoStateService
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.photoState.preprocessingStatus.subscribe(s => (this.status = s)),
      this.photoState.preprocessingError.subscribe(e => (this.errorMessage = e)),
      this.photoState.processedImage.subscribe(url => {
        if (url) this.displayImage = url;
      }),
      this.photoState.faceLandmarks.subscribe(landmarks => {
        this.faceLandmarks = landmarks;
        if (landmarks) {
          // Defer drawing until after Angular renders the updated displayImage
          setTimeout(() => this.drawEyeOverlay(landmarks), 0);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileName = file.name;

    if (!file.type.match('image.*')) {
      alert('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    this.displayImage = null;
    this.originalPreview = null;

    const reader = new FileReader();
    reader.onload = () => {
      this.originalPreview = reader.result as string;
      this.displayImage = this.originalPreview;

      // Build an off-screen image element for face-api.js
      const img = new Image();
      img.onload = () => this.preprocessingService.preprocess(file, img);
      img.src = this.originalPreview;
    };
    reader.readAsDataURL(file);
  }

  // Redraws overlay when the displayed <img> finishes loading (e.g. when switching
  // from original to processed preview)
  onPreviewLoaded(): void {
    if (this.faceLandmarks) {
      this.drawEyeOverlay(this.faceLandmarks);
    }
  }

  private drawEyeOverlay(landmarks: FaceLandmarks): void {
    const imgEl = this.previewImgRef?.nativeElement;
    const canvas = this.previewCanvasRef?.nativeElement;
    if (!imgEl || !canvas || !imgEl.naturalWidth) return;

    const scaleX = imgEl.clientWidth / imgEl.naturalWidth;
    const scaleY = imgEl.clientHeight / imgEl.naturalHeight;

    canvas.width = imgEl.clientWidth;
    canvas.height = imgEl.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Face bounding box
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      landmarks.faceBox.x * scaleX,
      landmarks.faceBox.y * scaleY,
      landmarks.faceBox.width * scaleX,
      landmarks.faceBox.height * scaleY
    );

    // Eye boxes and precise centre line
    ctx.strokeStyle = '#00cc44';
    ctx.lineWidth = 2;
    const eyeCenters: Array<{ x: number; y: number }> = [];
    for (const eye of [landmarks.leftEye, landmarks.rightEye]) {
      const padding = 4;
      const x = eye.x1 * scaleX - padding;
      const y = eye.y1 * scaleY - padding;
      const w = (eye.x2 - eye.x1) * scaleX + padding * 2;
      const h = (eye.y2 - eye.y1) * scaleY + padding * 2;
      ctx.strokeRect(x, y, w, h);
      eyeCenters.push({
        x: ((eye.x1 + eye.x2) / 2) * scaleX,
        y: ((eye.y1 + eye.y2) / 2) * scaleY,
      });
    }

    if (eyeCenters.length === 2) {
      ctx.strokeStyle = '#00aa55';
      ctx.beginPath();
      ctx.moveTo(eyeCenters[0].x, eyeCenters[0].y);
      ctx.lineTo(eyeCenters[1].x, eyeCenters[1].y);
      ctx.stroke();
    }
  }

  triggerFileInput(): void {
    document.getElementById('fileInput')?.click();
  }
}

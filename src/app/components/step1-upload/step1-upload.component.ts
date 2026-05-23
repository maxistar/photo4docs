import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ImagePreprocessingService } from '../../services/image-preprocessing.service';
import { FaceLandmarks, PhotoStateService, PreprocessingStatus, SubStepStatus } from '../../services/photo-state.service';

@Component({
  selector: 'app-step1-upload',
  templateUrl: './step1-upload.component.html',
  styleUrls: ['./step1-upload.component.css'],
})
export class Step1UploadComponent implements OnInit, OnDestroy {
  fileName = '';
  displayImage: string | null = null;
  status: PreprocessingStatus = 'idle';
  errorMessage: string | null = null;
  alignedFaceLandmarks: FaceLandmarks | null = null;

  faceDetectionStatus: SubStepStatus = 'idle';
  bgRemovalStatus: SubStepStatus = 'idle';

  showHeadBox = true;
  showFaceBox = true;
  showEyeLine = true;
  showChin = true;
  showBrowCenter = false;
  useOriginalBackground = false;

  private alignedImage: string | null = null;
  private alignedOriginalImage: string | null = null;
  private alignmentAngleRad = 0;

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
      this.photoState.faceDetectionStatus.subscribe(s => (this.faceDetectionStatus = s)),
      this.photoState.bgRemovalStatus.subscribe(s => (this.bgRemovalStatus = s)),
      this.photoState.alignedImage.subscribe(url => {
        this.alignedImage = url;
        if (!this.useOriginalBackground) this.displayImage = url;
      }),
      this.photoState.alignedOriginalImage.subscribe(url => {
        this.alignedOriginalImage = url;
        if (this.useOriginalBackground) this.displayImage = url;
      }),
      this.photoState.alignedFaceLandmarks.subscribe(lm => {
        this.alignedFaceLandmarks = lm;
        if (lm) setTimeout(() => this.drawOverlay(), 0);
      }),
      this.photoState.alignmentAngle.subscribe(angle => {
        this.alignmentAngleRad = angle;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get rotationInfo(): string {
    const deg = this.alignmentAngleRad * 180 / Math.PI;
    if (Math.abs(deg) < 0.5) return 'No rotation applied';
    const sign = deg > 0 ? '+' : '';
    return `Rotation: ${sign}${deg.toFixed(1)}°`;
  }

  get controlsDisabled(): boolean {
    return this.status !== 'done';
  }

  onBgToggle(): void {
    if (this.controlsDisabled) return;
    this.useOriginalBackground = !this.useOriginalBackground;
    this.photoState.useOriginalBackground.next(this.useOriginalBackground);
    this.displayImage = this.useOriginalBackground ? this.alignedOriginalImage : this.alignedImage;
  }

  onPreviewAreaClick(): void {
    if (this.status === 'running') return;
    document.getElementById('fileInput')?.click();
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
    this.alignedImage = null;
    this.alignedOriginalImage = null;
    this.alignedFaceLandmarks = null;
    this.useOriginalBackground = false;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => this.preprocessingService.preprocess(file, img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onPreviewLoaded(): void {
    if (this.alignedFaceLandmarks) this.drawOverlay();
  }

  onMarkToggle(): void {
    this.drawOverlay();
  }

  private drawOverlay(): void {
    const imgEl = this.previewImgRef?.nativeElement;
    const canvas = this.previewCanvasRef?.nativeElement;
    const lm = this.alignedFaceLandmarks;
    if (!imgEl || !canvas) return;

    if (!lm || !imgEl.naturalWidth) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const scaleX = imgEl.clientWidth / imgEl.naturalWidth;
    const scaleY = imgEl.clientHeight / imgEl.naturalHeight;

    canvas.width = imgEl.clientWidth;
    canvas.height = imgEl.clientHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.showHeadBox) {
      const box = lm.headBox ?? lm.faceBox;
      ctx.strokeStyle = '#22cc44';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY);
    }

    if (this.showFaceBox) {
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lm.faceBox.x * scaleX, lm.faceBox.y * scaleY, lm.faceBox.width * scaleX, lm.faceBox.height * scaleY);
    }

    if (this.showEyeLine) {
      const leftCx = ((lm.leftEye.x1 + lm.leftEye.x2) / 2) * scaleX;
      const leftCy = ((lm.leftEye.y1 + lm.leftEye.y2) / 2) * scaleY;
      const rightCx = ((lm.rightEye.x1 + lm.rightEye.x2) / 2) * scaleX;
      const rightCy = ((lm.rightEye.y1 + lm.rightEye.y2) / 2) * scaleY;
      ctx.strokeStyle = '#22cc44';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftCx, leftCy);
      ctx.lineTo(rightCx, rightCy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.showChin && lm.chin) {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(lm.chin.x * scaleX, lm.chin.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.showBrowCenter && lm.browCenter) {
      ctx.fillStyle = '#9933cc';
      ctx.beginPath();
      ctx.arc(lm.browCenter.x * scaleX, lm.browCenter.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

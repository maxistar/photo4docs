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
  imageLoaded = false;
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
  removeBackgroundEnabled = true;

  readonly presetColors = [
    { hex: '#ffffff', label: 'White' },
    { hex: '#e8e8e8', label: 'Light gray' },
    { hex: '#d6e4f0', label: 'Light blue' },
    { hex: '#f5f0e8', label: 'Beige' },
    { hex: '#fffacd', label: 'Pale yellow' },
  ];
  selectedBackgroundColor = '#ffffff';

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
        this.refreshDisplayImage();
      }),
      this.photoState.alignedOriginalImage.subscribe(url => {
        this.alignedOriginalImage = url;
        this.refreshDisplayImage();
      }),
      this.photoState.useOriginalBackground.subscribe(v => {
        this.useOriginalBackground = v;
        this.refreshDisplayImage();
      }),
      this.photoState.alignedFaceLandmarks.subscribe(lm => {
        this.alignedFaceLandmarks = lm;
        if (lm) setTimeout(() => this.drawOverlay(), 0);
      }),
      this.photoState.alignmentAngle.subscribe(angle => {
        this.alignmentAngleRad = angle;
      }),
      this.photoState.selectedBackgroundColor.subscribe(c => (this.selectedBackgroundColor = c)),
      this.photoState.removeBackgroundEnabled.subscribe(v => (this.removeBackgroundEnabled = v)),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // Always shows the best available image for the current state.
  private refreshDisplayImage(): void {
    let next: string | null;
    if (!this.useOriginalBackground && this.alignedImage) {
      next = this.alignedImage;
    } else if (this.alignedOriginalImage) {
      next = this.alignedOriginalImage;
    } else {
      return; // no change — keep whatever is currently shown (original or null)
    }
    if (next !== this.displayImage) {
      this.displayImage = next;
      this.imageLoaded = false;
    }
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
    if (!this.fileName) return;
    const enableBg = !this.removeBackgroundEnabled;
    this.photoState.removeBackgroundEnabled.next(enableBg);
    if (!enableBg) {
      this.photoState.useOriginalBackground.next(true);
    } else if (this.status === 'done') {
      this.photoState.useOriginalBackground.next(false);
    }
  }

  get isCustomColor(): boolean {
    return !this.presetColors.some(c => c.hex === this.selectedBackgroundColor);
  }

  onColorSelect(color: string): void {
    this.photoState.selectedBackgroundColor.next(color);
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
    this.imageLoaded = false;
    this.alignedImage = null;
    this.alignedOriginalImage = null;
    this.alignedFaceLandmarks = null;
    this.useOriginalBackground = false;
    this.photoState.removeBackgroundEnabled.next(true);
    this.photoState.selectedBackgroundColor.next('#ffffff');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Show the original image immediately before any processing
        this.displayImage = dataUrl;
        this.imageLoaded = false;
        this.preprocessingService.preprocess(file, img);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  onPreviewLoaded(): void {
    this.imageLoaded = true;
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

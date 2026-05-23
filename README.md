# Biometric Photo Wizard

A browser-based tool for preparing biometric photos that meet official requirements for passports, visas, and other identity documents.

**Live demo:** [https://photos.preloader.org](https://photos.preloader.org)

## Privacy First

**Your photos never leave your device.** All processing — face detection, background removal, cropping, and PDF generation — runs entirely in the browser using local machine learning models and WebAssembly. No images are uploaded to any server.

## What It Does

The wizard walks you through four steps:

1. **Upload & Adjust** — Select a photo. The app automatically detects your face, corrects the rotation, and optionally removes the background. You can choose a background colour (white, grey, blue, etc.) and toggle landmark overlays to inspect the detection results.
2. **Select Document** — Choose the target document type (passport, visa, ID card, etc.). The app crops the photo to the exact pixel dimensions and head-placement rules required by that document.
3. **Print Layout** — Preview a print sheet with multiple copies of the photo arranged for standard paper sizes.
4. **Download** — Download the cropped photo as a PNG or the print layout as a PDF, ready to send to a photo lab or print at home.

## Dependencies

| Package | Purpose |
|---|---|
| [Angular 15](https://angular.io) | Application framework |
| [face-api.js](https://github.com/justadudewhohacks/face-api.js) | In-browser face detection and landmark extraction |
| [@imgly/background-removal](https://github.com/imgly/background-removal-js) | In-browser background removal via WebAssembly |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF generation for the print layout |
| [RxJS](https://rxjs.dev) | Reactive state management |

## Development

```bash
npm install
ng serve        # dev server at http://localhost:4200
ng build        # production build → dist/
```

## License

[AGPL-3.0-or-later](../LICENSE)

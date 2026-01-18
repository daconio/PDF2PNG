# Product Requirements Document (PRD) - ParsePDF

## 1. Executive Summary
**ParsePDF** is a privacy-first, client-side web application designed for quick document manipulation. Unlike traditional PDF tools that require server uploads, ParsePDF processes all files locally within the user's browser, ensuring sensitive data never leaves the device. The application features a distinctive "Neo-Brutalist" design language, prioritizing bold aesthetics and high usability.

## 2. Core Value Propositions
*   **Privacy First:** Zero server-side processing. All logic handles via Web Workers and Canvas API.
*   **Speed:** Instant feedback without network latency for uploads/downloads.
*   **Aesthetics:** Modern, high-contrast, tactile UI.
*   **Accessibility:** Dual language support (English/Korean) and clear visual cues.

## 3. Functional Requirements

### 3.1. Mode: PDF to PNG Conversion
*   **Input:** Support for `.pdf` files via Drag & Drop or File Browser.
*   **Page Parsing:**
    *   Automatically detect total page count using `pdfjs-dist`.
    *   **Page Selection Modal:**
        *   Triggered immediately after file drop.
        *   Allow input of ranges (e.g., "1-3") and individual pages (e.g., "1, 5, 8").
        *   Validate input against total page count.
        *   Provide textual preview of selected pages.
*   **Processing:**
    *   Render pages to HTML5 Canvas at scale 2.0 (Retina quality).
    *   Convert Canvas to PNG Blob.
*   **Output:**
    *   Display list of generated PNGs.
    *   Allow individual download.
    *   Allow "Download ZIP" for all generated images.

### 3.2. Mode: PNG to PDF Conversion
*   **Input:** Support for image files (`.png`, `.jpg`, `.jpeg`, `.webp`).
*   **Management:**
    *   **Drag & Drop Sorting:** Users can reorder images using `dnd-kit` to determine page order in the final PDF.
    *   Delete individual images from the queue.
*   **Processing:**
    *   Calculate aspect ratios to fit images within standard PDF page sizes using `jspdf`.
    *   Auto-pagination (one image per page).
*   **Output:**
    *   Single merged PDF file.

### 3.3. Feature: Integrated Image Editor
A lightweight editor available for generated PNGs or uploaded images before merging.
*   **Tools:**
    *   **Eraser:** Variable size brush to whiten out content.
    *   **Text:** Add text overlays.
        *   *Config:* Font Family (Pretendard, Nanum, System), Font Size, Text Color.
    *   **Crop:** UI overlay with rule-of-thirds grid. Drag to select area.
    *   **Adjust:** Brightness and Contrast sliders (50% - 150%).
    *   **Rotate:** 90-degree clockwise rotation.
*   **History:** Undo functionality for drawing/editing actions.
*   **State Management:** Save changes to Blob and update the main file list.

### 3.4. General UI/UX
*   **Drop Zone:** Animated visual feedback when dragging files.
*   **Preview Pane:**
    *   PDFs: Iframe rendering.
    *   Images: Scaled image rendering.
*   **Pipeline Visualization:** Visual indicator of state (Input -> Process -> Output).
*   **Localization:** Real-time toggle between English (EN) and Korean (KO).

## 4. Technical Architecture

### 4.1. Tech Stack
*   **Framework:** React 18 (Vite)
*   **Styling:** Tailwind CSS (configured for Neo-Brutalism)
*   **Core Libraries:**
    *   `pdfjs-dist` (v3.11.174): PDF reading/rendering.
    *   `jspdf`: PDF generation.
    *   `jszip`: Archive generation.
    *   `@dnd-kit`: Drag and drop interfaces.
    *   `lucide-react`: Iconography.

### 4.2. Performance Constraints
*   **Web Workers:** PDF rendering must utilize `pdf.worker.min.js` to prevent blocking the main thread.
*   **Memory:** Handle large Blobs carefully; revoke ObjectURLs when files are deleted or updated to prevent memory leaks.

## 5. Design System (Neo-Brutalism)
*   **Colors:**
    *   Primary: Royal Blue (`#3b82f6`) / Soft Blue (`#88aaee`)
    *   Background: Mist Rose (`#FFF0F0`) or White
    *   Text/Borders: Pure Black (`#000000`)
    *   Accent: Yellow (`#ffcc00`)
*   **Typography:**
    *   Headings: "Space Grotesk" (Sans-serif, geometric).
    *   Korean Support: "Nanum Gothic", "Nanum Myeongjo", "Pretendard".
*   **Components:**
    *   **Cards:** Hard black borders (2px), sharp corners or slight rounding, hard drop shadows (`box-shadow: 4px 4px 0px 0px black`).
    *   **Buttons:** High contrast, active states simulate physical pressing (transform translate).

## 6. Future Roadmap
*   **v1.1:** Add "Split PDF" functionality (separate from image conversion).
*   **v1.2:** Client-side OCR (Tesseract.js integration) for text extraction.
*   **v1.3:** PDF Compression settings (quality sliders).

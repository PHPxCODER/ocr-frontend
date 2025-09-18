// app/page.tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for PDF.js (you might want to install @types/pdfjs-dist)
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PDFMetadata {
  fileName: string;
  totalPages: number;
  currentPage: number;
  metadata: any;
}

interface PDFState {
  doc: any;
  pageNum: number;
  pageRendering: boolean;
  pageNumPending: number | null;
  currentZoomScale: number;
  pageRenderCache: Map<string, ImageBitmap>;
}

const BASE_RENDER_SCALE = 0.5;
const ZOOM_STEP = 0.25;
const MIN_ZOOM_SCALE = 0.5;
const MAX_ZOOM_SCALE = 3.0;
const PRELOAD_OFFSET = 2;

export default function PDFViewerPage() {
  const [pdfMetadata, setPdfMetadata] = useState<PDFMetadata>({
    fileName: 'N/A',
    totalPages: 0,
    currentPage: 1,
    metadata: null
  });

  const [pdfState, setPdfState] = useState<PDFState>({
    doc: null,
    pageNum: 1,
    pageRendering: false,
    pageNumPending: null,
    currentZoomScale: 0.5,
    pageRenderCache: new Map()
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize PDF.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const renderPage = useCallback(async (num: number) => {
    if (!pdfState.doc || !canvasRef.current) return;

    const cacheKey = `${num}-${pdfState.currentZoomScale.toFixed(2)}`;
    
    setPdfState(prev => ({ ...prev, pageRendering: true, pageNum: num }));
    setPdfMetadata(prev => ({ ...prev, currentPage: num }));

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    try {
      // Check cache first
      if (pdfState.pageRenderCache.has(cacheKey)) {
        const imageBitmap = pdfState.pageRenderCache.get(cacheKey);
        if (imageBitmap) {
          const page = await pdfState.doc.getPage(num);
          const viewport = page.getViewport({ scale: BASE_RENDER_SCALE * pdfState.currentZoomScale });
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
          
          setPdfState(prev => ({ ...prev, pageRendering: false }));
          return;
        }
      }

      // Render fresh
      const page = await pdfState.doc.getPage(num);
      const viewport = page.getViewport({ scale: BASE_RENDER_SCALE * pdfState.currentZoomScale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Cache the result
      const imageBitmap = await createImageBitmap(canvas);
      const newCache = new Map(pdfState.pageRenderCache);
      newCache.set(cacheKey, imageBitmap);
      
      setPdfState(prev => ({ 
        ...prev, 
        pageRendering: false,
        pageRenderCache: newCache 
      }));

    } catch (error) {
      console.error('Error rendering page:', error);
      setPdfState(prev => ({ ...prev, pageRendering: false }));
    }
  }, [pdfState.doc, pdfState.currentZoomScale, pdfState.pageRenderCache]);

  const loadPDF = useCallback(async (file: File) => {
    if (!window.pdfjsLib) {
      alert('PDF.js is not loaded yet. Please try again in a moment.');
      return;
    }

    // Reset state
    setPdfState({
      doc: null,
      pageNum: 1,
      pageRendering: false,
      pageNumPending: null,
      currentZoomScale: 0.5,
      pageRenderCache: new Map()
    });

    setPdfMetadata({
      fileName: 'Loading...',
      totalPages: 0,
      currentPage: 1,
      metadata: null
    });

    // Clear canvas
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    }

    // Reset scroll
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      containerRef.current.scrollLeft = 0;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      const pdfDoc = await window.pdfjsLib.getDocument(typedArray).promise;
      
      const metadata = await pdfDoc.getMetadata();
      
      setPdfMetadata({
        fileName: file.name,
        totalPages: pdfDoc.numPages,
        currentPage: 1,
        metadata: metadata.info
      });

      setPdfState(prev => ({ ...prev, doc: pdfDoc }));
      
      // Render first page
      setTimeout(() => renderPage(1), 100);

    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Failed to load PDF. Please ensure it is a valid PDF file.');
      setPdfMetadata({
        fileName: 'Error!',
        totalPages: 0,
        currentPage: 1,
        metadata: null
      });
    }
  }, [renderPage]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      loadPDF(file);
    } else {
      alert('Please upload a valid PDF file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const navigatePage = (direction: 'prev' | 'next') => {
    if (!pdfState.doc) return;
    
    const newPageNum = direction === 'prev' 
      ? Math.max(1, pdfState.pageNum - 1)
      : Math.min(pdfMetadata.totalPages, pdfState.pageNum + 1);
    
    if (newPageNum !== pdfState.pageNum) {
      renderPage(newPageNum);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!pdfState.doc) return;

    const newScale = direction === 'in'
      ? Math.min(MAX_ZOOM_SCALE, pdfState.currentZoomScale + ZOOM_STEP)
      : Math.max(MIN_ZOOM_SCALE, pdfState.currentZoomScale - ZOOM_STEP);

    if (newScale !== pdfState.currentZoomScale) {
      setPdfState(prev => ({ ...prev, currentZoomScale: newScale }));
      
      // Reset scroll position
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
      
      setTimeout(() => renderPage(pdfState.pageNum), 50);
    }
  };

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pdfState.doc || e.button !== 0) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (containerRef.current) {
      setScrollStart({
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    containerRef.current.scrollLeft = scrollStart.left - dx;
    containerRef.current.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg">
        <nav className="container mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold bg-white/10 rounded-md px-3 py-1 backdrop-blur-sm">
            NRGTech
          </div>
          <div className="text-2xl font-semibold">
            AUTOMATED P&ID PARTS COUNT
          </div>
          <ul className="flex space-x-6 text-lg">
            <li><a href="#" className="hover:text-blue-200 transition-colors">Home</a></li>
            <li><a href="#" className="hover:text-blue-200 transition-colors">About</a></li>
            <li><a href="#" className="hover:text-blue-200 transition-colors">Contact</a></li>
          </ul>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 p-4 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 mr-6 flex-shrink-0">
          <Card className="h-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-gray-700">
                PDF Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full space-y-6">
              {/* Upload Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-500 hover:bg-blue-600 transition-all duration-300 transform hover:scale-105"
                  size="lg"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload PDF
                </Button>
              </div>

              {/* Detect & Sizes Section */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!pdfState.doc}
                >
                  Detect Valve & Sizes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!pdfState.doc}
                >
                  Download Detected PDF
                </Button>
              </div>

              {/* Valve Size Report */}
              <div className="text-sm text-gray-600">
                Valve Size Report: 
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                disabled={!pdfState.doc}
              >
                Download Valve Size Report
              </Button>

              {/* Metadata */}
              <Card className="flex-1 bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Metadata:</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <strong>Total Valve Count:</strong>
                    <div className="ml-4 space-y-1">
                      <div>Total VB:</div>
                      <div>Total VC:</div>
                      <div>Total VG:</div>
                      <div>Total VGL:</div>
                      <div>Total PSV:</div>
                      <div>Total PCV:</div>
                      <div>Total FCV:</div>
                      <div>Total BDV:</div>
                      <div>Total LCV:</div>
                      <div>Total TCV:</div>
                      <div>Total SDV:</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Controls */}
              <Card className="bg-gray-100">
                <CardContent className="p-4 space-y-4">
                  {/* Zoom Controls */}
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZoom('out')}
                      disabled={!pdfState.doc || pdfState.currentZoomScale <= MIN_ZOOM_SCALE}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-semibold min-w-[60px] text-center">
                      {Math.round(pdfState.currentZoomScale * 100)}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZoom('in')}
                      disabled={!pdfState.doc || pdfState.currentZoomScale >= MAX_ZOOM_SCALE}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Page Navigation */}
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigatePage('prev')}
                      disabled={!pdfState.doc || pdfState.pageNum <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Prev
                    </Button>
                    <span className="text-sm font-semibold min-w-[80px] text-center">
                      Page {pdfMetadata.currentPage} of {pdfMetadata.totalPages}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigatePage('next')}
                      disabled={!pdfState.doc || pdfState.pageNum >= pdfMetadata.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </aside>

        {/* PDF Viewer */}
        <section className="flex-1">
          <Card className="h-full shadow-lg">
            <CardContent className="p-6 h-full">
              <div
                ref={containerRef}
                className={cn(
                  "h-full overflow-auto rounded-lg border border-gray-300 bg-gray-50",
                  pdfState.doc && "cursor-grab",
                  isDragging && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  className="block mx-auto select-none"
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

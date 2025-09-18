// types/pdfjs.d.ts
declare module 'pdfjs-dist' {
    export interface PDFDocumentProxy {
      numPages: number;
      getPage(pageNumber: number): Promise<PDFPageProxy>;
      getMetadata(): Promise<{
        info: any;
        metadata: any;
      }>;
    }
  
    export interface PDFPageProxy {
      getViewport(options: { scale: number }): PDFPageViewport;
      render(renderContext: {
        canvasContext: CanvasRenderingContext2D;
        viewport: PDFPageViewport;
      }): {
        promise: Promise<void>;
      };
    }
  
    export interface PDFPageViewport {
      width: number;
      height: number;
    }
  
    export interface GetDocumentParameters {
      data?: Uint8Array;
      url?: string;
      httpHeaders?: Record<string, string>;
      withCredentials?: boolean;
    }
  
    export function getDocument(
      src: GetDocumentParameters | Uint8Array | string
    ): {
      promise: Promise<PDFDocumentProxy>;
    };
  
    export const GlobalWorkerOptions: {
      workerSrc: string;
    };
  }
  
  // Global window interface extension
  declare global {
    interface Window {
      pdfjsLib: {
        getDocument: (src: any) => { promise: Promise<any> };
        GlobalWorkerOptions: {
          workerSrc: string;
        };
      };
    }
  }
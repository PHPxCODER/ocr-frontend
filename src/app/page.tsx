'use client'
import React from 'react'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react'
import useSWR from 'swr'
import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

// Job Status Enum matching backend
enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing", 
  PDF_PROCESSED = "pdf_processed",
  COUNTING = "counting",
  COMPLETED = "completed",
  FAILED = "failed"
}

// API Response Types
interface JobResponse {
  job_id: string;
  status: JobStatus;
  created_at: string;
  message: string;
}

interface JobResult {
  job_id: string;
  status: JobStatus;
  created_at: string;
  completed_at?: string;
  detected_pdf_url?: string;
  result?: {
    status: string;
    filename: string;
    detected_pdf_url: string;
    valve_counts: {
      total_detections: number;
      ball_valve_vb: number;
      check_valve_vc: number;
      gate_valve_vg: number;
      globe_valve_vgl: number;
      pcv: number;
      tcv: number;
      bdv: number;
      sdv: number;
      fcv: number;
      psv: number;
      lcv: number;
    };
    valve_sizes: Array<{
      size_inches: string;
      valve_name: string;
      count: number;
    }>;
    processing_info: string;
  };
  error?: string;
}

// Processing Stage Info
interface ProcessingStage {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// SWR Fetcher function
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Custom hooks for API calls
const useJobStatus = (jobId: string | null, interval: number = 2000) => {
  const { data, error, isLoading } = useSWR(
    jobId ? `${API_BASE_URL}/jobs/${jobId}` : null,
    fetcher,
    {
      refreshInterval: interval,
      revalidateOnFocus: false,
    }
  );
  
  return {
    job: data as JobResult | undefined,
    isLoading,
    error
  };
};

// Helper function to upload file
const uploadFile = async (file: File): Promise<JobResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/detect-valves`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  
  return response.json();
};

// Helper function to convert valve sizes to CSV and download
const downloadValveSizeReport = (valveSizes: Array<{size_inches: string; valve_name: string; count: number}>, jobId: string) => {
  // Create CSV headers
  const headers = ['size_inches', 'valve_name', 'count'];
  
  // Convert data to CSV rows
  const csvRows = [
    headers.join(','), // Header row
    ...valveSizes.map(valve => [
      valve.size_inches,
      valve.valve_name,
      valve.count.toString()
    ].join(','))
  ];
  
  // Join all rows with newlines
  const csvContent = csvRows.join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `valve_size_report_${jobId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Helper function to get processing stages
const getProcessingStages = (currentStatus: JobStatus): ProcessingStage[] => {
  const stages: ProcessingStage[] = [
    {
      id: 'upload',
      title: 'PDF Upload',
      description: 'Uploading and validating PDF file',
      status: 'completed'
    },
    {
      id: "pdf_processed",
      title: "PDF Processed",
      description: "Processing PDF for valve detection",
      status: 'pending'
    },
    {
      id: 'detection',
      title: 'Valve Detection',
      description: 'Detecting valves in PDF pages',
      status: 'pending'
    }
  ];

  // Update stages based on current status
  switch (currentStatus) {
    case JobStatus.PENDING:
    case JobStatus.PROCESSING:
      stages[1].status = 'active';
      break;
    case JobStatus.PDF_PROCESSED:
      stages[1].status = 'completed';
      stages[2].status = 'active';
      break;
    case JobStatus.COUNTING:
      stages[1].status = 'completed';
      stages[2].status = 'active';
      break;
    case JobStatus.COMPLETED:
      stages[1].status = 'completed';
      stages[2].status = 'completed';
      break;
    case JobStatus.FAILED:
      stages[1].status = 'error';
      break;
    default:
      break;
  }

  return stages;
};

// Helper function to check if detected PDF is available
const isDetectedPdfAvailable = (job: JobResult | undefined): boolean => {
  if (!job) return false;
  return (job.status === JobStatus.PDF_PROCESSED || 
          job.status === JobStatus.COUNTING || 
          job.status === JobStatus.COMPLETED) && 
         !!job.detected_pdf_url;
};

// Helper function to check if valve counts are available
const areValveCountsAvailable = (job: JobResult | undefined): boolean => {
  if (!job) return false;
  return job.status === JobStatus.COMPLETED && !!job.result?.valve_counts;
};

export default function PDFViewerPage() {
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string>('N/A');
  const [hasShownDetectedPdf, setHasShownDetectedPdf] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use SWR to fetch job status
  const { job, isLoading: jobIsLoading, error: jobError } = useJobStatus(currentJobId);

  // Initialize default layout plugin with custom toolbar
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
    renderToolbar: (Toolbar) => (
      <Toolbar>
        {(slots) => {
          const {
            CurrentPageInput,
            Download,
            EnterFullScreen,
            GoToNextPage,
            GoToPreviousPage,
            NumberOfPages,
            Print,
            ShowSearchPopover,
            Zoom,
            ZoomIn,
            ZoomOut,
          } = slots;
          return (
            <div className="flex items-center justify-between w-full p-2 bg-gray-50 border-b">
              {/* Left side - Navigation */}
              <div className="flex items-center gap-2">
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50 [&>button]:disabled:opacity-50">
                  <GoToPreviousPage />
                </div>
                
                <div className="flex items-center gap-1 text-sm">
                  <CurrentPageInput />
                  <span>of</span>
                  <NumberOfPages />
                </div>
                
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50 [&>button]:disabled:opacity-50">
                  <GoToNextPage />
                </div>
              </div>

              {/* Center - Zoom controls */}
              <div className="flex items-center gap-2">
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50">
                  <ZoomOut />
                </div>
                
                <Zoom>
                  {(props) => (
                    <select
                      className="px-2 py-1 text-sm border rounded bg-white"
                      value={props.scale}
                      onChange={(e) => props.onZoom(parseFloat(e.target.value))}
                    >
                      <option value="0.5">50%</option>
                      <option value="0.75">75%</option>
                      <option value="1">100%</option>
                      <option value="1.25">125%</option>
                      <option value="1.5">150%</option>
                      <option value="2">200%</option>
                    </select>
                  )}
                </Zoom>
                
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50">
                  <ZoomIn />
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-2">
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50">
                  <ShowSearchPopover />
                </div>
                
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50">
                  <Download />
                </div>
                
                <div className="[&>button]:px-2 [&>button]:py-1 [&>button]:text-sm [&>button]:border [&>button]:rounded [&>button]:bg-white [&>button]:hover:bg-gray-50">
                  <EnterFullScreen />
                </div>
              </div>
            </div>
          );
        }}
      </Toolbar>
    ),
  });

  // Get processing stages
  const processingStages = job ? getProcessingStages(job.status) : [];

  // Helper function to convert File to URL
  const fileToUrl = (file: File): string => {
    return URL.createObjectURL(file);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      setUploadError('Please upload a valid PDF file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setHasShownDetectedPdf(false);
    
    try {
      // First load the original PDF for preview
      const fileUrl = fileToUrl(file);
      setCurrentPdfUrl(fileUrl);
      setFileName(file.name);
      
      // Then upload to backend for processing
      const jobResponse = await uploadFile(file);
      setCurrentJobId(jobResponse.job_id);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Handler for downloading valve size report
  const handleDownloadValveSizeReport = () => {
    if (job && job.result?.valve_sizes && areValveCountsAvailable(job)) {
      downloadValveSizeReport(job.result.valve_sizes, job.job_id);
    }
  };

  // Update PDF URL when detected PDF becomes available
  React.useEffect(() => {
    if (job && isDetectedPdfAvailable(job) && !hasShownDetectedPdf) {
      if (job.detected_pdf_url && currentPdfUrl !== job.detected_pdf_url) {
        setCurrentPdfUrl(job.detected_pdf_url);
        setFileName(`Detected_${job.job_id}.pdf`);
        setHasShownDetectedPdf(true);
      }
    }
  }, [job?.detected_pdf_url, job?.status, currentPdfUrl, hasShownDetectedPdf]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg">
        <nav className="container mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="text-xl lg:text-2xl font-bold bg-white/10 rounded-md px-3 py-1 backdrop-blur-sm">
            NRGTech
          </div>
          <div className="text-lg lg:text-2xl font-semibold text-center">
            AUTOMATED P&ID PARTS COUNT
          </div>
          <ul className="flex space-x-4 lg:space-x-6 text-sm lg:text-lg">
            <li><a href="#" className="hover:text-blue-200 transition-colors">Home</a></li>
            <li><a href="#" className="hover:text-blue-200 transition-colors">About</a></li>
            <li><a href="#" className="hover:text-blue-200 transition-colors">Contact</a></li>
          </ul>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden fixed top-20 left-4 z-50"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? 'Hide' : 'Show'} Tools
        </Button>

        {/* Left Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:relative z-40 lg:z-auto
          w-80 lg:w-72 xl:w-80 
          h-full lg:h-auto
          bg-white lg:bg-transparent
          transition-transform duration-300 ease-in-out
          flex-shrink-0
          p-4 lg:p-0 lg:mr-6
          overflow-hidden
        `}>
          {/* Backdrop for mobile */}
          {sidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 -z-10"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          <Card className="h-full shadow-lg flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-center text-gray-700 flex justify-between items-center">
                PDF Tools
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-6">
              {/* Upload Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-500 hover:bg-blue-600 transition-all duration-300 transform hover:scale-105"
                  size="lg"
                  disabled={isUploading}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload PDF'}
                </Button>
                {uploadError && (
                  <Alert className="mt-2" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Processing Stages */}
              {currentJobId && processingStages.length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Processing Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {processingStages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div className="relative">
                          {stage.status === 'completed' && (
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          )}
                          {stage.status === 'active' && (
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          )}
                          {stage.status === 'pending' && (
                            <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                          )}
                          {stage.status === 'error' && (
                            <AlertCircle className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{stage.title}</div>
                          <div className="text-xs text-gray-600 line-clamp-2">{stage.description}</div>
                        </div>
                        <Badge variant={
                          stage.status === 'completed' ? 'default' :
                          stage.status === 'active' ? 'secondary' :
                          stage.status === 'error' ? 'destructive' : 'outline'
                        }>
                          {stage.status === 'active' ? 'Processing' : stage.status}
                        </Badge>
                      </div>
                    ))}
                    
                    {/* Job Status Info */}
                    {job && (
                      <div className="pt-2 border-t border-blue-200">
                        <div className="text-xs text-gray-600 truncate">
                          Job ID: {job.job_id}
                        </div>
                        {job.status === JobStatus.FAILED && job.error && (
                          <Alert className="mt-2" variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{job.error}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Detected PDF Download - Available as soon as PDF is processed */}
              {isDetectedPdfAvailable(job) && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                      <FileText className="w-5 h-5" />
                      Detected PDF Ready
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-600 mb-3">
                      Valve detection complete! Download the annotated PDF with detected valves highlighted.
                    </p>
                    <Button
                      variant="default"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => job?.detected_pdf_url && window.open(job.detected_pdf_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Detected PDF
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Valve Size Report - Only available when counting is complete */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600 flex items-center justify-between">
                  <span>Valve Size Report:</span>
                  {areValveCountsAvailable(job) && (
                    <Badge variant="default">Ready</Badge>
                  )}
                  {job && job.status === JobStatus.COUNTING && (
                    <Badge variant="secondary">Processing...</Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!areValveCountsAvailable(job)}
                  onClick={handleDownloadValveSizeReport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Valve Size Report
                </Button>
              </div>

              {/* Metadata */}
              <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Metadata:</span>
                    {areValveCountsAvailable(job) && (
                      <Badge variant="default" className="text-xs">Updated</Badge>
                    )}
                    {job && (job.status === JobStatus.COUNTING || job.status === JobStatus.PDF_PROCESSED) && !areValveCountsAvailable(job) && (
                      <Badge variant="secondary" className="text-xs">Counting...</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {/* Valve Counts - Show when available */}
                  {job && areValveCountsAvailable(job) && job.result?.valve_counts && (
                    <div>
                      <strong>Total Valve Count: {job.result.valve_counts.total_detections}</strong>
                      <div className="ml-4 space-y-1 text-xs grid grid-cols-2 gap-1">
                        <div>Total VB: {job.result.valve_counts.ball_valve_vb}</div>
                        <div>Total VC: {job.result.valve_counts.check_valve_vc}</div>
                        <div>Total VG: {job.result.valve_counts.gate_valve_vg}</div>
                        <div>Total VGL: {job.result.valve_counts.globe_valve_vgl}</div>
                        <div>Total PSV: {job.result.valve_counts.psv}</div>
                        <div>Total PCV: {job.result.valve_counts.pcv}</div>
                        <div>Total FCV: {job.result.valve_counts.fcv}</div>
                        <div>Total BDV: {job.result.valve_counts.bdv}</div>
                        <div>Total LCV: {job.result.valve_counts.lcv}</div>
                        <div>Total TCV: {job.result.valve_counts.tcv}</div>
                        <div>Total SDV: {job.result.valve_counts.sdv}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show processing message when counting */}
                  {job && (job.status === JobStatus.COUNTING || job.status === JobStatus.PDF_PROCESSED) && !areValveCountsAvailable(job) && (
                    <div>
                      <strong>Valve counting in progress...</strong>
                      <div className="ml-4 space-y-1 text-xs text-gray-500">
                        <div>Analyzing detected valves</div>
                        <div>Calculating sizes and counts</div>
                        <div>Results will appear here when ready</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Default metadata when no job */}
                  {!job && (
                    <div>
                      <strong>Total Valve Count:</strong>
                      <div className="ml-4 space-y-1 grid grid-cols-2 gap-1 text-xs">
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
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </aside>

        {/* PDF Viewer */}
        <section className={`
          flex-1 
          ${sidebarOpen ? 'ml-0 lg:ml-0' : 'ml-0'}
          transition-all duration-300
          p-4 lg:p-0 lg:pr-4
        `}>
          <Card className="h-full shadow-lg flex flex-col">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="flex-1 rounded-lg border border-gray-300 bg-white overflow-hidden">
                {currentPdfUrl ? (
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.js">
                    <div className="h-full">
                      <Viewer 
                        fileUrl={currentPdfUrl} 
                        plugins={[defaultLayoutPluginInstance]}
                      />
                    </div>
                  </Worker>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-500 p-4">
                      <Upload className="w-12 lg:w-16 h-12 lg:h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Upload a PDF to start valve detection</p>
                      <p className="text-sm">Supported format: PDF files</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
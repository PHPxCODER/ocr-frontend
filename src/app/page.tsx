'use client'
import React from 'react'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { Viewer, Worker } from '@react-pdf-viewer/core'
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
    processing_info: any;
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
      id: 'detection',
      title: 'Valve Detection',
      description: 'Detecting valves in PDF pages',
      status: 'pending'
    },
    {
      id: 'counting',
      title: 'Valve Analysis',
      description: 'Counting and sizing valves',
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

export default function PDFViewerPage() {
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string>('N/A');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use SWR to fetch job status
  const { job, isLoading: jobIsLoading, error: jobError } = useJobStatus(currentJobId);

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

  // Update PDF URL when processing is complete
  React.useEffect(() => {
    if (job && job.detected_pdf_url && job.status !== JobStatus.PENDING) {
      const shouldLoadPDF = job.status === JobStatus.PDF_PROCESSED || 
                           job.status === JobStatus.COUNTING || 
                           job.status === JobStatus.COMPLETED;
      
      if (shouldLoadPDF && job.detected_pdf_url && currentPdfUrl !== job.detected_pdf_url) {
        setCurrentPdfUrl(job.detected_pdf_url);
        setFileName(`Detected_${job.job_id}.pdf`);
      }
    }
  }, [job?.detected_pdf_url, job?.status, currentPdfUrl]);

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
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{stage.title}</div>
                          <div className="text-xs text-gray-600">{stage.description}</div>
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
                        <div className="text-xs text-gray-600">
                          Job ID: {job.job_id}
                        </div>
                        {job.status === JobStatus.FAILED && job.error && (
                          <Alert className="mt-2" variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{job.error}</AlertDescription>
                          </Alert>
                        )}
                        {job.detected_pdf_url && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(job.detected_pdf_url, '_blank')}
                              className="w-full"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Detected PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Detect & Sizes Section */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!job || job.status !== JobStatus.COMPLETED}
                >
                  Detect Valve & Sizes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!job?.detected_pdf_url}
                  onClick={() => job?.detected_pdf_url && window.open(job.detected_pdf_url, '_blank')}
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
                disabled={!job || job.status !== JobStatus.COMPLETED || !job.result}
              >
                Download Valve Size Report
              </Button>

              {/* Metadata */}
              <Card className="flex-1 bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Metadata:</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {/* Valve Counts */}
                  {job?.result?.valve_counts && (
                    <div>
                      <strong>Total Valve Count: {job.result.valve_counts.total_detections}</strong>
                      <div className="ml-4 space-y-1 text-xs">
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
                  
                  {/* Default metadata when no job */}
                  {!job && (
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
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </aside>

        {/* PDF Viewer */}
        <section className="flex-1">
          <Card className="h-full shadow-lg">
            <CardContent className="p-6 h-full">
              <div className="h-full rounded-lg border border-gray-300 bg-white">
                {currentPdfUrl ? (
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.js">
                    <div className="h-full">
                      <Viewer fileUrl={currentPdfUrl} />
                    </div>
                  </Worker>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
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
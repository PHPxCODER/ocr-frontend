'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  ArrowLeft,
  RefreshCw,
  Home
} from 'lucide-react'
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
  progress: number;
}

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// SWR Fetcher function
const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

// Custom hook for job status with error handling
const useJobStatus = (jobId: string, interval: number = 2000) => {
  const { data, error, isLoading, mutate } = useSWR(
    jobId ? `${API_BASE_URL}/jobs/${jobId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        // Stop polling if job is completed or failed
        if (data?.status === JobStatus.COMPLETED || data?.status === JobStatus.FAILED) {
          return 0;
        }
        return interval;
      },
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );
  
  return {
    job: data as JobResult | undefined,
    isLoading,
    error,
    refetch: mutate
  };
};

// Helper function to download valve sizes as CSV
const downloadValveSizeReport = (valveSizes: Array<{size_inches: string; valve_name: string; count: number}>, jobId: string) => {
  const headers = ['size_inches', 'valve_name', 'count'];
  const csvRows = [
    headers.join(','),
    ...valveSizes.map(valve => [
      valve.size_inches,
      valve.valve_name,
      valve.count.toString()
    ].join(','))
  ];
  
  const csvContent = csvRows.join('\n');
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
    URL.revokeObjectURL(url);
  }
};

// Helper function to get processing stages with progress
const getProcessingStages = (currentStatus: JobStatus): ProcessingStage[] => {
  const stages: ProcessingStage[] = [
    {
      id: 'upload',
      title: 'PDF Upload',
      description: 'File uploaded and validated successfully',
      status: 'completed',
      progress: 100
    },
    {
      id: 'processing',
      title: 'PDF Processing',
      description: 'Analyzing PDF structure and extracting pages',
      status: 'pending',
      progress: 0
    },
    {
      id: 'detection',
      title: 'Valve Detection',
      description: 'AI models detecting and classifying valves',
      status: 'pending',
      progress: 0
    },
    {
      id: 'counting',
      title: 'Counting & Analysis',
      description: 'Counting valves by type and generating reports',
      status: 'pending',
      progress: 0
    }
  ];

  // Update stages based on current status
  switch (currentStatus) {
    case JobStatus.PENDING:
      stages[1].status = 'active';
      stages[1].progress = 25;
      break;
    case JobStatus.PROCESSING:
      stages[1].status = 'active';
      stages[1].progress = 75;
      break;
    case JobStatus.PDF_PROCESSED:
      stages[1].status = 'completed';
      stages[1].progress = 100;
      stages[2].status = 'active';
      stages[2].progress = 50;
      break;
    case JobStatus.COUNTING:
      stages[1].status = 'completed';
      stages[1].progress = 100;
      stages[2].status = 'completed';
      stages[2].progress = 100;
      stages[3].status = 'active';
      stages[3].progress = 75;
      break;
    case JobStatus.COMPLETED:
      stages.forEach(stage => {
        stage.status = 'completed';
        stage.progress = 100;
      });
      break;
    case JobStatus.FAILED:
      stages[1].status = 'error';
      break;
    default:
      break;
  }

  return stages;
};

// Calculate overall progress
const calculateOverallProgress = (stages: ProcessingStage[]): number => {
  const totalProgress = stages.reduce((sum, stage) => sum + stage.progress, 0);
  return Math.round(totalProgress / stages.length);
};

// Helper functions for status checks
const isDetectedPdfAvailable = (job: JobResult | undefined): boolean => {
  if (!job) return false;
  return (job.status === JobStatus.PDF_PROCESSED || 
          job.status === JobStatus.COUNTING || 
          job.status === JobStatus.COMPLETED) && 
         !!job.detected_pdf_url;
};

const areValveCountsAvailable = (job: JobResult | undefined): boolean => {
  if (!job) return false;
  return job.status === JobStatus.COMPLETED && !!job.result?.valve_counts;
};

// Format date helper
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export default function JobProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.slug as string;
  
  const [showDetectedPdf, setShowDetectedPdf] = useState(false);
  
  // Fetch job status
  const { job, isLoading, error, refetch } = useJobStatus(jobId);
  
  // Get processing stages and overall progress
  const processingStages = job ? getProcessingStages(job.status) : [];
  const overallProgress = calculateOverallProgress(processingStages);
  
  // Initialize PDF viewer plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
  });

  // Auto-show detected PDF when available
  useEffect(() => {
    if (isDetectedPdfAvailable(job) && !showDetectedPdf) {
      setShowDetectedPdf(true);
    }
  }, [job?.status, job?.detected_pdf_url, showDetectedPdf]);

  // Handle download valve size report
  const handleDownloadValveSizeReport = () => {
    if (job?.result?.valve_sizes && areValveCountsAvailable(job)) {
      downloadValveSizeReport(job.result.valve_sizes, job.job_id);
    }
  };

  // Loading state
  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold">NRGTech - Processing Status</h1>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading job status...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
          <div className="container mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold">NRGTech - Processing Status</h1>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message.includes('404') 
                ? `Job with ID "${jobId}" was not found. Please check the job ID and try again.`
                : `Failed to load job status: ${error.message}`
              }
            </AlertDescription>
          </Alert>
          <div className="text-center mt-6">
            <Button onClick={() => refetch()} className="mr-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={() => router.push('/')}>
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Job not found
  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
          <div className="container mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold">NRGTech - Processing Status</h1>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <Alert className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No job found with ID: {jobId}
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Processing Status</h1>
              <p className="text-blue-100 text-sm">Job ID: {jobId}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm">
              Status: <Badge variant={job.status === JobStatus.COMPLETED ? 'default' : 
                              job.status === JobStatus.FAILED ? 'destructive' : 'secondary'}>
                {job.status}
              </Badge>
            </div>
            <div className="text-xs text-blue-100 mt-1">
              Started: {formatDate(job.created_at)}
            </div>
            {job.completed_at && (
              <div className="text-xs text-blue-100">
                Completed: {formatDate(job.completed_at)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Processing Status Sidebar */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Processing Progress
                </CardTitle>
                <div className="space-y-2">
                  <Progress value={overallProgress} className="h-3" />
                  <p className="text-sm text-gray-600">{overallProgress}% Complete</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingStages.map((stage, index) => (
                  <div key={stage.id} className="space-y-2">
                    <div className="flex items-center gap-3">
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
                    </div>
                    {stage.status === 'active' && (
                      <Progress value={stage.progress} className="h-2 ml-9" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Error Display */}
            {job.status === JobStatus.FAILED && job.error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Processing Failed:</strong><br />
                  {job.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Downloads Section */}
            <Card>
              <CardHeader>
                <CardTitle>Downloads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Detected PDF Download */}
                {isDetectedPdfAvailable(job) && (
                  <div>
                    <Button
                      variant="default"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => job.detected_pdf_url && window.open(job.detected_pdf_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Detected PDF
                    </Button>
                    <p className="text-xs text-gray-600 mt-1">
                      PDF with valve detections highlighted
                    </p>
                  </div>
                )}

                {/* Valve Size Report */}
                <div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={!areValveCountsAvailable(job)}
                    onClick={handleDownloadValveSizeReport}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Valve Size Report
                  </Button>
                  <p className="text-xs text-gray-600 mt-1">
                    {areValveCountsAvailable(job) ? 'CSV report ready' : 'Report will be available when processing completes'}
                  </p>
                </div>

                {/* Show Detected PDF Toggle */}
                {isDetectedPdfAvailable(job) && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShowDetectedPdf(!showDetectedPdf)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {showDetectedPdf ? 'Show Original PDF' : 'Show Detected PDF'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Valve Counts Results */}
            {areValveCountsAvailable(job) && job.result?.valve_counts && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Valve Detection Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg border">
                      <div className="text-2xl font-bold text-blue-600">
                        {job.result.valve_counts.total_detections}
                      </div>
                      <div className="text-sm text-gray-600">Total Valves</div>
                    </div>
                    
                    {Object.entries(job.result.valve_counts)
                      .filter(([key]) => key !== 'total_detections')
                      .map(([key, value]) => (
                        <div key={key} className="text-center p-3 bg-gray-50 rounded-lg border">
                          <div className="text-xl font-semibold">{value}</div>
                          <div className="text-xs text-gray-600 uppercase">
                            {key.replace('_', ' ').replace('valve', '').trim()}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PDF Viewer */}
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                {(showDetectedPdf && job.detected_pdf_url) ? (
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.js">
                    <div className="h-full">
                      <Viewer 
                        fileUrl={job.detected_pdf_url} 
                        plugins={[defaultLayoutPluginInstance]}
                      />
                    </div>
                  </Worker>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-500 p-4">
                      {job.status === JobStatus.COMPLETED ? (
                        <>
                          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg">Processing Complete!</p>
                          <p className="text-sm">Use the buttons above to download results or view the detected PDF.</p>
                        </>
                      ) : job.status === JobStatus.FAILED ? (
                        <>
                          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                          <p className="text-lg">Processing Failed</p>
                          <p className="text-sm">Please check the error message and try uploading again.</p>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-16 h-16 mx-auto mb-4 opacity-50 animate-spin" />
                          <p className="text-lg">Processing in Progress</p>
                          <p className="text-sm">Your PDF is being analyzed for valve detection...</p>
                        </>
                      )}
                    </div>
                </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
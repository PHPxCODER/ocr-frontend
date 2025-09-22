'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  RefreshCw,
  AlertCircle,
  FileText,
  Home,
  X,
  StopCircle
} from 'lucide-react'
import useSWR from 'swr'
import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

// Components
import Header from '@/components/Header'
import ProcessingStages from '@/components/ProcessingStages'
import DownloadsSection from '@/components/DownloadsSection'
import ValveResults from '@/components/ValveResults'
import AuthPage from '@/components/AuthPage'

// Job Status Enum matching backend
enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing", 
  PDF_PROCESSED = "pdf_processed",
  COUNTING = "counting",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
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

// Cancel Response Type
interface CancelResponse {
  job_id: string;
  message: string;
  previous_status: string;
  cancelled_at: string;
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
        // Stop polling if job is completed, failed, or cancelled
        if (data?.status === JobStatus.COMPLETED || 
            data?.status === JobStatus.FAILED || 
            data?.status === JobStatus.CANCELLED) {
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

// Function to cancel a job
const cancelJob = async (jobId: string): Promise<CancelResponse> => {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Cancel failed: ${response.statusText}`);
  }
  
  return response.json();
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

// Check if job can be cancelled
const isJobCancellable = (job: JobResult | undefined): boolean => {
  if (!job) return false;
  const cancellableStatuses = [JobStatus.PENDING, JobStatus.PROCESSING, JobStatus.PDF_PROCESSED, JobStatus.COUNTING];
  return cancellableStatuses.includes(job.status);
};

// Format date helper
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

// Helper function to capitalize status
const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
};

export default function JobProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const jobId = params.slug as string;
  
  const [showDetectedPdf, setShowDetectedPdf] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  
  // Fetch job status
  const { job, isLoading, error, refetch } = useJobStatus(jobId);
  
  // Initialize PDF viewer plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
  });

  // Auto-show detected PDF when available
  useEffect(() => {
    if (isDetectedPdfAvailable(job) && !showDetectedPdf) {
      setShowDetectedPdf(true);
    }
  }, [job, showDetectedPdf]);

  // Show loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!session) {
    return <AuthPage />;
  }

  // Handle job cancellation
  const handleCancelJob = async () => {
    if (!job || !isJobCancellable(job)) return;
    
    setIsCancelling(true);
    setCancelError(null);
    
    try {
      await cancelJob(job.job_id);
      // Refetch job status to update UI
      await refetch();
    } catch (error) {
      console.error('Error cancelling job:', error);
      setCancelError(error instanceof Error ? error.message : 'Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  // Loading state
  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Header 
          showBackButton 
          onBackClick={() => router.push('/')} 
          title="Processing Status" 
        />
        <main className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading job status...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Header 
          showBackButton 
          onBackClick={() => router.push('/')} 
          title="Processing Status" 
        />
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
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Header 
          showBackButton 
          onBackClick={() => router.push('/')} 
          title="Processing Status" 
        />
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
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {/* Header */}
      <Header 
        showBackButton 
        onBackClick={() => router.push('/')} 
        title="Processing Status" 
        subtitle={`Job ID: ${jobId}`} 
      />

      {/* Status Bar */}
      <div className="bg-muted/30 border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm flex items-center gap-2">
              Status: <Badge variant={
                job.status === JobStatus.COMPLETED ? 'default' : 
                job.status === JobStatus.FAILED ? 'destructive' : 
                job.status === JobStatus.CANCELLED ? 'destructive' : 
                'secondary'
              }>
                {capitalizeStatus(job.status)}
              </Badge>
              
              {/* Cancel Button */}
              {isJobCancellable(job) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelJob}
                  disabled={isCancelling}
                  className="ml-2"
                >
                  {isCancelling ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <StopCircle className="w-3 h-3 mr-1" />
                      Cancel Job
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              Started: {formatDate(job.created_at)}
            </div>
            {job.completed_at && (
              <div className="text-xs text-muted-foreground">
                {job.status === JobStatus.CANCELLED ? 'Cancelled' : 'Completed'}: {formatDate(job.completed_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Processing Status Sidebar */}
          <div className="lg:col-span-1">
            <ProcessingStages currentStatus={job.status} />

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

            {/* Cancelled Display */}
            {job.status === JobStatus.CANCELLED && (
              <Alert variant="destructive" className="mb-6">
                <X className="h-4 w-4" />
                <AlertDescription>
                  <strong>Job Cancelled:</strong><br />
                  {job.error || 'The job was cancelled before completion.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Cancel Error Display */}
            {cancelError && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cancel Failed:</strong><br />
                  {cancelError}
                </AlertDescription>
              </Alert>
            )}

            <DownloadsSection 
              job={job}
              onTogglePdfView={() => setShowDetectedPdf(!showDetectedPdf)}
              showingDetectedPdf={showDetectedPdf}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* PDF Viewer */}
            <Card className="h-[600px] mb-6">
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
                    <div className="text-center text-muted-foreground p-4">
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
                      ) : job.status === JobStatus.CANCELLED ? (
                        <>
                          <X className="w-16 h-16 mx-auto mb-4 text-red-400" />
                          <p className="text-lg">Job Cancelled</p>
                          <p className="text-sm">The processing was cancelled before completion.</p>
                          {isDetectedPdfAvailable(job) && (
                            <p className="text-sm mt-2">Partial results may be available for download above.</p>
                          )}
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

            {/* Valve Counts Results */}
            {areValveCountsAvailable(job) && job.result?.valve_counts && (
              <ValveResults valveCounts={job.result.valve_counts} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
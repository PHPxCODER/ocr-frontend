import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, FileText } from 'lucide-react'

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

interface DownloadsSectionProps {
  job: JobResult;
  onTogglePdfView: () => void;
  showingDetectedPdf: boolean;
}

// Helper functions for status checks
const isDetectedPdfAvailable = (job: JobResult): boolean => {
  return (job.status === JobStatus.PDF_PROCESSED || 
          job.status === JobStatus.COUNTING || 
          job.status === JobStatus.COMPLETED) && 
         !!job.detected_pdf_url;
};

const areValveCountsAvailable = (job: JobResult): boolean => {
  return job.status === JobStatus.COMPLETED && !!job.result?.valve_counts;
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

export default function DownloadsSection({ job, onTogglePdfView, showingDetectedPdf }: DownloadsSectionProps) {
  const handleDownloadValveSizeReport = () => {
    if (job.result?.valve_sizes && areValveCountsAvailable(job)) {
      downloadValveSizeReport(job.result.valve_sizes, job.job_id);
    }
  };

  return (
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
              className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              onClick={() => job.detected_pdf_url && window.open(job.detected_pdf_url, '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Detected PDF
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
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
          <p className="text-xs text-muted-foreground mt-1">
            {areValveCountsAvailable(job) ? 'CSV report ready' : 
             job.status === JobStatus.CANCELLED ? 'Report not available (job cancelled)' :
             'Report will be available when processing completes'}
          </p>
        </div>

        {/* Show Detected PDF Toggle */}
        {isDetectedPdfAvailable(job) && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={onTogglePdfView}
          >
            <FileText className="w-4 h-4 mr-2" />
            {showingDetectedPdf ? 'Show Original PDF' : 'Show Detected PDF'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
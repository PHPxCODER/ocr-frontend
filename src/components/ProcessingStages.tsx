'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Clock, CheckCircle, AlertCircle, X } from 'lucide-react'

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

// Processing Stage Info
interface ProcessingStage {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'cancelled';
  progress: number;
}

interface ProcessingStagesProps {
  currentStatus: JobStatus;
}

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
    case JobStatus.CANCELLED:
      // Mark all stages as cancelled except upload
      stages.slice(1).forEach(stage => {
        if (stage.status === 'active') {
          stage.status = 'cancelled';
        } else if (stage.status === 'pending') {
          stage.status = 'cancelled';
          stage.progress = 0;
        }
      });
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

// Helper function to capitalize status
const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
};

export default function ProcessingStages({ currentStatus }: ProcessingStagesProps) {
  const processingStages = getProcessingStages(currentStatus);
  const overallProgress = calculateOverallProgress(processingStages);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {currentStatus === JobStatus.CANCELLED ? (
            <X className="w-5 h-5 text-red-500 dark:text-red-400" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          Processing Progress - {capitalizeStatus(currentStatus)}
        </CardTitle>
        <div className="space-y-2">
          <Progress value={overallProgress} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {currentStatus === JobStatus.CANCELLED ? 'Job Cancelled' : `${overallProgress}% Complete - ${capitalizeStatus(currentStatus)}`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {processingStages.map((stage) => (
          <div key={stage.id} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                {stage.status === 'completed' && (
                  <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400" />
                )}
                {stage.status === 'active' && (
                  <div className="w-6 h-6 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
                {stage.status === 'pending' && (
                  <div className="w-6 h-6 border-2 border-border rounded-full" />
                )}
                {stage.status === 'error' && (
                  <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
                )}
                {stage.status === 'cancelled' && (
                  <X className="w-6 h-6 text-red-500 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{stage.title}</div>
                <div className="text-xs text-muted-foreground">
                  {stage.status === 'cancelled' ? 'Cancelled' : stage.description}
                </div>
              </div>
            </div>
            {stage.status === 'active' && (
              <Progress value={stage.progress} className="h-2 ml-9" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
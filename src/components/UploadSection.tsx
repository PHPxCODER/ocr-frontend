'use client'
import React from 'react'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertCircle } from 'lucide-react'

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

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface UploadSectionProps {
  onUploadSuccess: (jobResponse: JobResponse) => void;
}

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

export default function UploadSection({ onUploadSuccess }: UploadSectionProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    
    try {
      // Upload to backend for processing
      const jobResponse = await uploadFile(file);
      onUploadSuccess(jobResponse);
      
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

    processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      if (!file.type.includes('pdf')) {
        setUploadError('Please upload a valid PDF file.');
        return;
      }

      processFile(file);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          Upload Your P&ID Drawing
        </CardTitle>
        <p className="text-muted-foreground mt-2">
          Supported format: PDF files up to 50MB
        </p>
      </CardHeader>
      <CardContent className="p-8">
        {/* Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragOver 
              ? 'border-primary bg-primary/5 dark:bg-primary/10' 
              : 'border-border hover:border-primary/50 dark:hover:border-primary/70'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
          
          <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-8 py-3 text-lg"
            size="lg"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Choose PDF File
              </>
            )}
          </Button>
          
          <p className="text-sm text-muted-foreground mt-4">
            Or drag and drop your PDF file here
          </p>
        </div>

        {/* Error Display */}
        {uploadError && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Features List */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <span className="text-sm text-foreground">Automatic valve detection</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <span className="text-sm text-foreground">Classification by type</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <span className="text-sm text-foreground">Size analysis</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <span className="text-sm text-foreground">Detailed CSV reports</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
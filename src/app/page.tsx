'use client'
import React from 'react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

export default function HomePage() {
  const router = useRouter();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Upload to backend for processing
      const jobResponse = await uploadFile(file);
      
      // Redirect to processing page with job ID
      router.push(`/${jobResponse.job_id}`);
      
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

  return (
    <div className="min-h-screen bg-gray-50">
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
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              AI-Powered P&ID Analysis
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Upload your P&ID drawings and get automated valve counting and classification 
              with our advanced AI detection system. Get detailed reports in minutes, not hours.
            </p>
          </div>

          {/* Upload Section */}
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-gray-800">
                Upload Your P&ID Drawing
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Supported format: PDF files up to 50MB
              </p>
            </CardHeader>
            <CardContent className="p-8">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
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
                
                <p className="text-sm text-gray-500 mt-4">
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
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Automatic valve detection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Classification by type</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Size analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Detailed CSV reports</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How It Works Section */}
          <div className="mt-16">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Upload</h3>
                <p className="text-gray-600">
                  Upload your P&ID PDF drawing to our secure platform
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Analyze</h3>
                <p className="text-gray-600">
                  Our AI analyzes your drawing and detects all valves automatically
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Download</h3>
                <p className="text-gray-600">
                  Get detailed reports and annotated PDFs with all valve data
                </p>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
              Why Choose NRGTech?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="font-semibold mb-2">Fast Processing</h3>
                <p className="text-sm text-gray-600">Get results in minutes, not hours of manual counting</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-semibold mb-2">High Accuracy</h3>
                <p className="text-sm text-gray-600">AI-powered detection with industry-leading precision</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="font-semibold mb-2">Detailed Reports</h3>
                <p className="text-sm text-gray-600">Comprehensive CSV reports for easy analysis</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🔒</div>
                <h3 className="font-semibold mb-2">Secure</h3>
                <p className="text-sm text-gray-600">Your data is protected with enterprise-grade security</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">💰</div>
                <h3 className="font-semibold mb-2">Cost Effective</h3>
                <p className="text-sm text-gray-600">Reduce manual labor costs and improve efficiency</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🔄</div>
                <h3 className="font-semibold mb-2">Easy Integration</h3>
                <p className="text-sm text-gray-600">Fits seamlessly into your existing workflow</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 NRGTech. All rights reserved. Automated P&ID Parts Count Solution.
          </p>
        </div>
      </footer>
    </div>
  );
}
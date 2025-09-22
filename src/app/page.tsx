'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Header from '@/components/Header'
import UploadSection from '@/components/UploadSection'
import AuthPage from '@/components/AuthPage'

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

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

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

  const handleUploadSuccess = (jobResponse: JobResponse) => {
    // Redirect to processing page with job ID
    router.push(`/${jobResponse.job_id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              AI-Powered P&ID Analysis
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Upload your P&ID drawings and get automated valve counting and classification 
              with our advanced AI detection system. Get detailed reports in minutes, not hours.
            </p>
          </div>

          {/* Upload Section */}
          <UploadSection onUploadSuccess={handleUploadSuccess} />

          {/* How It Works Section */}
          <div className="mt-16">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Upload</h3>
                <p className="text-muted-foreground">
                  Upload your P&ID PDF drawing to our secure platform
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Analyze</h3>
                <p className="text-muted-foreground">
                  Our AI analyzes your drawing and detects all valves automatically
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Download</h3>
                <p className="text-muted-foreground">
                  Get detailed reports and annotated PDFs with all valve data
                </p>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="mt-16 bg-card rounded-lg shadow-lg p-8 border">
            <h2 className="text-3xl font-bold text-center text-foreground mb-8">
              Why Choose NRGTech?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="font-semibold mb-2">Fast Processing</h3>
                <p className="text-sm text-muted-foreground">Get results in minutes, not hours of manual counting</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-semibold mb-2">High Accuracy</h3>
                <p className="text-sm text-muted-foreground">AI-powered detection with industry-leading precision</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="font-semibold mb-2">Detailed Reports</h3>
                <p className="text-sm text-muted-foreground">Comprehensive CSV reports for easy analysis</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🔒</div>
                <h3 className="font-semibold mb-2">Secure</h3>
                <p className="text-sm text-muted-foreground">Your data is protected with enterprise-grade security</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">💰</div>
                <h3 className="font-semibold mb-2">Cost Effective</h3>
                <p className="text-sm text-muted-foreground">Reduce manual labor costs and improve efficiency</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-3">🔄</div>
                <h3 className="font-semibold mb-2">Easy Integration</h3>
                <p className="text-sm text-muted-foreground">Fits seamlessly into your existing workflow</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted/50 dark:bg-muted/20 text-muted-foreground py-8 mt-16 border-t">
        <div className="container mx-auto px-4 text-center">
          <p>
            © 2024 NRGTech. All rights reserved. Automated P&ID Parts Count Solution.
          </p>
        </div>
      </footer>
    </div>
  );
}
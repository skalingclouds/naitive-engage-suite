"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Eye,
  Search,
  Download,
  Filter
} from "lucide-react";
import { toast } from "sonner";

interface Submission {
  id: string;
  workerName: string;
  employerName: string;
  city: string;
  state: string;
  zipCode: string;
  submissionDate: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  violations: Array<{
    type: string;
    description: string;
    confidence: number;
    severity: "low" | "medium" | "high";
    laborCode?: string;
  }>;
  metadata: {
    ocrService: string;
    processingTimestamp: string;
    processingTime: number;
  };
}

interface QAReview {
  submissionId: string;
  status: 'TP' | 'FP' | 'FN';
  notes?: string;
}

export default function InternalPortal() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/paystub/submissions?${params}`);
      const data = await response.json();

      setSubmissions(data.submissions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      toast.error("Failed to fetch submissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/paystub/submissions?id=${id}`);
      const submission = await response.json();
      setSelectedSubmission(submission);
    } catch (error) {
      toast.error("Failed to fetch submission details");
    }
  };

  const submitQAReview = async (review: QAReview) => {
    try {
      const response = await fetch('/api/paystub/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(review),
      });

      if (response.ok) {
        toast.success("QA review submitted successfully");
        fetchSubmissions(); // Refresh the list
      } else {
        toast.error("Failed to submit QA review");
      }
    } catch (error) {
      toast.error("Failed to submit QA review");
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [currentPage, statusFilter, searchTerm]);

  const getStatusIcon = (status: Submission['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: "destructive",
      medium: "secondary", 
      low: "outline"
    } as const;

    return (
      <Badge variant={variants[severity as keyof typeof variants] || "outline"}>
        {severity}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Internal Review Portal
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Pay Stub Violation Detection QA
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Admin Access
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Submissions Queue</h2>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, employer, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Submissions List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading submissions...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => fetchSubmissionDetails(submission.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(submission.status)}
                            <span className="font-medium text-sm">
                              {submission.workerName}
                            </span>
                            <span className="text-gray-500 text-sm">
                              • {submission.employerName}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{submission.city}, {submission.state}</span>
                            <span>{new Date(submission.submissionDate).toLocaleDateString()}</span>
                            <span className="font-medium">
                              {submission.violations.length} violations
                            </span>
                          </div>

                          {submission.violations.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {submission.violations.slice(0, 2).map((violation, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {violation.type}
                                </Badge>
                              ))}
                              {submission.violations.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{submission.violations.length - 2} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">
                            ID: {submission.id.substring(0, 8)}...
                          </div>
                          {submission.metadata.ocrService && (
                            <Badge variant="secondary" className="text-xs">
                              {submission.metadata.ocrService}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Detail View */}
          <div className="lg:col-span-1">
            {selectedSubmission ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Submission Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    Clear
                  </Button>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="violations">Violations</TabsTrigger>
                    <TabsTrigger value="qa">QA</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div>
                      <Label className="text-xs text-gray-500">Submission ID</Label>
                      <p className="text-sm font-mono">{selectedSubmission.id}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Worker</Label>
                      <p className="text-sm">{selectedSubmission.workerName}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Employer</Label>
                      <p className="text-sm">{selectedSubmission.employerName}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Location</Label>
                      <p className="text-sm">
                        {selectedSubmission.city}, {selectedSubmission.state} {selectedSubmission.zipCode}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Processing</Label>
                      <div className="space-y-1">
                        <p className="text-sm">
                          Service: {selectedSubmission.metadata.ocrService}
                        </p>
                        <p className="text-sm">
                          Time: {selectedSubmission.metadata.processingTime}ms
                        </p>
                        <p className="text-sm">
                          Completed: {new Date(selectedSubmission.metadata.processingTimestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Button className="w-full" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download Original Image
                    </Button>
                  </TabsContent>

                  <TabsContent value="violations" className="space-y-3">
                    {selectedSubmission.violations.length > 0 ? (
                      selectedSubmission.violations.map((violation, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{violation.type}</h4>
                            {getSeverityBadge(violation.severity)}
                          </div>
                          
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                            {violation.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                              Confidence: {Math.round(violation.confidence * 100)}%
                            </span>
                            {violation.laborCode && (
                              <span className="text-blue-600">
                                {violation.laborCode}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No violations detected</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="qa" className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">QA Review Status</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => submitQAReview({
                            submissionId: selectedSubmission.id,
                            status: 'TP',
                            notes: 'Confirmed violations'
                          })}
                        >
                          TP
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => submitQAReview({
                            submissionId: selectedSubmission.id,
                            status: 'FP',
                            notes: 'False positive'
                          })}
                        >
                          FP
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          onClick={() => submitQAReview({
                            submissionId: selectedSubmission.id,
                            status: 'FN',
                            notes: 'Missed violations'
                          })}
                        >
                          FN
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        TP: True Positive | FP: False Positive | FN: False Negative
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Notes</Label>
                      <textarea
                        className="w-full mt-1 p-2 border rounded-md text-sm"
                        rows={4}
                        placeholder="Add QA review notes..."
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    Select a submission to view details
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
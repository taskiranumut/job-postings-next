'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  processLLMOnce,
  resetLLMProcessing,
  getLLMStatus,
  getLLMLogs,
  updateAutoLLMProcessing,
  getProcessingStatus,
} from '@/lib/actions';
import {
  RefreshCw,
  Home,
  Zap,
  RotateCcw,
  ChevronDown,
  Loader2,
  Clock,
  AlertCircle,
} from 'lucide-react';

// Polling interval (ms)
const POLLING_INTERVAL = 5000;

export function LLMDashboardClient({
  initialStatus,
  initialLogs,
  initialSettings,
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [logs, setLogs] = useState(initialLogs);
  const [autoProcessing, setAutoProcessing] = useState(
    initialSettings?.auto_llm_processing ?? false
  );
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Processing status states
  const [processingStatus, setProcessingStatus] = useState({
    processing: [],
    pending_count: 0,
    failed_count: 0,
    is_processing: false,
  });

  const [isRefreshing, startRefresh] = useTransition();
  const [isProcessing, startProcess] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [isToggling, startToggle] = useTransition();

  const isLoading = isRefreshing || isProcessing || isResetting || isToggling;

  // Fetch processing status
  const fetchProcessingStatus = useCallback(async () => {
    try {
      const newProcessingStatus = await getProcessingStatus();
      setProcessingStatus(newProcessingStatus);
      return newProcessingStatus;
    } catch (err) {
      console.error('Processing status fetch error:', err);
      return null;
    }
  }, []);

  // Ref to track processing status
  const wasProcessingRef = useRef(processingStatus.is_processing);

  // Keep wasProcessingRef updated
  useEffect(() => {
    wasProcessingRef.current = processingStatus.is_processing;
  }, [processingStatus.is_processing]);

  // Polling: Check processing status at regular intervals
  useEffect(() => {
    let isMounted = true;

    // Initial load
    (async () => {
      if (isMounted) {
        await fetchProcessingStatus();
      }
    })();

    // Start polling
    const interval = setInterval(async () => {
      if (!isMounted) return;

      const newStatus = await fetchProcessingStatus();

      // If processing is complete, update main data as well
      if (newStatus && !newStatus.is_processing && wasProcessingRef.current) {
        // Processing finished, refresh data
        const [updatedStatus, updatedLogs] = await Promise.all([
          getLLMStatus(),
          getLLMLogs(20),
        ]);
        if (isMounted) {
          setStatus(updatedStatus);
          setLogs(updatedLogs);
        }
      }
    }, POLLING_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchProcessingStatus]);

  const fetchData = () => {
    startRefresh(async () => {
      try {
        const [newStatus, newLogs, newProcessingStatus] = await Promise.all([
          getLLMStatus(),
          getLLMLogs(20),
          getProcessingStatus(),
        ]);
        setStatus(newStatus);
        setLogs(newLogs);
        setProcessingStatus(newProcessingStatus);
      } catch (err) {
        console.error('Data fetch error:', err);
        toast.error('Error loading data.');
      }
    });
  };

  const handleProcessOnce = (limit = 5) => {
    startProcess(async () => {
      try {
        // Immediately show that processing started
        await fetchProcessingStatus();

        const result = await processLLMOnce(limit);

        if (result.total_selected === 0) {
          toast.info('No pending jobs found to process.');
        } else {
          const processedCount = result.total_success || 0;
          toast.success(
            `Process completed. ${processedCount}/${result.total_selected} jobs processed.`
          );
        }

        fetchData();
      } catch (err) {
        console.error('Process error:', err);
        toast.error(err.message || 'Error occurred during process.');
        await fetchProcessingStatus();
      }
    });
  };

  const handleResetAndProcess = () => {
    startReset(async () => {
      try {
        const resetData = await resetLLMProcessing();
        toast.info(`${resetData.count} jobs reset. Process starting...`);
        setResetModalOpen(false);

        // Process after reset
        await handleProcessOnce();
      } catch (err) {
        console.error('Reset error:', err);
        toast.error(err.message || 'Reset failed.');
      }
    });
  };

  const handleToggleAutoProcessing = (checked) => {
    startToggle(async () => {
      try {
        await updateAutoLLMProcessing(checked);
        setAutoProcessing(checked);
        toast.success(
          checked
            ? 'Auto processing enabled. Added jobs will be processed automatically.'
            : 'Auto processing disabled. Manual processing active.'
        );
      } catch (err) {
        console.error('Toggle error:', err);
        toast.error(err.message || 'Error updating settings.');
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          LLM Processing Panel
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw
              className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => setResetModalOpen(true)}
            disabled={isLoading}
            className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
          >
            <RotateCcw className="size-4" />
            Force Reprocess
          </Button>
          {/* Dropdown disabled when auto processing is on */}
          {autoProcessing ? (
            <Button disabled className="cursor-not-allowed opacity-50">
              <Zap className="size-4" />
              Auto Mode Active
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={
                    isLoading ||
                    processingStatus.is_processing ||
                    processingStatus.pending_count === 0
                  }
                >
                  <Zap className="size-4" />
                  {isProcessing || processingStatus.is_processing
                    ? 'Processing...'
                    : 'Process Now'}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[1, 5, 10, 20, 50].map((count) => (
                  <DropdownMenuItem key={count} asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleProcessOnce(count)}
                      disabled={isProcessing}
                    >
                      Process {count}
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Auto Processing Toggle Card */}
      <Card className="mb-4">
        <CardContent className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-semibold">
              Auto Job Processing
            </Label>
            <p className="text-sm text-muted-foreground">
              {autoProcessing
                ? 'Added jobs are automatically processed by LLM.'
                : 'Manual mode active. You can process jobs with "Process Now" button.'}
            </p>
          </div>
          <Switch
            id="auto-processing"
            checked={autoProcessing}
            onCheckedChange={handleToggleAutoProcessing}
            disabled={isToggling}
          />
        </CardContent>
      </Card>

      {/* Active Processing Status Card */}
      {(processingStatus.is_processing || isProcessing) && (
        <Card className="mb-4 border-blue-500/50 bg-blue-500/5">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/20">
                <Loader2 className="size-5 animate-spin text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-400">Processing...</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jobs are being processed, please wait...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Status - Pending & Failed */}
      {(processingStatus.pending_count > 0 ||
        processingStatus.failed_count > 0) &&
        !processingStatus.is_processing &&
        !isProcessing && (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                {processingStatus.pending_count > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-500" />
                    <span className="text-sm">
                      <span className="font-semibold text-amber-500">
                        {processingStatus.pending_count}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        jobs pending
                      </span>
                    </span>
                  </div>
                )}
                {processingStatus.failed_count > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-red-500" />
                    <span className="text-sm">
                      <span className="font-semibold text-red-500">
                        {processingStatus.failed_count}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        jobs failed
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Stats Cards - İlan Durumu */}
      {status && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                Total Jobs
              </p>
              <p className="mt-1 text-3xl font-bold">{status.total_postings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                Processed
              </p>
              <p className="mt-1 text-3xl font-bold text-green-500">
                {status.total_processed}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                Pending
              </p>
              <p className="mt-1 text-3xl font-bold text-orange-500">
                {status.total_pending}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards - İşlem İstatistikleri */}
      {status?.stats && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-blue-400">
                Today
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.today.count} processed
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Avg: {(status.stats.today.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.today.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.today.errorCount} errors
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-purple-400">
                This Week
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.week.count} processed
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Avg: {(status.stats.week.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.week.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.week.errorCount} errors
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-emerald-400">
                Total
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.allTime.count} processed
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Avg: {(status.stats.allTime.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.allTime.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.allTime.errorCount} errors
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <h2 className="mb-4 text-xl font-semibold">Recent Processes</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate font-medium"
                    title={log.job_title}
                  >
                    {log.job_title || '-'}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate text-muted-foreground"
                    title={log.company_name}
                  >
                    {log.company_name || '-'}
                  </TableCell>
                  <TableCell>
                    {log.level === 'error' ? (
                      <Badge
                        variant="destructive"
                        className="cursor-help"
                        title={log.message}
                      >
                        Error
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 hover:bg-green-600">
                        Success
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {log.duration_ms
                      ? `${(log.duration_ms / 1000).toFixed(2)}s`
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reset Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Reprocess</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                This action will reset the processing status of{' '}
                <strong>all jobs</strong> in the database and then reprocess the
                first 5 jobs.
              </p>
              <p>
                You can use this action if you are trying a new LLM model or
                prompt.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetModalOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetAndProcess}
              disabled={isResetting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isResetting ? 'Processing...' : 'Confirm and Start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

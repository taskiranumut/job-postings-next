'use client';

import { useState, useTransition } from 'react';
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
import { toast } from 'sonner';
import {
  processLLMOnce,
  resetLLMProcessing,
  getLLMStatus,
  getLLMLogs,
} from '@/lib/actions';
import { RefreshCw, Home, Zap, RotateCcw } from 'lucide-react';

export function LLMDashboardClient({ initialStatus, initialLogs }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [logs, setLogs] = useState(initialLogs);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const [isRefreshing, startRefresh] = useTransition();
  const [isProcessing, startProcess] = useTransition();
  const [isResetting, startReset] = useTransition();

  const isLoading = isRefreshing || isProcessing || isResetting;

  const fetchData = () => {
    startRefresh(async () => {
      try {
        const [newStatus, newLogs] = await Promise.all([
          getLLMStatus(),
          getLLMLogs(20),
        ]);
        setStatus(newStatus);
        setLogs(newLogs);
      } catch (err) {
        console.error('Veri çekme hatası:', err);
        toast.error('Veriler yüklenirken hata oluştu.');
      }
    });
  };

  const handleProcessOnce = () => {
    startProcess(async () => {
      try {
        const result = await processLLMOnce(5);

        if (result.total_selected === 0) {
          toast.info('İşlenecek bekleyen ilan bulunamadı.');
        } else {
          const processedCount = result.total_success || 0;
          toast.success(
            `İşlem tamamlandı. ${processedCount} adet ilan işlendi.`
          );
        }

        fetchData();
      } catch (err) {
        console.error('Process hatası:', err);
        toast.error(err.message || 'İşlem sırasında hata oluştu.');
      }
    });
  };

  const handleResetAndProcess = () => {
    startReset(async () => {
      try {
        const resetData = await resetLLMProcessing();
        toast.info(
          `${resetData.count} adet ilan sıfırlandı. İşlem başlıyor...`
        );
        setResetModalOpen(false);

        // Process after reset
        await handleProcessOnce();
      } catch (err) {
        console.error('Reset hatası:', err);
        toast.error(err.message || 'Sıfırlama işlemi başarısız.');
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">LLM İşleme Paneli</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw
              className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Yenile
          </Button>
          <Button
            variant="secondary"
            onClick={() => setResetModalOpen(true)}
            disabled={isLoading}
            className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
          >
            <RotateCcw className="size-4" />
            Zorla Tekrar İşle
          </Button>
          <Button
            onClick={handleProcessOnce}
            disabled={isLoading || status?.total_pending === 0}
          >
            <Zap className="size-4" />
            {isProcessing ? 'İşleniyor...' : 'Şimdi İşle (5 Adet)'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {status && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                Toplam İlan
              </p>
              <p className="mt-1 text-3xl font-bold">{status.total_postings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                İşlenen
              </p>
              <p className="mt-1 text-3xl font-bold text-green-500">
                {status.total_processed}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-base font-semibold uppercase text-muted-foreground">
                Bekleyen
              </p>
              <p className="mt-1 text-3xl font-bold text-orange-500">
                {status.total_pending}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last Run Info */}
      {status?.last_run && (
        <Card className="mb-8">
          <CardContent className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-semibold">Son Çalışma:</span>
            <span>{formatDate(status.last_run.started_at)}</span>
            <span className="text-muted-foreground">-</span>
            <span>Durum:</span>
            <Badge
              variant={
                status.last_run.status === 'completed' ? 'default' : 'secondary'
              }
              className={
                status.last_run.status === 'completed'
                  ? 'bg-green-600 hover:bg-green-600'
                  : 'bg-yellow-600 hover:bg-yellow-600'
              }
            >
              {status.last_run.status}
            </Badge>
            <span className="text-muted-foreground">-</span>
            <span>İşlenen: {status.last_run.processed_count}</span>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <h2 className="mb-4 text-xl font-semibold">Son Loglar</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Seviye</TableHead>
              <TableHead>Mesaj</TableHead>
              <TableHead>Süre</TableHead>
              <TableHead>Prompt T.</TableHead>
              <TableHead>Comp. T.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-base">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.level === 'error' ? 'destructive' : 'secondary'
                      }
                    >
                      {log.level === 'error' ? 'Hata' : 'Bilgi'}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-[300px] truncate text-base"
                    title={log.message}
                  >
                    {log.message || '-'}
                  </TableCell>
                  <TableCell className="text-base">
                    {log.duration_ms
                      ? `${(log.duration_ms / 1000).toFixed(2)}s`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-base">
                    {log.prompt_tokens || '-'}
                  </TableCell>
                  <TableCell className="text-base">
                    {log.completion_tokens || '-'}
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
            <DialogTitle>Zorla Tekrar İşle</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                Bu işlem, veritabanındaki <strong>tüm ilanların</strong> işlenme
                durumunu sıfırlayacak (Reset) ve ardından ilk 5 ilanı yeniden
                işleyecektir.
              </p>
              <p>
                Eğer yeni bir LLM modeli veya prompt deniyorsanız bu işlemi
                kullanabilirsiniz.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetModalOpen(false)}
              disabled={isResetting}
            >
              İptal
            </Button>
            <Button
              onClick={handleResetAndProcess}
              disabled={isResetting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isResetting ? 'İşleniyor...' : 'Onayla ve Başlat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

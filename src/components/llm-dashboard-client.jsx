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
} from '@/lib/actions';
import { RefreshCw, Home, Zap, RotateCcw, ChevronDown } from 'lucide-react';

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

  const [isRefreshing, startRefresh] = useTransition();
  const [isProcessing, startProcess] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [isToggling, startToggle] = useTransition();

  const isLoading = isRefreshing || isProcessing || isResetting || isToggling;

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

  const handleProcessOnce = (limit = 5) => {
    startProcess(async () => {
      try {
        const result = await processLLMOnce(limit);

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

  const handleToggleAutoProcessing = (checked) => {
    startToggle(async () => {
      try {
        await updateAutoLLMProcessing(checked);
        setAutoProcessing(checked);
        toast.success(
          checked
            ? 'Otomatik işleme açıldı. Eklenen ilanlar otomatik işlenecek.'
            : 'Otomatik işleme kapatıldı. Manuel işleme aktif.'
        );
      } catch (err) {
        console.error('Toggle hatası:', err);
        toast.error(err.message || 'Ayar güncellenirken hata oluştu.');
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
          {/* Otomatik işleme açıkken dropdown devre dışı */}
          {autoProcessing ? (
            <Button disabled className="cursor-not-allowed opacity-50">
              <Zap className="size-4" />
              Otomatik Mod Aktif
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading || status?.total_pending === 0}>
                  <Zap className="size-4" />
                  {isProcessing ? 'İşleniyor...' : 'Şimdi İşle'}
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
                      {count} Adet İşle
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
              Otomatik İlan İşleme
            </Label>
            <p className="text-sm text-muted-foreground">
              {autoProcessing
                ? 'Eklenen ilanlar otomatik olarak LLM ile işlenir.'
                : 'Manuel mod aktif. İlanları "Şimdi İşle" butonu ile işleyebilirsiniz.'}
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

      {/* Stats Cards - İlan Durumu */}
      {status && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
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

      {/* Stats Cards - İşlem İstatistikleri */}
      {status?.stats && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-blue-400">
                Bugün
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.today.count} işlem
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Ort: {(status.stats.today.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.today.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.today.errorCount} hata
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-purple-400">
                Bu Hafta
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.week.count} işlem
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Ort: {(status.stats.week.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.week.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.week.errorCount} hata
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent>
              <p className="text-sm font-semibold uppercase text-emerald-400">
                Toplam
              </p>
              <p className="mt-1 text-2xl font-bold">
                {status.stats.allTime.count} işlem
              </p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Ort: {(status.stats.allTime.avgDuration / 1000).toFixed(1)}s
                </span>
                {status.stats.allTime.errorCount > 0 && (
                  <span className="text-red-400">
                    {status.stats.allTime.errorCount} hata
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <h2 className="mb-4 text-xl font-semibold">Son İşlemler</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>İlan</TableHead>
              <TableHead>Şirket</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Süre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Kayıt bulunamadı.
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
                        Hata
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 hover:bg-green-600">
                        Başarılı
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

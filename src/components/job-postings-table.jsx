'use client';

import {
  useState,
  useTransition,
  useMemo,
  useCallback,
  useEffect,
  memo,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bot,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Search,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Play,
  Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteJobPosting } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import dayjs from 'dayjs';

// Array karşılaştırma helper'ı (JSON.stringify'dan daha hızlı)
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function PlatformLink({ url, platformName, className, badgeClassName }) {
  return (
    <a
      href={url}
      className={`inline-flex items-center gap-1 hover:underline ${className}`}
      title={url}
    >
      <Badge variant="secondary" className={badgeClassName}>
        {platformName}
      </Badge>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

const MultiSelect = memo(function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  selectedLabel,
}) {
  const hasSelection = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2">
          <span className="truncate">
            {hasSelection
              ? selectedLabel
                ? selectedLabel(selected)
                : `${selected.length} seçili`
              : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, option.value]);
                  } else {
                    onChange(selected.filter((v) => v !== option.value));
                  }
                }}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
        {hasSelection && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onChange([])}
          >
            <X className="size-3" />
            Temizle
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
});

const LLM_STATUS_OPTIONS = [
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'processing', label: 'İşleniyor' },
  { value: 'pending', label: 'Bekliyor' },
  { value: 'failed', label: 'Başarısız' },
];

const PAGE_SIZE_OPTIONS = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// FilterBar kendi içinde local state tutar - parent'ı gereksiz render etmez
// key prop ile reset edildiğinde tamamen yeniden oluşturulur
const FilterBar = memo(function FilterBar({
  platforms,
  initialPlatforms,
  initialLlmStatus,
  initialJobTitle,
  initialCompany,
  onSubmit,
  onClearAll,
  hasActiveFilters,
}) {
  // Local state - bu değişiklikler parent'ı etkilemez
  // Initial değerler key ile reset edilerek güncellenir
  const [localPlatforms, setLocalPlatforms] = useState(initialPlatforms);
  const [localLlmStatus, setLocalLlmStatus] = useState(initialLlmStatus);
  const [localJobTitle, setLocalJobTitle] = useState(initialJobTitle);
  const [localCompany, setLocalCompany] = useState(initialCompany);

  // isDirty hesaplama - artık local state ile
  const isDirty = useMemo(() => {
    return (
      !arraysEqual(localPlatforms, initialPlatforms) ||
      !arraysEqual(localLlmStatus, initialLlmStatus) ||
      localJobTitle !== initialJobTitle ||
      localCompany !== initialCompany
    );
  }, [
    localPlatforms,
    initialPlatforms,
    localLlmStatus,
    initialLlmStatus,
    localJobTitle,
    initialJobTitle,
    localCompany,
    initialCompany,
  ]);

  const handleSubmit = useCallback(() => {
    onSubmit({
      platforms: localPlatforms,
      llmStatus: localLlmStatus,
      jobTitle: localJobTitle,
      company: localCompany,
    });
  }, [onSubmit, localPlatforms, localLlmStatus, localJobTitle, localCompany]);

  const handleClear = useCallback(() => {
    setLocalPlatforms([]);
    setLocalLlmStatus([]);
    setLocalJobTitle('');
    setLocalCompany('');
    onClearAll();
  }, [onClearAll]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && isDirty) {
        handleSubmit();
      }
    },
    [isDirty, handleSubmit]
  );

  const platformOptions = useMemo(
    () => platforms.map((p) => ({ value: p, label: p })),
    [platforms]
  );

  const llmStatusLabel = useCallback((s) => {
    if (s.length === 4) return 'Tümü';
    if (s.length === 1) {
      const statusMap = {
        completed: 'Tamamlandı',
        processing: 'İşleniyor',
        pending: 'Bekliyor',
        failed: 'Başarısız',
      };
      return statusMap[s[0]] || s[0];
    }
    return `${s.length} durum`;
  }, []);

  const platformLabel = useCallback((s) => `${s.length} platform`, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full min-w-[140px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          LLM Durumu
        </Label>
        <MultiSelect
          options={LLM_STATUS_OPTIONS}
          selected={localLlmStatus}
          onChange={setLocalLlmStatus}
          placeholder="Durum seçin"
          selectedLabel={llmStatusLabel}
        />
      </div>
      <div className="w-full min-w-[180px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Platform
        </Label>
        <MultiSelect
          options={platformOptions}
          selected={localPlatforms}
          onChange={setLocalPlatforms}
          placeholder="Platform seçin"
          selectedLabel={platformLabel}
        />
      </div>
      <div className="w-full min-w-[180px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Job Title
        </Label>
        <Input
          placeholder="Ara..."
          value={localJobTitle}
          onChange={(e) => setLocalJobTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9"
        />
      </div>
      <div className="w-full min-w-[180px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Company
        </Label>
        <Input
          placeholder="Ara..."
          value={localCompany}
          onChange={(e) => setLocalCompany(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9"
        />
      </div>
      <div className="flex w-full gap-2 pt-2 sm:w-auto sm:pt-0">
        <Button
          onClick={handleSubmit}
          className="h-9 flex-1 sm:flex-none"
          disabled={!isDirty}
        >
          <Search className="size-4" />
          Filtrele
        </Button>
        <Button
          variant="ghost"
          onClick={handleClear}
          className="h-9 text-muted-foreground"
          title="Filtreleri temizle"
          disabled={!hasActiveFilters}
        >
          <X className="size-5" />
        </Button>
      </div>
    </div>
  );
});

// Pagination Component
const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Sayfa numaralarını oluştur
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Tüm sayfaları göster
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // İlk sayfa
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Ortadaki sayfalar
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Son sayfa
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1 && totalCount <= 20) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Sol taraf - Bilgi ve sayfa boyutu */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>
              <span className="font-medium">
                {startItem}-{endItem}
              </span>
              {' / '}
              <span className="font-medium">{totalCount}</span> kayıt
            </>
          ) : (
            'Kayıt bulunamadı'
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sayfa başına:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sağ taraf - Sayfa navigasyonu */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* İlk sayfa */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1 || isLoading}
            title="İlk sayfa"
          >
            <ChevronsLeft className="size-4" />
          </Button>

          {/* Önceki sayfa */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            title="Önceki sayfa"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Sayfa numaraları */}
          <div className="hidden items-center gap-1 sm:flex">
            {getPageNumbers().map((pageNum, index) =>
              pageNum === '...' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="icon"
                  className="size-8"
                  onClick={() => onPageChange(pageNum)}
                  disabled={isLoading}
                >
                  {pageNum}
                </Button>
              )
            )}
          </div>

          {/* Mobilde sayfa bilgisi */}
          <span className="px-2 text-sm text-muted-foreground sm:hidden">
            {currentPage} / {totalPages}
          </span>

          {/* Sonraki sayfa */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            title="Sonraki sayfa"
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* Son sayfa */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || isLoading}
            title="Son sayfa"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
});

export function JobPostingsTable({
  initialData,
  initialPagination,
  initialPlatforms,
}) {
  const searchParams = useSearchParams();

  // State
  const [postings, setPostings] = useState(initialData);
  const [pagination, setPagination] = useState(initialPagination);
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Local state for current filters (URL'den bağımsız, client-side yönetim)
  const [currentFilters, setCurrentFilters] = useState(() => ({
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    platforms: searchParams.get('platform')?.split(',').filter(Boolean) || [],
    llmStatuses:
      searchParams.get('llm_status')?.split(',').filter(Boolean) || [],
    jobTitle: searchParams.get('job_title') || '',
    company: searchParams.get('company') || '',
  }));

  // Polling interval (5 saniye)
  const AUTO_REFRESH_INTERVAL = 5000;

  // Memoized filter values
  const {
    page: currentPage,
    pageSize: currentPageSize,
    platforms: appliedPlatforms,
    llmStatuses: appliedLlmStatus,
    jobTitle: appliedJobTitle,
    company: appliedCompany,
  } = currentFilters;

  // URL'i güncelle (server component tetiklemeden)
  const updateURLSilently = useCallback((filters) => {
    const params = new URLSearchParams();

    if (filters.page > 1) params.set('page', String(filters.page));
    if (filters.pageSize !== 20)
      params.set('pageSize', String(filters.pageSize));
    if (filters.platforms?.length > 0)
      params.set('platform', filters.platforms.join(','));
    if (filters.llmStatuses?.length > 0)
      params.set('llm_status', filters.llmStatuses.join(','));
    if (filters.jobTitle?.trim())
      params.set('job_title', filters.jobTitle.trim());
    if (filters.company?.trim()) params.set('company', filters.company.trim());

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    // History API kullanarak URL'i güncelle - server component tetiklenmez
    window.history.pushState({}, '', newUrl);
  }, []);

  // Verileri API'den çek (sessiz mod: loading göstermez)
  const fetchData = useCallback(
    async (params = {}, options = { silent: false }) => {
      if (!options.silent) {
        setIsLoading(true);
      }

      try {
        const queryParams = new URLSearchParams();

        if (params.page) queryParams.set('page', String(params.page));
        if (params.pageSize)
          queryParams.set('pageSize', String(params.pageSize));
        if (params.platforms?.length > 0) {
          queryParams.set('platform', params.platforms.join(','));
        }
        if (params.llmStatuses?.length > 0) {
          queryParams.set('llm_status', params.llmStatuses.join(','));
        }
        if (params.jobTitle) queryParams.set('job_title', params.jobTitle);
        if (params.company) queryParams.set('company', params.company);

        const response = await fetch(
          `/api/job-postings?${queryParams.toString()}`
        );
        const result = await response.json();

        if (response.ok) {
          setPostings(result.data);
          setPagination(result.pagination);
          if (result.platforms) {
            setPlatforms(result.platforms);
          }
        } else {
          toast.error('Veri yüklenirken hata oluştu');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        toast.error('Veri yüklenirken hata oluştu');
      } finally {
        if (!options.silent) {
          setIsLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    []
  );

  // Tabloyu yenile (sessiz - sadece ikon döner)
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(currentFilters, { silent: true });
    toast.success('Tablo yenilendi');
  }, [fetchData, currentFilters]);

  // Otomatik yenileme toggle
  const toggleAutoRefresh = useCallback(() => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    if (newValue) {
      toast.success(
        `Otomatik yenileme aktif (${AUTO_REFRESH_INTERVAL / 1000} sn)`
      );
    } else {
      toast.info('Otomatik yenileme durduruldu');
    }
  }, [autoRefresh]);

  // Polling mekanizması (sessiz yenileme)
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchData(currentFilters, { silent: true });
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchData, currentFilters]);

  // Filtreleri güncelle ve veri çek
  const updateFiltersAndFetch = useCallback(
    (updates) => {
      const newFilters = {
        page: updates.page ?? currentPage,
        pageSize: updates.pageSize ?? currentPageSize,
        platforms: updates.platforms ?? appliedPlatforms,
        llmStatuses: updates.llmStatuses ?? appliedLlmStatus,
        jobTitle: updates.jobTitle ?? appliedJobTitle,
        company: updates.company ?? appliedCompany,
      };

      // State'i güncelle
      setCurrentFilters(newFilters);

      // URL'i sessizce güncelle
      updateURLSilently(newFilters);

      // Veriyi çek
      fetchData(newFilters);
    },
    [
      currentPage,
      currentPageSize,
      appliedPlatforms,
      appliedLlmStatus,
      appliedJobTitle,
      appliedCompany,
      updateURLSilently,
      fetchData,
    ]
  );

  // Sayfa değiştir
  const handlePageChange = useCallback(
    (newPage) => {
      updateFiltersAndFetch({ page: newPage });
    },
    [updateFiltersAndFetch]
  );

  // Sayfa boyutu değiştir
  const handlePageSizeChange = useCallback(
    (newPageSize) => {
      // Sayfa boyutu değiştiğinde ilk sayfaya dön
      updateFiltersAndFetch({ page: 1, pageSize: newPageSize });
    },
    [updateFiltersAndFetch]
  );

  // Filtreleri uygula (submit)
  const submitFilters = useCallback(
    ({ platforms, llmStatus, jobTitle, company }) => {
      // Filtre değiştiğinde ilk sayfaya dön
      updateFiltersAndFetch({
        page: 1,
        platforms,
        llmStatuses: llmStatus,
        jobTitle,
        company,
      });
    },
    [updateFiltersAndFetch]
  );

  const hasActiveFilters =
    appliedPlatforms.length > 0 ||
    appliedLlmStatus.length > 0 ||
    appliedJobTitle ||
    appliedCompany;

  const activeFilterCount =
    (appliedPlatforms.length > 0 ? 1 : 0) +
    (appliedLlmStatus.length > 0 ? 1 : 0) +
    (appliedJobTitle ? 1 : 0) +
    (appliedCompany ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    updateFiltersAndFetch({
      page: 1,
      platforms: [],
      llmStatuses: [],
      jobTitle: '',
      company: '',
    });
  }, [updateFiltersAndFetch]);

  // FilterBar için key - URL değiştiğinde component resetlenir
  const filterBarKey = useMemo(
    () =>
      `${appliedPlatforms.join(',')}-${appliedLlmStatus.join(
        ','
      )}-${appliedJobTitle}-${appliedCompany}`,
    [appliedPlatforms, appliedLlmStatus, appliedJobTitle, appliedCompany]
  );

  const filterBarProps = useMemo(
    () => ({
      platforms,
      initialPlatforms: appliedPlatforms,
      initialLlmStatus: appliedLlmStatus,
      initialJobTitle: appliedJobTitle,
      initialCompany: appliedCompany,
      onSubmit: submitFilters,
      onClearAll: clearAllFilters,
      hasActiveFilters,
    }),
    [
      platforms,
      appliedPlatforms,
      appliedLlmStatus,
      appliedJobTitle,
      appliedCompany,
      submitFilters,
      clearAllFilters,
      hasActiveFilters,
    ]
  );

  const openDeleteModal = useCallback((id) => {
    setSelectedPostingId(id);
    setDeleteModalOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!selectedPostingId) return;

    const idToDelete = selectedPostingId;

    startTransition(async () => {
      try {
        await deleteJobPosting(idToDelete);
        toast.success('İlan başarıyla silindi.');
        // Silme sonrası tabloyu sessizce yenile
        fetchData(currentFilters, { silent: true });
      } catch (err) {
        console.error('Silme hatası:', err);
        toast.error('Silme işlemi başarısız oldu.');
      } finally {
        setDeleteModalOpen(false);
      }
    });
  }, [selectedPostingId, fetchData, currentFilters]);

  // Boş durum kontrolü (filtresiz ve veri yoksa)
  if (!isLoading && postings.length === 0 && !hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Bot className="mb-4 size-12 opacity-50" />
        <p>Henüz hiç ilan eklenmemiş.</p>
      </div>
    );
  }

  return (
    <>
      {/* Header with Filters */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              İş İlanları
            </h1>
            <Badge variant="secondary" className="text-xs">
              {pagination.totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || autoRefresh}
              title="Tabloyu yenile"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              variant={autoRefresh ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleAutoRefresh}
              title={
                autoRefresh
                  ? 'Otomatik yenilemeyi durdur'
                  : 'Otomatik yenilemeyi başlat'
              }
              className={
                autoRefresh
                  ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50'
                  : ''
              }
            >
              {autoRefresh ? (
                <Pause className="size-4 text-green-600 dark:text-green-400" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
          </div>

          {/* Desktop Filters */}
          <div className="hidden lg:block">
            <FilterBar key={`desktop-${filterBarKey}`} {...filterBarProps} />
          </div>

          {/* Mobile Filter Toggle */}
          <div className="lg:hidden">
            <Collapsible
              open={mobileFiltersOpen}
              onOpenChange={setMobileFiltersOpen}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="size-4" />
                    Filtreler
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown
                    className={`size-4 transition-transform ${
                      mobileFiltersOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <FilterBar
                  key={`mobile-${filterBarKey}`}
                  {...filterBarProps}
                  onSubmit={(filters) => {
                    submitFilters(filters);
                    setMobileFiltersOpen(false);
                  }}
                  onClearAll={() => {
                    clearAllFilters();
                    setMobileFiltersOpen(false);
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && postings.length === 0 && (
        <JobPostingsTableSkeleton compact />
      )}

      {/* No Results */}
      {!isLoading && postings.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Filter className="mb-4 size-12 opacity-50" />
          <p>Filtrelere uygun ilan bulunamadı.</p>
          <Button variant="link" onClick={clearAllFilters} className="mt-2">
            Filtreleri temizle
          </Button>
        </div>
      )}

      {/* Desktop View */}
      {postings.length > 0 && (
        <div
          className={`hidden rounded-lg border md:block ${
            isLoading ? 'opacity-60' : ''
          }`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px] font-bold">
                  Eklenme Tarihi
                </TableHead>
                <TableHead className="w-[80px] text-center font-bold">
                  LLM
                </TableHead>
                <TableHead className="font-bold">Platform</TableHead>
                <TableHead className="font-bold">Raw Text</TableHead>
                <TableHead className="max-w-[200px] font-bold">
                  Job Title
                </TableHead>
                <TableHead className="max-w-[200px] font-bold">
                  Company
                </TableHead>
                <TableHead className="w-[120px] font-bold">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postings.map((posting) => (
                <TableRow key={posting.id}>
                  <TableCell className="text-base text-muted-foreground">
                    {posting.scraped_at
                      ? dayjs(posting.scraped_at).format('DD/MM/YY HH:mm')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const status =
                        posting.llm_status ||
                        (posting.llm_processed ? 'completed' : 'pending');

                      switch (status) {
                        case 'completed':
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Tamamlandı"
                            >
                              <CheckCircle2 className="size-4 text-green-500" />
                            </div>
                          );
                        case 'processing':
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="İşleniyor"
                            >
                              <Loader2 className="size-4 animate-spin text-blue-500" />
                            </div>
                          );
                        case 'failed':
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Başarısız"
                            >
                              <AlertCircle className="size-4 text-red-500" />
                            </div>
                          );
                        case 'pending':
                        default:
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Bekliyor"
                            >
                              <Clock className="size-4 text-amber-500" />
                            </div>
                          );
                      }
                    })()}
                  </TableCell>
                  <TableCell>
                    <PlatformLink
                      url={posting.url}
                      platformName={posting.platform_name}
                      className="text-base px-4 text-muted-foreground hover:text-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <p className="max-w-[300px] truncate text-base">
                      {posting.raw_text}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {posting.job_title || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {posting.company_name || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        disabled={!posting.llm_processed}
                        title="Görüntüle"
                      >
                        <Link
                          href={`/view/${posting.id}`}
                          className={
                            !posting.llm_processed
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        title="Düzenle"
                      >
                        <Link href={`/edit/${posting.id}`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDeleteModal(posting.id)}
                        title="Sil"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile View */}
      {postings.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 md:hidden ${
            isLoading ? 'opacity-60' : ''
          }`}
        >
          {postings.map((posting) => (
            <Card key={posting.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {posting.job_title || 'Başlıksız İlan'}
                    </CardTitle>
                    <CardDescription>
                      {posting.company_name || 'Şirket Belirtilmemiş'}
                    </CardDescription>
                  </div>
                  {(() => {
                    const status =
                      posting.llm_status ||
                      (posting.llm_processed ? 'completed' : 'pending');

                    switch (status) {
                      case 'completed':
                        return (
                          <CheckCircle2
                            className="size-5 text-green-500"
                            title="Tamamlandı"
                          />
                        );
                      case 'processing':
                        return (
                          <Loader2
                            className="size-5 animate-spin text-blue-500"
                            title="İşleniyor"
                          />
                        );
                      case 'failed':
                        return (
                          <AlertCircle
                            className="size-5 text-red-500"
                            title="Başarısız"
                          />
                        );
                      case 'pending':
                      default:
                        return (
                          <Clock
                            className="size-5 text-amber-500"
                            title="Bekliyor"
                          />
                        );
                    }
                  })()}
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Platform:</span>
                    <PlatformLink
                      url={posting.url}
                      platformName={posting.platform_name}
                      badgeClassName="text-sm px-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tarih:</span>
                    <span>
                      {posting.scraped_at
                        ? dayjs(posting.scraped_at).format('DD/MM/YY HH:mm')
                        : '-'}
                    </span>
                  </div>
                  <div className="pt-2">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {posting.raw_text}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-wrap justify-start gap-2 pt-2">
                <Button
                  variant="outline"
                  asChild
                  disabled={!posting.llm_processed}
                >
                  <Link
                    href={`/view/${posting.id}`}
                    className={
                      !posting.llm_processed
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }
                  >
                    <Eye className="size-4" />
                    Görüntüle
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/edit/${posting.id}`}>
                    <Pencil className="size-4" />
                    Düzenle
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openDeleteModal(posting.id)}
                >
                  <Trash2 className="size-4" />
                  Sil
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {postings.length > 0 && (
        <div className="mt-6">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isLoading}
          />
        </div>
      )}

      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setSelectedPostingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İlanı Sil</DialogTitle>
            <DialogDescription>
              Bu ilanı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isPending}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Siliniyor...' : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Skeleton Loading Component
export function JobPostingsTableSkeleton({ compact = false }) {
  const rowCount = compact ? 3 : 6;
  const cardCount = compact ? 2 : 4;

  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      {!compact && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32 sm:h-10 sm:w-40" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          {/* Desktop Filter Skeleton */}
          <div className="hidden items-end gap-3 lg:flex">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-9 w-[180px]" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-[140px]" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-9 w-[180px]" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-9 w-[180px]" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          {/* Mobile Filter Button Skeleton */}
          <Skeleton className="h-10 w-full lg:hidden" />
        </div>
      )}

      {/* Desktop Table Skeleton */}
      <div className="hidden rounded-lg border md:block">
        <div className="p-1">
          {/* Table Header */}
          <div className="flex items-center gap-4 border-b px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Table Rows */}
          {Array.from({ length: rowCount }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b px-4 py-4 last:border-0"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mx-auto size-5 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-48 flex-1" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-28" />
              <div className="flex gap-1">
                <Skeleton className="size-8 rounded-md" />
                <Skeleton className="size-8 rounded-md" />
                <Skeleton className="size-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-4 space-y-4"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="size-5 rounded-full" />
            </div>
            {/* Card Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
            {/* Card Footer */}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      {!compact && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-[70px]" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      )}
    </div>
  );
}

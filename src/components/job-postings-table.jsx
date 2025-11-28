'use client';

import {
  useState,
  useTransition,
  useMemo,
  useEffect,
  useCallback,
  memo,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  X,
  Search,
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
  { value: 'processed', label: 'İşlendi' },
  { value: 'pending', label: 'Bekliyor' },
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

  const llmStatusLabel = useCallback(
    (s) =>
      s.length === 2
        ? 'Tümü'
        : s.includes('processed')
        ? 'İşlendi'
        : 'Bekliyor',
    []
  );

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

export function JobPostingsTable({ postings: initialPostings }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [postings, setPostings] = useState(initialPostings);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // URL'den aktif filtreleri oku
  const platformParam = searchParams.get('platform');
  const appliedPlatforms = useMemo(
    () => (platformParam ? platformParam.split(',').filter(Boolean) : []),
    [platformParam]
  );
  const llmStatusParam = searchParams.get('llm_status');
  const appliedLlmStatus = useMemo(
    () => (llmStatusParam ? llmStatusParam.split(',').filter(Boolean) : []),
    [llmStatusParam]
  );
  const appliedJobTitle = searchParams.get('job_title') || '';
  const appliedCompany = searchParams.get('company') || '';

  // Benzersiz platform listesi
  const uniquePlatforms = useMemo(() => {
    const platforms = postings.map((p) => p.platform_name).filter(Boolean);
    return [...new Set(platforms)].sort();
  }, [postings]);

  // Filtreleri URL'e yaz (submit) - FilterBar'dan çağrılır
  const submitFilters = useCallback(
    ({ platforms, llmStatus, jobTitle, company }) => {
      const params = new URLSearchParams();

      if (platforms.length > 0) {
        params.set('platform', platforms.join(','));
      }
      if (llmStatus.length > 0) {
        params.set('llm_status', llmStatus.join(','));
      }
      if (jobTitle.trim()) {
        params.set('job_title', jobTitle.trim());
      }
      if (company.trim()) {
        params.set('company', company.trim());
      }

      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : '?', { scroll: false });
    },
    [router]
  );

  // Filtrelenmiş postings (URL'deki değerlere göre)
  const filteredPostings = useMemo(() => {
    return postings.filter((posting) => {
      // Platform filtresi
      if (appliedPlatforms.length > 0) {
        if (!appliedPlatforms.includes(posting.platform_name)) {
          return false;
        }
      }

      // LLM status filtresi
      if (appliedLlmStatus.length > 0) {
        const isProcessed = posting.llm_processed;
        const matchesProcessed =
          appliedLlmStatus.includes('processed') && isProcessed;
        const matchesPending =
          appliedLlmStatus.includes('pending') && !isProcessed;
        if (!matchesProcessed && !matchesPending) {
          return false;
        }
      }

      // Job title filtresi
      if (appliedJobTitle) {
        const title = (posting.job_title || '').toLowerCase();
        if (!title.includes(appliedJobTitle.toLowerCase())) {
          return false;
        }
      }

      // Company filtresi
      if (appliedCompany) {
        const company = (posting.company_name || '').toLowerCase();
        if (!company.includes(appliedCompany.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [
    postings,
    appliedPlatforms,
    appliedLlmStatus,
    appliedJobTitle,
    appliedCompany,
  ]);

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
    router.push('?', { scroll: false });
  }, [router]);

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
      platforms: uniquePlatforms,
      initialPlatforms: appliedPlatforms,
      initialLlmStatus: appliedLlmStatus,
      initialJobTitle: appliedJobTitle,
      initialCompany: appliedCompany,
      onSubmit: submitFilters,
      onClearAll: clearAllFilters,
      hasActiveFilters,
    }),
    [
      uniquePlatforms,
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
        setPostings((prev) => prev.filter((p) => p.id !== idToDelete));
      } catch (err) {
        console.error('Silme hatası:', err);
        toast.error('Silme işlemi başarısız oldu.');
      } finally {
        setDeleteModalOpen(false);
      }
    });
  }, [selectedPostingId]);

  if (postings.length === 0) {
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
              {filteredPostings.length}
              {filteredPostings.length !== postings.length &&
                ` / ${postings.length}`}
            </Badge>
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

      {/* No Results */}
      {filteredPostings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Filter className="mb-4 size-12 opacity-50" />
          <p>Filtrelere uygun ilan bulunamadı.</p>
          <Button variant="link" onClick={clearAllFilters} className="mt-2">
            Filtreleri temizle
          </Button>
        </div>
      )}

      {/* Desktop View */}
      {filteredPostings.length > 0 && (
        <div className="hidden rounded-lg border md:block">
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
              {filteredPostings.map((posting) => (
                <TableRow key={posting.id}>
                  <TableCell className="text-base text-muted-foreground">
                    {posting.scraped_at
                      ? dayjs(posting.scraped_at).format('DD/MM/YY HH:mm')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {posting.llm_processed ? (
                      <Bot className="mx-auto size-5 text-green-500" />
                    ) : (
                      <Bot className="mx-auto size-5 text-muted-foreground/40" />
                    )}
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
      {filteredPostings.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredPostings.map((posting) => (
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
                  {posting.llm_processed ? (
                    <Bot className="size-5 text-green-500" />
                  ) : (
                    <Bot className="size-5 text-muted-foreground/40" />
                  )}
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
export function JobPostingsTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
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
          {Array.from({ length: 6 }).map((_, i) => (
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
        {Array.from({ length: 4 }).map((_, i) => (
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
    </div>
  );
}

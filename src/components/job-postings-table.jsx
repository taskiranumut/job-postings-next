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

// Array comparison helper (faster than JSON.stringify)
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
      className={`inline-flex items-start gap-1 hover:underline ${className}`}
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
                : `${selected.length} selected`
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
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
});

const LLM_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const PAGE_SIZE_OPTIONS = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// FilterBar keeps local state internally - prevents unnecessary parent re-renders
// completely recreated when reset with key prop
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
  // Local state - these changes do not affect parent
  // Initial values are updated by resetting with key
  const [localPlatforms, setLocalPlatforms] = useState(initialPlatforms);
  const [localLlmStatus, setLocalLlmStatus] = useState(initialLlmStatus);
  const [localJobTitle, setLocalJobTitle] = useState(initialJobTitle);
  const [localCompany, setLocalCompany] = useState(initialCompany);

  // isDirty calculation - now with local state
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
    if (s.length === 4) return 'All';
    if (s.length === 1) {
      const statusMap = {
        completed: 'Completed',
        processing: 'Processing',
        pending: 'Pending',
        failed: 'Failed',
      };
      return statusMap[s[0]] || s[0];
    }
    return `${s.length} statuses`;
  }, []);

  const platformLabel = useCallback((s) => `${s.length} platforms`, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full min-w-[140px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          LLM Status
        </Label>
        <MultiSelect
          options={LLM_STATUS_OPTIONS}
          selected={localLlmStatus}
          onChange={setLocalLlmStatus}
          placeholder="Select status"
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
          placeholder="Select platform"
          selectedLabel={platformLabel}
        />
      </div>
      <div className="w-full min-w-[180px] sm:w-auto">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Job Title
        </Label>
        <Input
          placeholder="Search..."
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
          placeholder="Search..."
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
          Filter
        </Button>
        <Button
          variant="ghost"
          onClick={handleClear}
          className="h-9 text-muted-foreground"
          title="Clear filters"
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

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // First page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Middle pages
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

      // Last page
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
      {/* Left side - Info and page size */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>
              <span className="font-medium">
                {startItem}-{endItem}
              </span>
              {' / '}
              <span className="font-medium">{totalCount}</span> records
            </>
          ) : (
            'No records found'
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
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

      {/* Right side - Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1 || isLoading}
            title="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          {/* Previous page */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            title="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          {/* Page numbers */}
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
          {/* Page info on mobile */}
          <span className="px-2 text-sm text-muted-foreground sm:hidden">
            {currentPage} / {totalPages}
          </span>
          {/* Next page */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            title="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          {/* Last page */}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || isLoading}
            title="Last page"
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

  // Local state for current filters (independent of URL, client-side management)
  const [currentFilters, setCurrentFilters] = useState(() => ({
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    platforms: searchParams.get('platform')?.split(',').filter(Boolean) || [],
    llmStatuses:
      searchParams.get('llm_status')?.split(',').filter(Boolean) || [],
    jobTitle: searchParams.get('job_title') || '',
    company: searchParams.get('company') || '',
  }));

  // Polling interval (5 seconds)
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

  // Update URL (without triggering server component)
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

    // Update URL using History API - server component is not triggered
    window.history.pushState({}, '', newUrl);
  }, []);

  // Fetch data from API (silent mode: does not show loading)
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
          toast.error('Error loading data');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        toast.error('Error loading data');
      } finally {
        if (!options.silent) {
          setIsLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    []
  );

  // Refresh table (silent - only icon spins)
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(currentFilters, { silent: true });
    toast.success('Table refreshed');
  }, [fetchData, currentFilters]);

  // Auto refresh toggle
  const toggleAutoRefresh = useCallback(() => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    if (newValue) {
      toast.success(`Auto refresh active (${AUTO_REFRESH_INTERVAL / 1000}s)`);
    } else {
      toast.info('Auto refresh stopped');
    }
  }, [autoRefresh]);

  // Polling mechanism (silent refresh)
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchData(currentFilters, { silent: true });
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchData, currentFilters]);

  // Update filters and fetch data
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

      // Update state
      setCurrentFilters(newFilters);

      // Update URL silently
      updateURLSilently(newFilters);

      // Fetch data
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

  // Change page
  const handlePageChange = useCallback(
    (newPage) => {
      updateFiltersAndFetch({ page: newPage });
    },
    [updateFiltersAndFetch]
  );

  // Change page size
  const handlePageSizeChange = useCallback(
    (newPageSize) => {
      // Return to first page when page size changes
      updateFiltersAndFetch({ page: 1, pageSize: newPageSize });
    },
    [updateFiltersAndFetch]
  );

  // Apply filters (submit)
  const submitFilters = useCallback(
    ({ platforms, llmStatus, jobTitle, company }) => {
      // Return to first page when filter changes
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

  // Key for FilterBar - component resets when URL changes
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
        toast.success('Job deleted successfully.');
        // Silently refresh table after deletion
        fetchData(currentFilters, { silent: true });
      } catch (err) {
        console.error('Deletion error:', err);
        toast.error('Deletion failed.');
      } finally {
        setDeleteModalOpen(false);
      }
    });
  }, [selectedPostingId, fetchData, currentFilters]);

  // Empty state check (if no filters and no data)
  if (!isLoading && postings.length === 0 && !hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Bot className="mb-4 size-12 opacity-50" />
        <p>No jobs added yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Header with Filters */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Job Postings
            </h1>
            <Badge variant="secondary" className="text-xs">
              {pagination.totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || autoRefresh}
              title="Refresh table"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              variant={autoRefresh ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleAutoRefresh}
              title={autoRefresh ? 'Stop auto refresh' : 'Start auto refresh'}
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
                    Filters
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
          <p>No jobs found matching filters.</p>
          <Button variant="link" onClick={clearAllFilters} className="mt-2">
            Clear filters
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
                  Date Added
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
                <TableHead className="w-[120px] font-bold">Actions</TableHead>
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
                              title="Completed"
                            >
                              <CheckCircle2 className="size-4 text-green-500" />
                            </div>
                          );
                        case 'processing':
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Processing"
                            >
                              <Loader2 className="size-4 animate-spin text-blue-500" />
                            </div>
                          );
                        case 'failed':
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Failed"
                            >
                              <AlertCircle className="size-4 text-red-500" />
                            </div>
                          );
                        case 'pending':
                        default:
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title="Pending"
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
                      className="text-base text-muted-foreground hover:text-foreground"
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
                        title="View"
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
                        title="Edit"
                      >
                        <Link href={`/edit/${posting.id}`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDeleteModal(posting.id)}
                        title="Delete"
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
                      {posting.job_title || 'Untitled Job'}
                    </CardTitle>
                    <CardDescription>
                      {posting.company_name || 'Company Not Specified'}
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
                            title="Completed"
                          />
                        );
                      case 'processing':
                        return (
                          <Loader2
                            className="size-5 animate-spin text-blue-500"
                            title="Processing"
                          />
                        );
                      case 'failed':
                        return (
                          <AlertCircle
                            className="size-5 text-red-500"
                            title="Failed"
                          />
                        );
                      case 'pending':
                      default:
                        return (
                          <Clock
                            className="size-5 text-amber-500"
                            title="Pending"
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
                    <span className="text-muted-foreground">Date:</span>
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
                    View
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/edit/${posting.id}`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openDeleteModal(posting.id)}
                >
                  <Trash2 className="size-4" />
                  Delete
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
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this job? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Deleting...' : 'Delete'}
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

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Bot, Eye, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { deleteJobPosting } from '@/lib/actions';
import dayjs from 'dayjs';

export function JobPostingsTable({ postings: initialPostings }) {
  const [postings, setPostings] = useState(initialPostings);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const openDeleteModal = (id) => {
    setSelectedPostingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (!selectedPostingId) return;

    startTransition(async () => {
      try {
        await deleteJobPosting(selectedPostingId);
        toast.success('İlan başarıyla silindi.');
        setPostings((prev) => prev.filter((p) => p.id !== selectedPostingId));
        setDeleteModalOpen(false);
      } catch (err) {
        console.error('Silme hatası:', err);
        toast.error('Silme işlemi başarısız oldu.');
      } finally {
        setSelectedPostingId(null);
      }
    });
  };

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
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Eklenme Tarihi</TableHead>
              <TableHead className="w-[80px] text-center">LLM</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Raw Text</TableHead>
              <TableHead className="max-w-[200px]">Job Title</TableHead>
              <TableHead className="max-w-[200px]">Company</TableHead>
              <TableHead className="w-[120px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postings.map((posting) => (
              <TableRow key={posting.id}>
                <TableCell className="text-sm text-muted-foreground">
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
                  <a
                    href={posting.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    title={posting.url}
                  >
                    <Badge variant="secondary">{posting.platform_name}</Badge>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </TableCell>
                <TableCell>
                  <p className="max-w-[300px] truncate text-sm">
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
                        target="_blank"
                        className={
                          !posting.llm_processed
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
                      >
                        <Eye className="size-4 text-green-500" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      title="Düzenle"
                    >
                      <Link href={`/edit/${posting.id}`} target="_blank">
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

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
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

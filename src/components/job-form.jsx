'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createJobPosting, updateJobPosting } from '@/lib/actions';

const PLATFORMS = [
  'linkedin',
  'otta',
  'techspark',
  'work_in_startups',
  'wellfound',
  'cwjobs',
  'indeed',
  'reed',
  'glassdoor',
  'cord',
  'cv_library',
  'built_in',
];

export function JobForm({ posting, mode = 'create' }) {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    platform_name: posting?.platform_name || 'linkedin',
    url: posting?.url || '',
    raw_text: posting?.raw_text || '',
    llm_processed: posting?.llm_processed ?? false,
  });

  const [initialData] = useState(formData);
  const [isPending, startTransition] = useTransition();
  const [reanalyzeModalOpen, setReanalyzeModalOpen] = useState(false);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleReanalyzeChange = (checked) => {
    // checked = true means user wants LLM to re-process (llm_processed = false)
    if (checked && posting?.llm_processed) {
      // Show confirmation modal
      setReanalyzeModalOpen(true);
    } else {
      handleChange('llm_processed', !checked);
    }
  };

  const confirmReanalyze = () => {
    handleChange('llm_processed', false);
    setReanalyzeModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.platform_name) {
      toast.error('Platform seçimi zorunludur.');
      return;
    }
    if (!formData.url) {
      toast.error('URL zorunludur.');
      return;
    }
    if (!formData.raw_text) {
      toast.error('İlan metni zorunludur.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateJobPosting(posting.id, formData);
          toast.success('İlan başarıyla güncellendi.');
        } else {
          await createJobPosting(formData);
          toast.success('İlan başarıyla kaydedildi.');
          // Reset form for create mode
          setFormData({
            platform_name: 'linkedin',
            url: '',
            raw_text: '',
            llm_processed: false,
          });
        }
      } catch (err) {
        console.error('Hata:', err);
        toast.error(err.message || 'Bir hata oluştu.');
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="platform">Platform</Label>
          <Select
            value={formData.platform_name}
            onValueChange={(value) => handleChange('platform_name', value)}
          >
            <SelectTrigger id="platform" className="w-full">
              <SelectValue placeholder="Platform seçiniz" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">Posting URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://..."
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="raw_text">Raw Text</Label>
          <Textarea
            id="raw_text"
            placeholder="İlan metnini buraya yapıştırın"
            value={formData.raw_text}
            onChange={(e) => handleChange('raw_text', e.target.value)}
            className="font-mono text-base h-[400px] resize-none"
          />
        </div>

        {isEdit && posting?.llm_model_version !== null && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="reanalyze"
              checked={formData.llm_processed === false}
              onCheckedChange={handleReanalyzeChange}
            />
            <Label htmlFor="reanalyze" className="cursor-pointer">
              LLM Tekrar İşlesin
            </Label>
          </div>
        )}

        <Button type="submit" disabled={isPending || (isEdit && !isDirty)}>
          {isPending
            ? isEdit
              ? 'Güncelleniyor...'
              : 'Kaydediliyor...'
            : isEdit
            ? 'Güncelle'
            : 'Kaydet'}
        </Button>
      </form>

      <Dialog open={reanalyzeModalOpen} onOpenChange={setReanalyzeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onay Gerekiyor</DialogTitle>
            <DialogDescription>
              LLM tüm ilan datasını baştan yorumlayacak ve token tüketecektir.
              Onaylıyor musunuz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReanalyzeModalOpen(false)}
            >
              İptal
            </Button>
            <Button variant="destructive" onClick={confirmReanalyze}>
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

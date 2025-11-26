import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getJobPosting } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Info,
  FileText,
  DollarSign,
  Tags,
  Bot,
  Code,
  ExternalLink,
} from 'lucide-react';
import dayjs from 'dayjs';

export const metadata = {
  title: 'İlan Detayı | Job Postings',
};

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-muted-foreground">{label}:</span>
      <span>{value || '-'}</span>
    </div>
  );
}

function TextBlock({ label, value }) {
  return (
    <div>
      <p className="mb-2 font-semibold text-muted-foreground">{label}:</p>
      <p className="whitespace-pre-wrap text-base">{value || '-'}</p>
    </div>
  );
}

function SkillBadges({ skills, variant = 'secondary', color }) {
  if (!skills?.length) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, i) => (
        <Badge key={i} variant={variant} className={color}>
          {skill}
        </Badge>
      ))}
    </div>
  );
}

export default async function ViewJobPage({ params }) {
  const { id } = await params;

  let posting;
  try {
    posting = await getJobPosting(id);
  } catch {
    notFound();
  }

  if (!posting) {
    notFound();
  }

  const getLLMDate = () => {
    if (!posting.llm_notes) return '-';
    try {
      const parts = posting.llm_notes.trim().split(' ');
      const dateStr = parts[parts.length - 1];
      const date = dayjs(dateStr);
      return date.isValid() ? date.format('DD/MM/YY HH:mm') : '-';
    } catch {
      return '-';
    }
  };

  return (
    <main className="container mx-auto max-w-4xl sm:">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">İlan Görüntüle</h1>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-start justify-between">
            <h1 className="text-2xl font-bold">
              <span className="text-muted-foreground">Platform:</span>{' '}
              {posting.platform_name}
            </h1>
            <Badge
              variant={posting.llm_processed ? 'default' : 'secondary'}
              className={
                posting.llm_processed
                  ? 'bg-green-600 hover:bg-green-600'
                  : 'bg-yellow-600 hover:bg-yellow-600'
              }
            >
              {posting.llm_processed ? 'İşlendi' : 'Bekliyor'}
            </Badge>
          </div>

          <a
            href={posting.url}
            className="mb-4 flex max-w-[50%] items-center gap-1 truncate text-primary hover:underline"
          >
            <ExternalLink className="size-4 shrink-0" />
            <span className="truncate">{posting.url}</span>
          </a>

          <div className="space-y-2 text-base">
            <InfoRow
              label="İlan Eklenme Tarihi"
              value={
                posting.scraped_at
                  ? dayjs(posting.scraped_at).format('DD/MM/YY HH:mm')
                  : '-'
              }
            />
            <InfoRow label="LLM İşleme Tarihi" value={getLLMDate()} />
          </div>
        </CardContent>
      </Card>

      {/* Accordion Sections */}
      <Accordion
        type="multiple"
        defaultValue={[
          'details',
          'description',
          'salary',
          'skills',
          'llm',
          'raw_text',
        ]}
        className="space-y-4"
      >
        {/* İlan Detayları */}
        <AccordionItem value="details" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-blue-500/20 text-blue-500">
                <Info className="size-4" />
              </div>
              <span className="font-semibold">İlan Detayları</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 pt-2">
            <InfoRow label="Pozisyon" value={posting.job_title} />
            <InfoRow label="Şirket" value={posting.company_name} />
            <InfoRow label="Konum" value={posting.location_text} />
            <InfoRow label="Çalışma Şekli" value={posting.work_mode} />
            <InfoRow label="İstihdam Türü" value={posting.employment_type} />
            <InfoRow label="Seviye" value={posting.seniority_level} />
            <InfoRow label="Alan" value={posting.domain} />
            <InfoRow
              label="Yayınlanma Tarihi"
              value={
                posting.posted_at
                  ? new Date(posting.posted_at).toLocaleDateString('tr-TR')
                  : '-'
              }
            />
          </AccordionContent>
        </AccordionItem>

        {/* Açıklama ve Gereksinimler */}
        <AccordionItem value="description" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-orange-500/20 text-orange-500">
                <FileText className="size-4" />
              </div>
              <span className="font-semibold">Açıklama ve Gereksinimler</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-4 pt-2">
            <TextBlock label="Açıklama" value={posting.description_full} />
            <TextBlock
              label="Sorumluluklar"
              value={posting.responsibilities_text}
            />
            <TextBlock
              label="Gereksinimler"
              value={posting.requirements_text}
            />
            <TextBlock label="Nice to Have" value={posting.nice_to_have_text} />
          </AccordionContent>
        </AccordionItem>

        {/* Maaş ve Yan Haklar */}
        <AccordionItem value="salary" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-green-500/20 text-green-500">
                <DollarSign className="size-4" />
              </div>
              <span className="font-semibold">Maaş ve Yan Haklar</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4 pt-2">
            <InfoRow
              label="Maaş Aralığı"
              value={
                posting.salary_min || posting.salary_max
                  ? `${posting.salary_min || '?'} - ${
                      posting.salary_max || '?'
                    } ${posting.salary_currency || ''} / ${
                      posting.salary_period || ''
                    }`
                  : '-'
              }
            />
            <TextBlock label="Yan Haklar" value={posting.benefits_text} />
          </AccordionContent>
        </AccordionItem>

        {/* Yetenekler ve Etiketler */}
        <AccordionItem value="skills" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-purple-500/20 text-purple-500">
                <Tags className="size-4" />
              </div>
              <span className="font-semibold">Yetenekler ve Etiketler</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-4 pt-2">
            <div>
              <p className="mb-3 font-semibold text-muted-foreground">
                Gerekli Yetenekler:
              </p>
              <SkillBadges skills={posting.skills_required} />
            </div>
            <div>
              <p className="mb-3 font-semibold text-muted-foreground">
                Tercih Sebebi Yetenekler:
              </p>
              <SkillBadges
                skills={posting.skills_nice_to_have}
                color="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              />
            </div>
            <div>
              <p className="mb-3 font-semibold text-muted-foreground">
                Etiketler:
              </p>
              <SkillBadges
                skills={posting.tags}
                variant="outline"
                color="border-muted-foreground/50"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* LLM İşlem Bilgileri */}
        <AccordionItem value="llm" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-500">
                <Bot className="size-4" />
              </div>
              <span className="font-semibold">LLM İşlem Bilgileri</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4 pt-2">
            <InfoRow
              label="Model Versiyonu"
              value={posting.llm_model_version}
            />
            <TextBlock label="LLM Notları" value={posting.llm_notes} />
          </AccordionContent>
        </AccordionItem>

        {/* Ham Metin */}
        <AccordionItem value="raw_text" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-gray-500/20 text-gray-400">
                <Code className="size-4" />
              </div>
              <span className="font-semibold">Ham Metin</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-base">
              {posting.raw_text}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </main>
  );
}

import { QuranStation } from './types';

export const STATIONS: QuranStation[] = [
  {
    id: 'cairo',
    name: 'إذاعة القرآن الكريم من القاهرة',
    description: 'البث المباشر الرسمي لإذاعة القرآن الكريم من جمهورية مصر العربية (قاهرة المعز)',
    streamUrl: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
    category: 'radio',
    country: 'مصر',
  },
  {
    id: 'makkah',
    name: 'إذاعة القرآن الكريم من مكة المكرمة',
    description: 'بث مباشر من الحرم المكي الشريف لتلاوات أئمة الحرم المكي',
    streamUrl: 'https://backup.qurango.net/radio/tarateel',
    category: 'radio',
    country: 'السعودية',
  },
  {
    id: 'minshawi',
    name: 'الشيخ محمد صديق المنشاوي',
    description: 'المصحف المرتل برواية حفص عن عاصم - صوت الخشوع والسكينة',
    streamUrl: 'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi',
    category: 'reciter',
    reciter: 'محمد صديق المنشاوي',
  },
  {
    id: 'abdulbasit',
    name: 'الشيخ عبد الباسط عبد الصمد',
    description: 'تلاوات خاشعة ومجودة من أندر تسجيلات صوت مكة',
    streamUrl: 'https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad',
    category: 'reciter',
    reciter: 'عبد الباسط عبد الصمد',
  },
  {
    id: 'hosary',
    name: 'الشيخ محمود خليل الحصري',
    description: 'المصحف المرتل مع الإتقان التام لأحكام التجويد',
    streamUrl: 'https://backup.qurango.net/radio/mahmoud_khalil_alhussary',
    category: 'reciter',
    reciter: 'محمود خليل الحصري',
  },
  {
    id: 'afasy',
    name: 'القارئ مشاري راشد العفاسي',
    description: 'تلاوات عذبة بصوت شجي ومؤثر',
    streamUrl: 'https://backup.qurango.net/radio/mishary_alafasi',
    category: 'reciter',
    reciter: 'مشاري العفاسي',
  },
  {
    id: 'tafsir',
    name: 'إذاعة تفسير القرآن الكريم',
    description: 'خواطر وتفسير آيات الذكر الحكيم لفضيلة الإمام محمد متولي الشعراوي',
    streamUrl: 'https://backup.qurango.net/radio/tafseer',
    category: 'tafsir',
  },
];

import { CategoryItem, SizeGuideConfig, SizeGuideId } from '../types/samo';

export const DEFAULT_FIT_NOTE_TITLE = 'ATELIER FIT NOTE';
export const DEFAULT_FIT_NOTE_TEXT =
  'For structured woven and satin pieces graded 38 to 46, size 38 corresponds to a Small (S). If you are between sizes or prefer a relaxed drape on non-stretch fabrics (like satin, raw denim, or heavy cow leather), we recommend taking the next size up.';

export const DEFAULT_SIZE_GUIDE_CONFIG: SizeGuideConfig = {
  masterEnabled: true,
  topsGuideEnabled: true,
  trousersGuideEnabled: true,
  fitNoteEnabled: true,
  fitNoteTitle: DEFAULT_FIT_NOTE_TITLE,
  fitNoteText: DEFAULT_FIT_NOTE_TEXT,
  tables: {
    tops_guide: {
      id: 'tops_guide',
      title: 'Tops, Jackets & Coats Size Guide',
      columns: [
        'EU',
        'International',
        'UK',
        'US',
        'Bust (cm)',
        'Waist (cm)',
        'Hips (cm)',
      ],
      rows: [
        ['34', 'XS', '6', '2', '80–84 cm', '62–66 cm', '88–92 cm'],
        ['36', 'S', '8', '4', '84–88 cm', '66–70 cm', '92–96 cm'],
        ['38', 'S', '10', '6', '88–92 cm', '70–74 cm', '96–100 cm'],
        ['40', 'M', '12', '8', '92–96 cm', '74–78 cm', '100–104 cm'],
        ['42', 'L', '14', '10', '96–100 cm', '78–82 cm', '104–108 cm'],
        ['44', 'XL', '16', '12', '100–104 cm', '82–86 cm', '108–112 cm'],
        ['46', 'XXL', '18', '14', '104–108 cm', '86–90 cm', '112–116 cm'],
      ],
    },
    trousers_guide: {
      id: 'trousers_guide',
      title: 'Trousers & Denim Size Guide',
      columns: [
        'Trousers / Denim',
        'EU Numeric',
        'International',
        'UK',
        'US',
        'Waist (cm)',
        'Hips (cm)',
      ],
      rows: [
        ['25', '32', 'XXS', '4', '0', '60–63 cm', '86–89 cm'],
        ['26', '34', 'XS', '6', '2', '64–67 cm', '90–93 cm'],
        ['27 / 28', '36', 'S', '8', '4', '68–71 cm', '94–97 cm'],
        ['29 / 30', '38', 'M', '10', '6', '72–75 cm', '98–101 cm'],
        ['31 / 32', '40', 'L', '12', '8', '76–79 cm', '102–105 cm'],
        ['33 / 34', '42', 'XL', '14', '10', '80–83 cm', '106–109 cm'],
        ['35 / 36', '44', 'XXL', '16', '12', '84–87 cm', '110–113 cm'],
      ],
    },
  },
};

/**
 * Infer default size guides for a category name if the admin hasn't explicitly
 * selected any checkboxes.
 */
export function inferDefaultSizeGuidesForCategory(categoryName: string): SizeGuideId[] {
  const norm = (categoryName || '').toLowerCase().trim();
  if (!norm) return [];

  // Sets or full sets get both guides
  if (
    norm.includes('set') ||
    norm.includes('suit') ||
    norm.includes('ensemble')
  ) {
    return ['tops_guide', 'trousers_guide'];
  }

  // Trousers, denim, pants, skirts, shorts
  if (
    norm.includes('trouser') ||
    norm.includes('pant') ||
    norm.includes('denim') ||
    norm.includes('skirt') ||
    norm.includes('short') ||
    norm.includes('jean') ||
    norm.includes('bottom')
  ) {
    return ['trousers_guide'];
  }

  // Tops, jackets, coats, shirts, knitwear, outerwear, dresses
  if (
    norm.includes('top') ||
    norm.includes('jacket') ||
    norm.includes('coat') ||
    norm.includes('shirt') ||
    norm.includes('blouse') ||
    norm.includes('knit') ||
    norm.includes('blazer') ||
    norm.includes('biker') ||
    norm.includes('bomber') ||
    norm.includes('trench') ||
    norm.includes('vest') ||
    norm.includes('outerwear') ||
    norm.includes('dress')
  ) {
    return ['tops_guide'];
  }

  return [];
}

/**
 * Resolves the active size guides for a category.
 * If manual overrides are configured on the category, respects them.
 * Otherwise falls back to intelligent category keyword inference.
 */
export function getCategoryActiveSizeGuides(
  category?: CategoryItem | null,
  categoryNameFallback?: string
): SizeGuideId[] {
  if (category && Array.isArray(category.sizeGuides)) {
    return category.sizeGuides;
  }
  const name = category?.name || categoryNameFallback || '';
  return inferDefaultSizeGuidesForCategory(name);
}

/**
 * Safely merges persisted or incoming SizeGuideConfig with the default structure.
 */
export function mergeSizeGuideConfig(
  incoming?: Partial<SizeGuideConfig> | null
): SizeGuideConfig {
  if (!incoming || typeof incoming !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_SIZE_GUIDE_CONFIG));
  }

  const def = DEFAULT_SIZE_GUIDE_CONFIG;

  const topsIncoming = incoming.tables?.tops_guide;
  const trousersIncoming = incoming.tables?.trousers_guide;

  return {
    masterEnabled:
      typeof incoming.masterEnabled === 'boolean'
        ? incoming.masterEnabled
        : def.masterEnabled,
    topsGuideEnabled:
      typeof incoming.topsGuideEnabled === 'boolean'
        ? incoming.topsGuideEnabled
        : def.topsGuideEnabled,
    trousersGuideEnabled:
      typeof incoming.trousersGuideEnabled === 'boolean'
        ? incoming.trousersGuideEnabled
        : def.trousersGuideEnabled,
    fitNoteEnabled:
      typeof incoming.fitNoteEnabled === 'boolean'
        ? incoming.fitNoteEnabled
        : def.fitNoteEnabled,
    fitNoteTitle:
      typeof incoming.fitNoteTitle === 'string' && incoming.fitNoteTitle.trim()
        ? incoming.fitNoteTitle
        : def.fitNoteTitle,
    fitNoteText:
      typeof incoming.fitNoteText === 'string' && incoming.fitNoteText.trim()
        ? incoming.fitNoteText
        : def.fitNoteText,
    tables: {
      tops_guide: {
        id: 'tops_guide',
        title:
          typeof topsIncoming?.title === 'string' && topsIncoming.title.trim()
            ? topsIncoming.title
            : def.tables.tops_guide.title,
        columns:
          Array.isArray(topsIncoming?.columns) && topsIncoming.columns.length > 0
            ? topsIncoming.columns.map(String)
            : [...def.tables.tops_guide.columns],
        rows:
          Array.isArray(topsIncoming?.rows) && topsIncoming.rows.length > 0
            ? topsIncoming.rows.map((row) =>
                Array.isArray(row) ? row.map(String) : []
              )
            : def.tables.tops_guide.rows.map((r) => [...r]),
      },
      trousers_guide: {
        id: 'trousers_guide',
        title:
          typeof trousersIncoming?.title === 'string' &&
          trousersIncoming.title.trim()
            ? trousersIncoming.title
            : def.tables.trousers_guide.title,
        columns:
          Array.isArray(trousersIncoming?.columns) &&
          trousersIncoming.columns.length > 0
            ? trousersIncoming.columns.map(String)
            : [...def.tables.trousers_guide.columns],
        rows:
          Array.isArray(trousersIncoming?.rows) &&
          trousersIncoming.rows.length > 0
            ? trousersIncoming.rows.map((row) =>
                Array.isArray(row) ? row.map(String) : []
              )
            : def.tables.trousers_guide.rows.map((r) => [...r]),
      },
    },
    updatedAt: incoming.updatedAt,
  };
}

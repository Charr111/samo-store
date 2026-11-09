import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIZE_GUIDE_CONFIG,
  getCategoryActiveSizeGuides,
  inferDefaultSizeGuidesForCategory,
  mergeSizeGuideConfig,
} from './sizeGuideLogic';
import { CategoryItem } from '../types/samo';

test('DEFAULT_SIZE_GUIDE_CONFIG has verified CM values and 7 rows each', () => {
  const tops = DEFAULT_SIZE_GUIDE_CONFIG.tables.tops_guide;
  const trousers = DEFAULT_SIZE_GUIDE_CONFIG.tables.trousers_guide;

  assert.equal(tops.id, 'tops_guide');
  assert.equal(tops.columns.length, 7);
  assert.equal(tops.rows.length, 7);
  assert.equal(tops.rows[0][0], '34');
  assert.equal(tops.rows[0][1], 'XS');
  assert.equal(tops.rows[0][4], '80–84 cm');

  assert.equal(trousers.id, 'trousers_guide');
  assert.equal(trousers.columns.length, 7);
  assert.equal(trousers.rows.length, 7);
  assert.equal(trousers.rows[0][0], '25');
  assert.equal(trousers.rows[0][1], '32');
  assert.equal(trousers.rows[0][5], '60–63 cm');

  assert.equal(DEFAULT_SIZE_GUIDE_CONFIG.masterEnabled, true);
  assert.equal(DEFAULT_SIZE_GUIDE_CONFIG.topsGuideEnabled, true);
  assert.equal(DEFAULT_SIZE_GUIDE_CONFIG.trousersGuideEnabled, true);
  assert.equal(DEFAULT_SIZE_GUIDE_CONFIG.fitNoteEnabled, true);
  assert.ok(DEFAULT_SIZE_GUIDE_CONFIG.fitNoteText.includes('structured woven'));
});

test('inferDefaultSizeGuidesForCategory auto-maps categories correctly', () => {
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Jacket'), ['tops_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Tops & Blouses'), ['tops_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Trousers'), ['trousers_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Denim & Pants'), ['trousers_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Full Set'), ['tops_guide', 'trousers_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Evening Suits'), ['tops_guide', 'trousers_guide']);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Accessories'), []);
  assert.deepEqual(inferDefaultSizeGuidesForCategory('Bags & Gifts'), []);
});

test('getCategoryActiveSizeGuides prioritizes manual admin category selection', () => {
  const customCat: CategoryItem = {
    id: 'cat_custom',
    name: 'Jacket', // default would be tops_guide
    slug: 'jacket',
    department: 'women',
    description: 'Custom',
    sizeGuides: ['trousers_guide'], // admin manually checked trousers_guide
  };
  assert.deepEqual(getCategoryActiveSizeGuides(customCat), ['trousers_guide']);

  const unconfiguredCat: CategoryItem = {
    id: 'cat_2',
    name: 'Coats',
    slug: 'coats',
    department: 'women',
    description: 'Coats',
  };
  assert.deepEqual(getCategoryActiveSizeGuides(unconfiguredCat), ['tops_guide']);
});

test('mergeSizeGuideConfig safely handles partial/empty input', () => {
  const merged = mergeSizeGuideConfig(null);
  assert.equal(merged.masterEnabled, true);
  assert.equal(merged.tables.tops_guide.rows.length, 7);

  const partialMerged = mergeSizeGuideConfig({
    masterEnabled: false,
    fitNoteTitle: 'CUSTOM FIT NOTE',
  });
  assert.equal(partialMerged.masterEnabled, false);
  assert.equal(partialMerged.fitNoteTitle, 'CUSTOM FIT NOTE');
  assert.equal(partialMerged.topsGuideEnabled, true);
});

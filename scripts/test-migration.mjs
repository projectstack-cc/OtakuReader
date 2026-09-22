// E2E: verifies the localStorage migration purges legacy Consumet ids from
// favorites, reading history, and reader-position keys while leaving real
// MangaDex uuids untouched. Run with dev server on :3000.
import { chromium } from 'playwright';

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('otakureader_favorites', JSON.stringify([
      { id: 'consumet::2~one-piece', title: 'One Piece (old)', coverUrl: 'x', addedAt: 1 },
      { id: 'a1c7c817-4e59-43b7-9365-09675a149a6f', title: 'One Piece', coverUrl: 'x', addedAt: 2 },
    ]));
    localStorage.setItem('otakureader_history', JSON.stringify([
      { mangaId: 'consumet::2~one-piece', chapterId: '2~10001000~one-piece-chapter-1', title: 'One Piece (old)', coverUrl: 'x', chapterTitle: 'Ch.1', page: 0, lastReadAt: 5, totalPages: 10 },
      { mangaId: 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b', chapterId: '73af4d8d-1532-4a72-b1b9-8f4e5cd295c9', title: 'Chainsaw Man', coverUrl: 'x', chapterTitle: 'Ch.1', page: 0, lastReadAt: 6, totalPages: 10 },
    ]));
    localStorage.setItem('otakureader_reader_state_consumet::2~one-piece', JSON.stringify({ '2~10001000~one-piece-chapter-1': 3 }));
    localStorage.setItem('otakureader_reader_state_a77742b1-befd-49a4-bff5-1ad4e6b0ef7b', JSON.stringify({ '73af4d8d-1532-4a72-b1b9-8f4e5cd295c9': 2 }));
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  // Wait for the migration marker (set at module-eval time) instead of a
  // fixed delay — a fixed wait races Vite's cold module transform.
  await page
    .waitForFunction(() => localStorage.getItem('otakureader_migrated_v2_mangadex_primary') !== null, null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => ({
    favs: JSON.parse(localStorage.getItem('otakureader_favorites') || '[]').map((f) => f.id),
    hist: JSON.parse(localStorage.getItem('otakureader_history') || '[]').map((h) => h.mangaId),
    readerKeys: Object.keys(localStorage).filter((k) => k.startsWith('otakureader_reader_state_')),
    migrated: !!localStorage.getItem('otakureader_migrated_v2_mangadex_primary'),
  }));

  console.log(JSON.stringify(state, null, 2));

  const pass =
    state.favs.length === 1 &&
    state.favs[0] === 'a1c7c817-4e59-43b7-9365-09675a149a6f' &&
    state.hist.length === 1 &&
    state.hist[0] === 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b' &&
    state.readerKeys.length === 1 &&
    state.readerKeys[0] === 'otakureader_reader_state_a77742b1-befd-49a4-bff5-1ad4e6b0ef7b' &&
    state.migrated === true;

  console.log(pass ? 'MIGRATION E2E: PASS' : 'MIGRATION E2E: FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
};

run().catch((e) => { console.error(e); process.exit(1); });
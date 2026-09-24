import { readFileSync } from 'node:fs';
import protobuf from 'protobufjs';

const SECRET = 'bce586fbb89a345f60082cac8ccf79d6';
const proto = protobuf.parse(readFileSync('./scripts/mangaplus_api.proto', 'utf8'), { keepCase: false }).root;
const Response = proto.lookupType('Response');
const unwrap = (buf) => {
  const r = Response.toObject(Response.decode(buf), { enums: String, defaults: false });
  if (r.error) return { error: r.error.englishPopup };
  return r.success;
};
const UA = 'okhttp/4.12.0';
const COMMON = 'os=android&os_ver=35&app_ver=237';
async function call(path) {
  const url = `https://jumpg-api.tokyo-cdn.com/api/${path}${path.includes('?') ? '&' : '?'}${COMMON}&device_secret=${SECRET}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', Connection: 'Keep-Alive' } });
  if (!res.ok) return { http: res.status };
  const buf = new Uint8Array(await res.arrayBuffer());
  return { http: res.status, data: unwrap(buf) };
}

// 1) title list (already-downloaded bin + fresh call to compare fields)
const fresh = await call('title_list/all_v3?type=serializing&lang=eng&clang=eng');
const s = fresh.data || {};
const fields = Object.keys(s);
console.log('all_v3 serializing -> success fields:', fields);
const titles = s.allTitlesView?.titles || s.allTitlesViewV2?.allTitlesGroup?.flatMap(g => g.titles) || [];
console.log('title count:', titles.length, 'sample:', JSON.stringify(titles.slice(0, 2)));
const target = titles.find(t => /one piece/i.test(t.name));
console.log('one piece:', JSON.stringify(target));

// 2) title detail for One Piece
if (target) {
  const det = await call(`title_detailV3?title_id=${target.titleId}&lang=eng&clang=eng`);
  const d = det.data?.titleDetailView;
  if (d) {
    console.log('detail fields:', Object.keys(d));
    console.log('firstChapterList:', d.firstChapterList?.length, 'lastChapterList:', d.lastChapterList?.length, 'chapterListV2:', d.chapterListV2?.length, 'chapterListGroup:', d.chapterListGroup?.length, 'ticketChapterList:', d.ticketChapterList?.length);
    const sample = (d.firstChapterList || d.chapterListV2 || [])[0];
    console.log('chapter sample:', JSON.stringify(sample));
  } else console.log('detail err:', JSON.stringify(det.data || det));

  // 3) manga_viewer for that chapter
  const ch = (d?.firstChapterList || d?.chapterListV2 || [])[0];
  if (ch) {
    const mv = await call(`manga_viewer?chapter_id=${ch.chapterId}&split=yes&img_quality=super_high&ticket_reading=no&free_reading=yes&subscription_reading=no&viewer_mode=vertical&clang=eng`);
    const v = mv.data?.mangaViewer;
    if (v) {
      const pages = (v.pages || []).map(p => p.mangaPage).filter(Boolean);
      console.log('viewer pages:', v.pages?.length, 'mangaPages:', pages.length);
      console.log('page sample:', JSON.stringify(pages[0]));
    } else console.log('viewer err:', JSON.stringify(mv.data || mv));
  }
}

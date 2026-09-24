import { readFileSync } from 'node:fs';
import protobuf from 'protobufjs';
import crypto from 'node:crypto';
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const proto = protobuf.parse(readFileSync('./scripts/mangaplus_api.proto', 'utf8'), { keepCase: false }).root;
const Response = proto.lookupType('Response');
const unwrap = (buf) => {
  const r = Response.toObject(Response.decode(buf), { enums: String, defaults: false });
  if (r.error) return { error: r.error.englishPopup || r.error }; 
  return r.success;
};
const UA = 'okhttp/4.12.0';
const COMMON = 'os=android&os_ver=35&app_ver=237';
async function call(path, secret) {
  const url = `https://jumpg-api.tokyo-cdn.com/api/${path}${path.includes('?') ? '&' : '?'}${COMMON}${secret ? '&deviceSecret=' + secret : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', Connection: 'Keep-Alive' } });
  if (!res.ok) return { http: res.status };
  return { http: res.status, data: unwrap(new Uint8Array(await res.arrayBuffer())) };
}
// register
const deviceId = 'otakureader-test-device-002';
const deviceToken = md5(deviceId);
const securityKey = md5(deviceToken + '4Kin9vGg');
const regUrl = `https://jumpg-api.tokyo-cdn.com/api/register?device_token=${deviceToken}&security_key=${securityKey}&${COMMON}`;
const regRes = await fetch(regUrl, { method: 'PUT', headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity' } });
const regBuf = new Uint8Array(await regRes.arrayBuffer());
console.log('register http:', regRes.status, 'bytes:', regBuf.length);
const reg = unwrap(regBuf);
const secret = reg?.deviceSecret || reg?.registerSuccess?.deviceSecret;
console.log('secret present:', !!secret, secret ? String(secret).slice(0,8)+'...' : '');
// catalog
for (const t of ['serializing', 'completed']) {
  const cat = await call(`title_list/all_v3?type=${t}&lang=eng&clang=eng`, secret);
  const s = cat.data || {};
  const titles = s.allTitlesView?.titles || s.allTitlesViewV2?.allTitlesGroup?.flatMap(g => g.titles || []) || [];
  console.log(`all_v3 ${t}: http=${cat.http} successKeys=${Object.keys(s)} count=${titles.length}`);
  if (t === 'serializing') {
    const op = titles.find(x => /one piece/i.test(x.name));
    console.log('  one piece:', JSON.stringify(op));
    if (op) {
      const det = await call(`title_detailV3?title_id=${op.titleId}&lang=eng&clang=eng`, secret);
      const d = det.data?.titleDetailView;
      if (d) {
        console.log('  detail keys:', Object.keys(d).join(','));
        console.log('  firstChapterList:', d.firstChapterList?.length, 'lastChapterList:', d.lastChapterList?.length, 'chapterListV2:', d.chapterListV2?.length);
        const ch = (d.chapterListV2 || d.firstChapterList || [])[0];
        console.log('  chapter sample:', JSON.stringify(ch));
        const chLast = (d.lastChapterList || [])[0];
        console.log('  last ch sample:', JSON.stringify(chLast));
        if (ch) {
          const vw = await call(`manga_viewer?chapter_id=${ch.chapterId}&split=yes&img_quality=super_high&ticket_reading=no&free_reading=yes&subscription_reading=no&viewer_mode=vertical&clang=eng`, secret);
          const v = vw.data?.mangaViewer;
          if (v) {
            const pages = (v.pages || []).map(p => p.mangaPage).filter(Boolean);
            console.log('  viewer pages:', pages.length, 'sample:', JSON.stringify(pages[0]));
          } else console.log('  viewer err:', JSON.stringify(vw.data || vw).slice(0,200));
        }
      } else console.log('  detail err:', JSON.stringify(det.data || det).slice(0,200));
    }
  }
}

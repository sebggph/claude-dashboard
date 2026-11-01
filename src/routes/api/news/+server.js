import { json } from '@sveltejs/kit';
import { getNews } from '#lib/server/news.js';

export async function GET({ url }) {
  return json(await getNews({ force: url.searchParams.get('refresh') === '1' }), { headers: { 'cache-control': 'no-store' } });
}

import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { linkGaps, listBundles, listCategories, listItems } from '../../_structure';

// 블로그 구조 화면 한 번에: 카테고리·글(배치 포함)·묶음·묶음별 빠진 링크
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const [categories, { items, bodies }, bundles] = await Promise.all([listCategories(db, user), listItems(db, user), listBundles(db, user)]);
  return json({ categories, items, bundles, gaps: linkGaps(bundles, items, bodies) });
};

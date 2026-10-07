import dayjs from 'dayjs';
import { Application, Context } from 'egg';
import { comparePassword, encryptPassword } from '@/app/utils/bcrypt';
import { creatJwtToken, getJwtTokenMsg } from '@/app/utils/jwt';

interface DemoUser {
  id: number;
  account: string;
  encPassword: string;
}

interface DemoApp {
  id: number;
  appId: string;
  appName: string;
  createId: number;
  appType: number;
  status: number;
}

const users = new Map<string, DemoUser>();
const apps: DemoApp[] = [
  {
    id: 1,
    appId: 'demo-react-app',
    appName: 'React 电商管理后台',
    createId: 1,
    appType: 1,
    status: 1,
  },
];

let nextUserId = 2;
let nextAppId = 2;

const ok = (ctx: Context, data?: unknown) => {
  ctx.body = { code: 1000, message: '请求成功', data };
};

const fail = (ctx: Context, code: number, message: string) => {
  ctx.body = { code, message };
};

const getUserId = async(ctx: Context) => {
  const token = ctx.cookies.get('BLUBIUTOKEN');
  if (!token) return null;
  try {
    const data = await getJwtTokenMsg<{ userId: number }>(token);
    return data.userId || null;
  } catch {
    return null;
  }
};

const labels = (beginTime?: string, endTime?: string) => {
  let cursor = dayjs(beginTime || dayjs().add(-6, 'day'));
  const end = dayjs(endTime || dayjs());
  const result: string[] = [];
  while (cursor.diff(end, 'day') <= 0 && result.length < 62) {
    result.push(cursor.format('MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return result;
};

const trend = (beginTime?: string, endTime?: string, base = 30) => labels(beginTime, endTime).map((label, index) => ({
  label,
  value: base + ((index * 17 + 11) % Math.max(base, 12)),
}));

const traffic = (keys: string[]) => {
  const pageViews: Record<string, number> = {};
  const uniqueIPsCount: Record<string, number> = {};
  const uniqueVisitors: Record<string, number> = {};
  keys.forEach((key, index) => {
    pageViews[key] = 180 + ((index * 47) % 320);
    uniqueVisitors[key] = 90 + ((index * 29) % 150);
    uniqueIPsCount[key] = 70 + ((index * 23) % 120);
  });
  return { pageViews, uniqueIPsCount, uniqueVisitors };
};

const performanceRows = [
  { pageUrl: '/dashboard', whiteTime: 428, fcp: 612, lcp: 1028, fid: 18, ttfb: 96, dnsTime: 12, tcpTime: 28 },
  { pageUrl: '/products', whiteTime: 536, fcp: 745, lcp: 1286, fid: 24, ttfb: 118, dnsTime: 18, tcpTime: 35 },
  { pageUrl: '/orders', whiteTime: 683, fcp: 892, lcp: 1460, fid: 31, ttfb: 132, dnsTime: 16, tcpTime: 41 },
];

const httpRows = [
  { url: '/api/orders', link: '/dashboard', method: 'GET', requestType: 'done', type: 'xhr', status: 200, cost: 186, reqHeaders: '{"Accept":"application/json"}', reqBody: '-', '@timestamp': new Date().toISOString(), userTimeStamp: Date.now(), pageUrl: '/dashboard' },
  { url: '/api/products', link: '/products', method: 'GET', requestType: 'done', type: 'fetch', status: 200, cost: 268, reqHeaders: '{"Accept":"application/json"}', reqBody: '-', '@timestamp': new Date(Date.now() - 20000).toISOString(), userTimeStamp: Date.now() - 20000, pageUrl: '/products' },
  { url: '/api/coupons', link: '/checkout', method: 'POST', requestType: 'error', type: 'xhr', status: 500, cost: 1236, reqHeaders: '{"Content-Type":"application/json"}', reqBody: '{"coupon":"DEMO20"}', '@timestamp': new Date(Date.now() - 40000).toISOString(), userTimeStamp: Date.now() - 40000, pageUrl: '/checkout' },
];

const tops: Record<string, Array<{ label: string; value: number }>> = {
  webVisit: [ { label: '/dashboard', value: 3258 }, { label: '/products', value: 2486 }, { label: '/orders', value: 1764 } ],
  browser: [ { label: 'Chrome', value: 4580 }, { label: 'Edge', value: 1260 }, { label: 'Safari', value: 920 } ],
  deviceVendor: [ { label: 'Desktop', value: 3810 }, { label: 'Apple', value: 1720 }, { label: 'Android', value: 1230 } ],
  city: [ { label: '广东', value: 1680 }, { label: '北京', value: 1320 }, { label: '上海', value: 1160 }, { label: '浙江', value: 860 } ],
  osName: [ { label: 'Windows', value: 3420 }, { label: 'macOS', value: 1760 }, { label: 'Android', value: 980 }, { label: 'iOS', value: 600 } ],
};

const authenticate = async(ctx: Context) => {
  const userId = await getUserId(ctx);
  if (!userId) {
    fail(ctx, 1005, '登录已过期');
    return null;
  }
  return userId;
};

export default (_options: unknown, app: Application) => {
  app.beforeStart(async() => {
    if (!users.has('demo2026')) {
      users.set('demo2026', {
        id: 1,
        account: 'demo2026',
        encPassword: await encryptPassword('Demo2026'),
      });
    }
  });

  return async(ctx: Context, next: () => Promise<void>) => {
    const path = ctx.path;
    if (path === '/report') {
      ctx.status = 204;
      return;
    }
    if (!path.startsWith('/api/desktop/')) return next();

    if (path === '/api/desktop/register' && ctx.method === 'POST') {
      const { account, password } = ctx.request.body as { account?: string; password?: string };
      if (!account || !password || !/^[a-zA-Z0-9]{6,10}$/.test(account) || !/^[a-zA-Z0-9]{6,10}$/.test(password)) {
        fail(ctx, 1001, '账号和密码需为6至10位字母或数字');
      } else if (users.has(account)) {
        fail(ctx, 1004, '该账号已被注册');
      } else {
        users.set(account, { id: nextUserId++, account, encPassword: await encryptPassword(password) });
        ok(ctx);
      }
      return;
    }

    if (path === '/api/desktop/login' && ctx.method === 'POST') {
      const { account, password } = ctx.request.body as { account?: string; password?: string };
      const user = account ? users.get(account) : undefined;
      if (!user || !password || !(await comparePassword(password, user.encPassword))) {
        fail(ctx, 1003, '登录账号或密码错误');
      } else {
        ctx.cookies.set('BLUBIUTOKEN', creatJwtToken({ userId: user.id }), {
          httpOnly: true,
          sameSite: 'lax',
          expires: dayjs().add(1, 'day').toDate(),
        });
        ok(ctx);
      }
      return;
    }

    if (path === '/api/desktop/loginOut' && ctx.method === 'POST') {
      ctx.cookies.set('BLUBIUTOKEN', null, { expires: dayjs().add(-1, 'day').toDate() });
      ok(ctx);
      return;
    }

    const userId = await authenticate(ctx);
    if (!userId) return;

    if (path === '/api/desktop/getUserInfo') {
      const user = [ ...users.values() ].find(item => item.id === userId);
      ok(ctx, { id: userId, account: user?.account || 'demo2026', status: 1 });
    } else if (path === '/api/desktop/getAppList') {
      ok(ctx, apps.filter(item => item.createId === userId || userId === 1));
    } else if (path === '/api/desktop/createApp' && ctx.method === 'POST') {
      const { appName, appType } = ctx.request.body as { appName?: string; appType?: number };
      apps.push({ id: nextAppId, appId: `demo-app-${nextAppId}`, appName: appName || `演示应用${nextAppId}`, createId: userId, appType: Number(appType) || 1, status: 1 });
      nextAppId++;
      ok(ctx);
    } else if (path === '/api/desktop/updateAppStatus' && ctx.method === 'POST') {
      const { id, status } = ctx.request.body as { id?: number; status?: number };
      const target = apps.find(item => item.id === Number(id));
      if (target) target.status = Number(status);
      ok(ctx);
    } else if (path.endsWith('/analyse/getDayActiveUsers')) {
      ok(ctx, 286 + (dayjs(ctx.query.date as string).date() || 0));
    } else if (path.endsWith('/analyse/getAllUsers')) {
      ok(ctx, 12846);
    } else if (path.endsWith('/analyse/getNewUsers')) {
      ok(ctx, 164);
    } else if (path.endsWith('/analyse/getActiveUsers')) {
      ok(ctx, trend(ctx.query.beginTime as string, ctx.query.endTime as string, 180));
    } else if (path.endsWith('/analyse/getTodayTraffic')) {
      ok(ctx, { allUsers: 12846, activeUsers: [ 318, 286 ], newUsers: [ 164, 139 ], pv: [ 4862, 4318 ], ip: [ 2310, 2096 ] });
    } else if (path.endsWith('/analyse/getWebVisitTop')) {
      ok(ctx, tops[String(ctx.query.type || 'webVisit')] || tops.webVisit);
    } else if (path.endsWith('/traffic/getTrafficTimes')) {
      ok(ctx, traffic(Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`)));
    } else if (path.endsWith('/traffic/getTrafficDays')) {
      const days = labels(ctx.query.beginTime as string, ctx.query.endTime as string).map(label => `${dayjs().format('YYYY')}-${label}`);
      ok(ctx, traffic(days));
    } else if (path.endsWith('/performance/getAppAvgPerformance')) {
      ok(ctx, { whiteTime: { value: 549 }, fcp: { value: 760 }, lcp: { value: 1258 }, fid: { value: 24 }, ttfb: { value: 115 }, fastRote: { value: 0.86 }, slowRote: { value: 0.03 } });
    } else if (path.endsWith('/performance/getPageAvgPerformance')) {
      ok(ctx, performanceRows.map(({ pageUrl, ...metrics }) => ({
        key: pageUrl,
        ...Object.fromEntries(Object.entries(metrics).map(([ key, value ]) => [ key, { value } ])),
      })));
    } else if (path.endsWith('/performance/getPerformance')) {
      ok(ctx, { total: performanceRows.length, data: performanceRows.map((item, index) => ({ _id: `performance-${index + 1}`, _source: { ...item, userTimeStamp: Date.now() - index * 120000, domain: 'demo.example.com', browserName: 'Chrome', osName: 'Windows' } })) });
    } else if (path.endsWith('/httpError/getHttpErrorRank')) {
      ok(ctx, [ { doc_count: 18, key: { method: 'POST', requestType: 'error', type: 'xhr', url: '/api/coupons' }, avg_cost: { value: 1236 } }, { doc_count: 9, key: { method: 'GET', requestType: 'error', type: 'fetch', url: '/api/inventory' }, avg_cost: { value: 864 } } ]);
    } else if (path.endsWith('/httpError/getHttpDoneRank')) {
      ok(ctx, [ { doc_count: 126, key: { method: 'GET', requestType: 'done', type: 'fetch', url: '/api/products' }, avg_cost: { value: 268 } }, { doc_count: 98, key: { method: 'POST', requestType: 'done', type: 'xhr', url: '/api/orders' }, avg_cost: { value: 486 } } ]);
    } else if (path.endsWith('/httpError/getHttpErrorRang')) {
      ok(ctx, trend(ctx.query.beginTime as string, ctx.query.endTime as string, 8));
    } else if (path.endsWith('/httpError/getHttpList')) {
      ok(ctx, { total: httpRows.length, data: httpRows.map((item, index) => ({ _id: `http-${index + 1}`, _source: item })) });
    } else if (path.endsWith('/jsError/getJsErrorRang')) {
      ok(ctx, trend(ctx.query.beginTime as string, ctx.query.endTime as string, 4));
    } else if (path.endsWith('/jsError/getJsErrorList')) {
      ok(ctx, [ { message: 'Cannot read properties of undefined', filename: 'https://demo.example.com/static/app.js', lineno: 128, colno: 24, errorCount: 12, userIds: [ 'u1024', 'u2048', 'u4096' ], stack: 'TypeError: Cannot read properties of undefined\n    at renderOrder (app.js:128:24)', pageUrl: '/orders' } ]);
    } else if (path.endsWith('/jsError/getNearbyCode')) {
      ok(ctx, { code: [], originalPosition: { source: '', line: 0, column: 0, name: '' }, source: '', start: 0 });
    } else {
      await next();
    }
  };
};

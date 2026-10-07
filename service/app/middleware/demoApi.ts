import dayjs from 'dayjs';
import { promises as fs } from 'fs';
import { join } from 'path';
import UAParser from 'ua-parser-js';
import { Application, Context } from 'egg';
import { comparePassword, encryptPassword } from '@/app/utils/bcrypt';
import { creatJwtToken, getJwtTokenMsg } from '@/app/utils/jwt';

type TelemetryEvent = Record<string, any> & { appId: string; type: string; markUserId: string; userTimeStamp: number };
interface DemoUser { id: number; account: string; encPassword: string }
interface DemoApp { id: number; appId: string; appName: string; createId: number; appType: number; status: number }

const users = new Map<string, DemoUser>();
const apps: DemoApp[] = [ { id: 1, appId: 'xiaomu-survey', appName: '小慕问卷', createId: 1, appType: 1, status: 1 } ];
let nextUserId = 2;
let nextAppId = 2;

const ok = (ctx: Context, data?: unknown) => { ctx.body = { code: 1000, message: '请求成功', data }; };
const fail = (ctx: Context, code: number, message: string) => { ctx.body = { code, message }; };
const value = (number: number) => ({ value: Number.isFinite(number) ? number : 0 });
const numberOf = (input: unknown) => Number.isFinite(Number(input)) ? Number(input) : 0;
const visitor = (event: TelemetryEvent) => event.markUserId || event.userId || 'anonymous';
const dateOf = (event: TelemetryEvent) => dayjs(event.userTimeStamp);
const unique = (items: string[]) => new Set(items.filter(Boolean)).size;
const pageEvents = (items: TelemetryEvent[]) => items.filter(item => item.type === 'pageView');
const requestEvents = (items: TelemetryEvent[]) => items.filter(item => item.type === 'request');
const performanceEvents = (items: TelemetryEvent[]) => items.filter(item => item.type === 'performance');
const errorEvents = (items: TelemetryEvent[]) => items.filter(item => [ 'jsError', 'rejectError', 'loadResourceError' ].includes(item.type));

const labels = (beginTime?: string, endTime?: string) => {
  let cursor = dayjs(beginTime || dayjs().subtract(6, 'day')).startOf('day');
  const end = dayjs(endTime || dayjs()).endOf('day');
  const result: string[] = [];
  while (cursor.valueOf() <= end.valueOf() && result.length < 62) {
    result.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return result;
};

const inRange = (event: TelemetryEvent, beginTime?: string, endTime?: string) => {
  const begin = beginTime ? dayjs(beginTime).valueOf() : -Infinity;
  const end = endTime ? dayjs(endTime).valueOf() : Infinity;
  return event.userTimeStamp >= begin && event.userTimeStamp <= end;
};

const groupCounts = (items: TelemetryEvent[], getKey: (item: TelemetryEvent) => string) => {
  const result = new Map<string, number>();
  items.forEach(item => { const key = getKey(item) || '未知'; result.set(key, (result.get(key) || 0) + 1); });
  return result;
};

const getUserId = async(ctx: Context) => {
  const token = ctx.cookies.get('BLUBIUTOKEN');
  if (!token) return null;
  try { return (await getJwtTokenMsg<{ userId: number }>(token)).userId || null; } catch { return null; }
};
const authenticate = async(ctx: Context) => {
  const userId = await getUserId(ctx);
  if (!userId) { fail(ctx, 1005, '登录已过期'); return null; }
  return userId;
};

export default (_options: unknown, app: Application) => {
  const telemetryFile = join(app.baseDir, 'run', 'telemetry.jsonl');
  const telemetry: TelemetryEvent[] = [];

  app.beforeStart(async() => {
    if (!users.has('demo2026')) users.set('demo2026', { id: 1, account: 'demo2026', encPassword: await encryptPassword('Demo2026') });
    await fs.mkdir(join(app.baseDir, 'run'), { recursive: true });
    try {
      const content = await fs.readFile(telemetryFile, 'utf8');
      content.split('\n').filter(Boolean).forEach(line => { try { telemetry.push(JSON.parse(line)); } catch { /* ignore partial line */ } });
      if (telemetry.length > 20000) telemetry.splice(0, telemetry.length - 20000);
    } catch (error: any) {
      if (error.code !== 'ENOENT') app.logger.warn('Unable to load local telemetry: %s', error.message);
    }
  });

  const queryEvents = (ctx: Context) => telemetry.filter(event =>
    (!ctx.query.appId || event.appId === ctx.query.appId)
    && inRange(event, ctx.query.beginTime as string, ctx.query.endTime as string)
  );

  return async(ctx: Context, next: () => Promise<void>) => {
    const path = ctx.path;
    if (path === '/report') {
      let payload: unknown;
      try { payload = ctx.method === 'POST' ? ctx.request.body : JSON.parse(String(ctx.query.data || '[]')); }
      catch { fail(ctx, 1001, '监控数据格式错误'); return; }
      const parser = new UAParser(ctx.get('user-agent'));
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();
      const incoming = (Array.isArray(payload) ? payload : [ payload ]).filter(item => item && typeof item === 'object') as Record<string, any>[];
      const now = Date.now();
      const accepted = incoming.slice(0, 100).map(item => ({
        ...item,
        appId: String(item.appId || ctx.query.appId || ''),
        type: String(item.type || 'unknown'),
        markUserId: String(item.markUserId || 'anonymous'),
        userTimeStamp: numberOf(item.userTimeStamp) || now,
        '@timestamp': new Date(numberOf(item.userTimeStamp) || now).toISOString(),
        ip: ctx.ip || 'unknown',
        browserName: browser.name || '未知', osName: os.name || '未知',
        deviceVendor: device.vendor || device.type || 'Desktop',
        city: [ '127.0.0.1', '::1' ].includes(ctx.ip) || ctx.ip.startsWith('192.168.') ? '本机' : '未知',
      })).filter(item => item.appId);
      if (accepted.length) {
        telemetry.push(...accepted);
        if (telemetry.length > 20000) telemetry.splice(0, telemetry.length - 20000);
        await fs.appendFile(telemetryFile, `${accepted.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8');
      }
      ctx.status = 204;
      return;
    }
    if (!path.startsWith('/api/desktop/')) return next();

    if (path === '/api/desktop/register' && ctx.method === 'POST') {
      const { account, password } = ctx.request.body as { account?: string; password?: string };
      if (!account || !password || !/^[a-zA-Z0-9]{6,10}$/.test(account) || !/^[a-zA-Z0-9]{6,10}$/.test(password)) fail(ctx, 1001, '账号和密码需为6至10位字母或数字');
      else if (users.has(account)) fail(ctx, 1004, '该账号已被注册');
      else { users.set(account, { id: nextUserId++, account, encPassword: await encryptPassword(password) }); ok(ctx); }
      return;
    }
    if (path === '/api/desktop/login' && ctx.method === 'POST') {
      const { account, password } = ctx.request.body as { account?: string; password?: string };
      const user = account ? users.get(account) : undefined;
      if (!user || !password || !(await comparePassword(password, user.encPassword))) fail(ctx, 1003, '登录账号或密码错误');
      else { ctx.cookies.set('BLUBIUTOKEN', creatJwtToken({ userId: user.id }), { httpOnly: true, sameSite: 'lax', expires: dayjs().add(1, 'day').toDate() }); ok(ctx); }
      return;
    }
    if (path === '/api/desktop/loginOut' && ctx.method === 'POST') {
      ctx.cookies.set('BLUBIUTOKEN', null, { expires: dayjs().subtract(1, 'day').toDate() }); ok(ctx); return;
    }

    const userId = await authenticate(ctx);
    if (!userId) return;
    const events = queryEvents(ctx);

    if (path === '/api/desktop/getUserInfo') {
      const user = [ ...users.values() ].find(item => item.id === userId);
      ok(ctx, { id: userId, account: user?.account || 'demo2026', status: 1 });
    } else if (path === '/api/desktop/getAppList') ok(ctx, apps.filter(item => item.createId === userId || userId === 1));
    else if (path === '/api/desktop/createApp' && ctx.method === 'POST') {
      const { appName, appType } = ctx.request.body as { appName?: string; appType?: number };
      apps.push({ id: nextAppId, appId: `demo-app-${nextAppId}`, appName: appName || `演示应用${nextAppId}`, createId: userId, appType: Number(appType) || 1, status: 1 }); nextAppId++; ok(ctx);
    } else if (path === '/api/desktop/updateAppStatus' && ctx.method === 'POST') {
      const target = apps.find(item => item.id === Number((ctx.request.body as any).id));
      if (target) target.status = Number((ctx.request.body as any).status); ok(ctx);
    } else if (path.endsWith('/analyse/getDayActiveUsers')) {
      const date = String(ctx.query.date || dayjs().format('YYYY-MM-DD'));
      ok(ctx, unique(events.filter(item => dateOf(item).format('YYYY-MM-DD') === date).map(visitor)));
    } else if (path.endsWith('/analyse/getAllUsers')) ok(ctx, unique(events.map(visitor)));
    else if (path.endsWith('/analyse/getNewUsers')) {
      const targetDate = String(ctx.query.date || dayjs().format('YYYY-MM-DD'));
      const firstSeen = new Map<string, number>();
      telemetry.filter(item => !ctx.query.appId || item.appId === ctx.query.appId).forEach(item => {
        const id = visitor(item); firstSeen.set(id, Math.min(firstSeen.get(id) || Infinity, item.userTimeStamp));
      });
      ok(ctx, [ ...firstSeen.values() ].filter(time => dayjs(time).format('YYYY-MM-DD') === targetDate).length);
    } else if (path.endsWith('/analyse/getActiveUsers')) {
      ok(ctx, labels(ctx.query.beginTime as string, ctx.query.endTime as string).map(date => ({ label: dayjs(date).format('MM-DD'), value: unique(events.filter(item => dateOf(item).format('YYYY-MM-DD') === date).map(visitor)) })));
    } else if (path.endsWith('/analyse/getTodayTraffic')) {
      const firstSeen = new Map<string, number>();
      events.forEach(item => { const id = visitor(item); firstSeen.set(id, Math.min(firstSeen.get(id) || Infinity, item.userTimeStamp)); });
      const stats = (date: dayjs.Dayjs) => {
        const selected = events.filter(item => dateOf(item).format('YYYY-MM-DD') === date.format('YYYY-MM-DD'));
        const dateKey = date.format('YYYY-MM-DD');
        return { users: unique(selected.map(visitor)), newUsers: [ ...firstSeen.values() ].filter(time => dayjs(time).format('YYYY-MM-DD') === dateKey).length,
          pv: pageEvents(selected).length, ip: unique(selected.map(item => item.ip)) };
      };
      const today = stats(dayjs()); const yesterday = stats(dayjs().subtract(1, 'day'));
      ok(ctx, { allUsers: unique(events.map(visitor)), activeUsers: [ today.users, yesterday.users ], newUsers: [ today.newUsers, yesterday.newUsers ], pv: [ today.pv, yesterday.pv ], ip: [ today.ip, yesterday.ip ] });
    } else if (path.endsWith('/analyse/getWebVisitTop')) {
      const type = String(ctx.query.type || 'webVisit');
      const key = (item: TelemetryEvent) => type === 'webVisit' ? item.pageUrl : item[type === 'browser' ? 'browserName' : type];
      const counts = groupCounts(pageEvents(events), key); const top = Math.max(1, Number(ctx.query.top) || 10);
      ok(ctx, [ ...counts.entries() ].sort((a, b) => b[1] - a[1]).slice(0, top).map(([ label, count ]) => ({ label, value: count })));
    } else if (path.endsWith('/traffic/getTrafficTimes')) {
      const date = String(ctx.query.date || dayjs().format('YYYY-MM-DD'));
      const selected = pageEvents(events).filter(item => dateOf(item).format('YYYY-MM-DD') === date && (!ctx.query.pageUrl || item.pageUrl === ctx.query.pageUrl));
      const result = { pageViews: {}, uniqueIPsCount: {}, uniqueVisitors: {} } as Record<string, Record<string, number>>;
      Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`).forEach(hour => {
        const items = selected.filter(item => dateOf(item).format('HH:00') === hour);
        result.pageViews[hour] = items.length; result.uniqueIPsCount[hour] = unique(items.map(item => item.ip)); result.uniqueVisitors[hour] = unique(items.map(visitor));
      }); ok(ctx, result);
    } else if (path.endsWith('/traffic/getTrafficDays')) {
      const selected = pageEvents(events).filter(item => !ctx.query.pageUrl || item.pageUrl === ctx.query.pageUrl);
      const result = { pageViews: {}, uniqueIPsCount: {}, uniqueVisitors: {} } as Record<string, Record<string, number>>;
      labels(ctx.query.beginTime as string, ctx.query.endTime as string).forEach(date => {
        const items = selected.filter(item => dateOf(item).format('YYYY-MM-DD') === date);
        result.pageViews[date] = items.length; result.uniqueIPsCount[date] = unique(items.map(item => item.ip)); result.uniqueVisitors[date] = unique(items.map(visitor));
      }); ok(ctx, result);
    } else if (path.endsWith('/performance/getAppAvgPerformance')) {
      const rows = performanceEvents(events); const avg = (key: string) => rows.length ? rows.reduce((sum, item) => sum + numberOf(item[key]), 0) / rows.length : 0;
      ok(ctx, { whiteTime: value(avg('whiteTime')), fcp: value(avg('fcp')), lcp: value(avg('lcp')), fid: value(avg('fid')), ttfb: value(avg('ttfb')),
        fastRote: value(rows.length ? rows.filter(item => numberOf(item.whiteTime) <= 1000).length / rows.length : 0), slowRote: value(rows.length ? rows.filter(item => numberOf(item.whiteTime) > 3000).length / rows.length : 0) });
    } else if (path.endsWith('/performance/getPageAvgPerformance')) {
      const rows = performanceEvents(events); const groups = new Map<string, TelemetryEvent[]>();
      rows.forEach(item => groups.set(item.pageUrl || '/', [ ...(groups.get(item.pageUrl || '/') || []), item ]));
      ok(ctx, [ ...groups.entries() ].map(([ pageUrl, items ]) => {
        const avg = (key: string) => items.reduce((sum, item) => sum + numberOf(item[key]), 0) / items.length;
        return { key: pageUrl, doc_count: items.length, ...Object.fromEntries([ 'whiteTime', 'fcp', 'lcp', 'fid', 'ttfb', 'dnsTime', 'tcpTime' ].map(key => [ key, value(avg(key)) ])) };
      }));
    } else if (path.endsWith('/performance/getPerformance')) {
      let rows = performanceEvents(events).filter(item => !ctx.query.pageUrl || String(item.pageUrl).includes(String(ctx.query.pageUrl)));
      const whiteTime = Number(ctx.query.whiteTime);
      if (whiteTime) rows = rows.filter(item => { const seconds = numberOf(item.whiteTime) / 1000; return whiteTime === 1 ? seconds <= 1 : whiteTime === 2 ? seconds > 1 && seconds <= 2 : whiteTime === 3 ? seconds > 2 && seconds <= 3 : seconds > 3; });
      const sorter = String(ctx.query.sorterName || 'userTimeStamp'); const direction = ctx.query.sorterKey === 'asc' ? 1 : -1;
      rows.sort((a, b) => (numberOf(a[sorter]) - numberOf(b[sorter])) * direction);
      const page = Math.max(1, Number(ctx.query.from) || 1); const size = Math.max(1, Number(ctx.query.size) || 10);
      ok(ctx, { total: rows.length, data: rows.slice((page - 1) * size, page * size).map((item, index) => ({ _id: `performance-${item.userTimeStamp}-${index}`, _source: item })) });
    } else if (path.endsWith('/httpError/getHttpErrorRank') || path.endsWith('/httpError/getHttpDoneRank')) {
      const requestType = path.includes('ErrorRank') ? 'error' : 'done'; const rows = requestEvents(events).filter(item => item.requestType === requestType); const groups = new Map<string, TelemetryEvent[]>();
      rows.forEach(item => { const key = `${item.method}|${item.transport}|${item.url}`; groups.set(key, [ ...(groups.get(key) || []), item ]); });
      ok(ctx, [ ...groups.values() ].sort((a, b) => b.length - a.length).slice(0, 10).map(items => ({ doc_count: items.length, key: { method: items[0].method, requestType, type: items[0].transport || 'xhr', url: items[0].url }, avg_cost: value(items.reduce((sum, item) => sum + numberOf(item.cost), 0) / items.length) })));
    } else if (path.endsWith('/httpError/getHttpErrorRang')) {
      const rows = requestEvents(events).filter(item => item.requestType === 'error'); ok(ctx, labels(ctx.query.beginTime as string, ctx.query.endTime as string).map(date => ({ label: dayjs(date).format('MM-DD'), value: rows.filter(item => dateOf(item).format('YYYY-MM-DD') === date).length })));
    } else if (path.endsWith('/httpError/getHttpList')) {
      let rows = requestEvents(events).filter(item => (!ctx.query.url || String(item.url).includes(String(ctx.query.url))) && (!ctx.query.link || String(item.link).includes(String(ctx.query.link))) && (!ctx.query.requestType || item.requestType === ctx.query.requestType));
      const sorter = String(ctx.query.sorterName || 'userTimeStamp'); const direction = ctx.query.sorterKey === 'asc' ? 1 : -1; rows.sort((a, b) => (numberOf(a[sorter]) - numberOf(b[sorter])) * direction);
      const page = Math.max(1, Number(ctx.query.from) || 1); const size = Math.max(1, Number(ctx.query.size) || 10);
      ok(ctx, { total: rows.length, data: rows.slice((page - 1) * size, page * size).map((item, index) => ({ _id: `request-${item.userTimeStamp}-${index}`, _source: item })) });
    } else if (path.endsWith('/jsError/getJsErrorRang')) {
      const rows = errorEvents(events); ok(ctx, labels(ctx.query.beginTime as string, ctx.query.endTime as string).map(date => ({ label: dayjs(date).format('MM-DD'), value: rows.filter(item => dateOf(item).format('YYYY-MM-DD') === date).length })));
    } else if (path.endsWith('/jsError/getJsErrorList')) {
      const groups = new Map<string, TelemetryEvent[]>(); errorEvents(events).forEach(item => { const key = `${item.message}|${item.filename}|${item.lineno}|${item.colno}`; groups.set(key, [ ...(groups.get(key) || []), item ]); });
      ok(ctx, [ ...groups.values() ].map((items, id) => ({ ...items[0], id, errorCount: items.length, userIds: [ ...new Set(items.map(visitor)) ] })));
    } else if (path.endsWith('/jsError/getNearbyCode')) ok(ctx, { code: [], originalPosition: { source: '', line: 0, column: 0, name: '' }, source: '', start: 0 });
    else await next();
  };
};


import React, { Suspense, lazy, ComponentType } from 'react';
import { RouteObject } from 'react-router-dom';
import { AppstoreOutlined, BarChartOutlined, OrderedListOutlined, FileSearchOutlined, RadarChartOutlined, MedicineBoxOutlined, ThunderboltOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { Loading } from '@/src/components/loading';

const chunkReloadKey = 'frontend-monitoring-chunk-reload';

const lazyWithRetry = (dynamicImport: () => Promise<{ default: ComponentType<any> }>) => lazy(async() => {
  try {
    const module = await dynamicImport();
    sessionStorage.removeItem(chunkReloadKey);
    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError = /ChunkLoadError|Loading (CSS )?chunk .* failed/i.test(message);

    if(isChunkError && !sessionStorage.getItem(chunkReloadKey)){
      sessionStorage.setItem(chunkReloadKey, '1');
      window.location.reload();
      return new Promise(() => undefined);
    }

    sessionStorage.removeItem(chunkReloadKey);
    throw error;
  }
});

const lazyLoad = (dynamicImport: () => Promise<{ default: ComponentType<any> }>) => {
  const Component = lazyWithRetry(dynamicImport);
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
};

export const munuRouters = [
  {
    path: '/',
    name: '应用列表',
    icon: AppstoreOutlined,
    element: lazyLoad(() => import('../pages/home')),
  },
];

export const hasAppRouters = [
  {
    path: '/visitorStats',
    name: '流量分析',
    icon: BarChartOutlined,
    element: lazyLoad(() => import('../pages/visitorStats')),
  },
  {
    path: '/performance',
    name: '性能分析',
    icon: ThunderboltOutlined,
    element: lazyLoad(() => import('../pages/performance')),
  },
  {
    path: '/performanceSearch',
    name: '首屏查询',
    icon: FileSearchOutlined,
    element: lazyLoad(() => import('../pages/performanceSearch')),
  },
  {
    path: '/httpError',
    name: '接口分析',
    icon: NodeIndexOutlined,
    element: lazyLoad(() => import('../pages/httpError')),
  },
  {
    path: '/httpSearch',
    name: '接口查询',
    icon: FileSearchOutlined,
    element: lazyLoad(() => import('../pages/httpSearch')),
  },
  {
    path: '/jsError',
    name: '健康情况',
    icon: MedicineBoxOutlined,
    element: lazyLoad(() => import('../pages/jsError')),
  },
  {
    path: '/topAnalyse',
    name: 'Top分析',
    icon: OrderedListOutlined,
    element: lazyLoad(() => import('../pages/topAnalyse')),
  },
  {
    path: '/geographicalDistribution',
    name: '地域分布',
    icon: RadarChartOutlined,
    element: lazyLoad(() => import('../pages/geographicalDistribution')),
  },
];

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: lazyLoad(() => import('../pages/login')),
  },
  {
    path: '/',
    element: lazyLoad(() => import('../pages/content')),
    children: [
      ...munuRouters,
      ...hasAppRouters,
      {
        path: '/*',
        element: lazyLoad(() => import('@/src/pages/notFound')),
      },
    ],
  },
  {
    path: '/test',
    element: lazyLoad(() => import('../pages/home')),
  },
  {
    path: '*',
    element: lazyLoad(() => import('@/src/pages/notFound')),
  },
];



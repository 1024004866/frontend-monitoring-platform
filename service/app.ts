import { Application } from 'egg';
import { useKafka } from '@/app/service/kafuka';
import { useElasticsearch } from '@/app/service/elasticsearch';

declare module 'egg' {
  interface Application {
    redis: any;
    model: any;
  }

  interface IModel {
    getQueryInterface(): {
      showAllTables(): Promise<string[]>;
    };
  }
}
export default function(app: Application) {
  const useExternalServices = process.env.MONITOR_USE_EXTERNAL_SERVICES === 'true'
    || process.env.NODE_ENV === 'production';

  if (!useExternalServices) return;

  const ctx = app.createAnonymousContext();
  app.beforeStart(async() => {
    useKafka(app);
    useElasticsearch(app);
    ctx.service.kafuka.report.useKafkaConsume();
  });
}

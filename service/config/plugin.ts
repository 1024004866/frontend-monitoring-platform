import { EggPlugin } from 'egg';

const useExternalServices = process.env.MONITOR_USE_EXTERNAL_SERVICES === 'true'
  || process.env.NODE_ENV === 'production';

const plugin: EggPlugin = {
  tegg: {
    enable: true,
    package: '@eggjs/tegg-plugin',
  },
  teggConfig: {
    enable: true,
    package: '@eggjs/tegg-config',
  },
  teggController: {
    enable: true,
    package: '@eggjs/tegg-controller-plugin',
  },
  teggSchedule: {
    enable: true,
    package: '@eggjs/tegg-schedule-plugin',
  },
  eventbusModule: {
    enable: true,
    package: '@eggjs/tegg-eventbus-plugin',
  },
  aopModule: {
    enable: true,
    package: '@eggjs/tegg-aop-plugin',
  },
  tracer: {
    enable: true,
    package: 'egg-tracer',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  sequelize: {
    enable: useExternalServices,
    package: 'egg-sequelize',
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
  redis: {
    enable: useExternalServices,
    package: 'egg-redis',
  },
};

export default plugin;

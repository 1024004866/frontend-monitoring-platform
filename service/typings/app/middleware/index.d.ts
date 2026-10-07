// This file is created by egg-ts-helper@2.1.1
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import ExportDemoApi from '../../../app/middleware/demoApi';
import ExportVerifyUser from '../../../app/middleware/verifyUser';

declare module 'egg' {
  interface IMiddleware {
    demoApi: typeof ExportDemoApi;
    verifyUser: typeof ExportVerifyUser;
  }
}

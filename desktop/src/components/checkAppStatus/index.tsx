import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { RootState, Dispatch } from '@/src/models/store';
import { Loading } from '@/src/components/loading';
import { useAppStore } from '@/src/hooks';

// eslint-disable-next-line react/display-name
export const checkAppStatus = (Page: React.FunctionComponent) => () => {

  const dispatch = useDispatch<Dispatch>();

  const location = useLocation();

  const { appDispatch, apps, isLoading } = useAppStore();

  const { userInfo, isLoading: isUserLoading } = useSelector((state: RootState) => state.user);

  React.useEffect(() => {
    dispatch.user.getUserInfo();
  }, []);

  React.useEffect(() => {
    if(userInfo.id){
      appDispatch.getAppListOnce();
    }
  }, [userInfo.id]);

  if(isUserLoading){
    return <Loading />;
  }

  if(!userInfo?.id){
    return <Navigate to="/login" replace />;
  }

  if(!isLoading && apps.length === 0 && location.pathname !== '/'){
    return <Navigate to="/" />;
  }

  return <Page />;
};

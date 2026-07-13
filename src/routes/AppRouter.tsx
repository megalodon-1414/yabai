import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SiteLayout } from '../components/site/SiteLayout';
import { EmotionMapPage } from '../pages/EmotionMapPage';
import { HomePage } from '../pages/HomePage';
import { ROUTES } from './paths';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout showSiteChrome={false} />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.emotionMap} element={<EmotionMapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ThemeProvider } from '@/lib/theme';
import { NotepadProvider } from '@/lib/notepad-context';
import { TrayProvider } from '@/lib/tray';
import { TermDrawerProvider } from '@/components/ui/TermDrawer';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

// Route-level code splitting: KaTeX, charts, 3Dmol and the full data files load only on the routes that use them.
const Read = lazy(() => import('@/pages/Read'));
const Glossary = lazy(() => import('@/pages/Glossary'));
const Concepts = lazy(() => import('@/pages/Concepts'));
const Concept = lazy(() => import('@/pages/Concept'));
const Plants = lazy(() => import('@/pages/Plants'));
const Plant = lazy(() => import('@/pages/Plant'));
const Greenhouse = lazy(() => import('@/pages/Greenhouse'));
const Compounds = lazy(() => import('@/pages/Compounds'));
const Compound = lazy(() => import('@/pages/Compound'));
const Compare = lazy(() => import('@/pages/Compare'));
const Families = lazy(() => import('@/pages/Families'));
const Family = lazy(() => import('@/pages/Family'));
const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Tea = lazy(() => import('@/pages/Tea'));
const Tours = lazy(() => import('@/pages/Tours'));
const TourPlayer = lazy(() => import('@/pages/TourPlayer'));
const Figures = lazy(() => import('@/pages/Figures'));
const Figure = lazy(() => import('@/pages/Figure'));
const References = lazy(() => import('@/pages/References'));
const Methods = lazy(() => import('@/pages/Methods'));
const About = lazy(() => import('@/pages/About'));
const Notes = lazy(() => import('@/pages/Notes'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

function TourRedirect() {
  const { id } = useParams();
  return <Navigate to={`/tours/${id ?? ''}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <NotepadProvider>
        <TrayProvider>
          <BrowserRouter basename={basename}>
            <TermDrawerProvider>
              <Layout>
                <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-12 bx-muted min-h-[150vh]" role="status">Loading…</div>}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/read" element={<Read />} />
                    <Route path="/glossary" element={<Glossary />} />
                    <Route path="/concepts" element={<Concepts />} />
                    <Route path="/concepts/:id" element={<Concept />} />
                    <Route path="/plants" element={<Plants />} />
                    <Route path="/plants/:id" element={<Plant />} />
                    <Route path="/greenhouse" element={<Greenhouse />} />
                    <Route path="/compounds" element={<Compounds />} />
                    <Route path="/compounds/:id" element={<Compound />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/families" element={<Families />} />
                    <Route path="/families/:family" element={<Family />} />
                    <Route path="/heatmap" element={<Heatmap />} />
                    <Route path="/tea" element={<Tea />} />
                    <Route path="/tours" element={<Tours />} />
                    <Route path="/tours/:id" element={<TourPlayer />} />
                    <Route path="/tour/:id" element={<TourRedirect />} />
                    <Route path="/figures" element={<Figures />} />
                    <Route path="/figures/:id" element={<Figure />} />
                    <Route path="/references" element={<References />} />
                    <Route path="/methods" element={<Methods />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            </TermDrawerProvider>
          </BrowserRouter>
        </TrayProvider>
      </NotepadProvider>
    </ThemeProvider>
  );
}

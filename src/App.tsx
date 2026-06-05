import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import Gallery from './screens/Gallery';
import Editor from './screens/Editor';
import NotFound from './screens/NotFound';
import NavBar from './components/NavBar';

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Gallery />} />
                <Route path="/editor/:id" element={<Editor />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </AnimatePresence>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-slate-950 text-white">
                <NavBar />
                <AnimatedRoutes />
            </div>
        </BrowserRouter>
    );
}

export default App;

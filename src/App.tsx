import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppFooter } from "@/components/AppFooter";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Session from "./pages/Session";
import SurahViewer from "./pages/SurahViewer";
import MushafViewer from "./pages/MushafViewer";
import Stats from "./pages/Stats";
import Memorization from "./pages/Memorization";
import BlockReview from "./pages/BlockReview";
import ReviewSchedule from "./pages/ReviewSchedule";
import QuranTest from "./pages/QuranTest";
import QFCallback from "./pages/QFCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <div className="flex flex-col min-h-screen">
              <div className="flex-1">
                <Routes>
                <Route path="/" element={<Auth />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/session/:sessionId" 
                  element={
                    <ProtectedRoute>
                      <Session />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/surah/:surahNumber" 
                  element={
                    <ProtectedRoute>
                      <SurahViewer />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/mushaf/:pageNumber?" 
                  element={
                    <ProtectedRoute>
                      <MushafViewer />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/stats" 
                  element={
                    <ProtectedRoute>
                      <Stats />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/memorize" 
                  element={
                    <ProtectedRoute>
                      <Memorization />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/review" 
                  element={
                    <ProtectedRoute>
                      <BlockReview />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/review-schedule" 
                  element={
                    <ProtectedRoute>
                      <ReviewSchedule />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/quran-test" element={<QuranTest />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <AppFooter />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

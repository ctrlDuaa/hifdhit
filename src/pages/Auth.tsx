import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LandingNav } from '@/components/LandingNav';
import heroBackground from '@/assets/hero-background.jpg';
import liveSessionDemo from '@/assets/live-session-demo.jpeg';
import mistakeTrackingDemo from '@/assets/mistake-tracking-demo.mov';
import mushafRevisionDemo from '@/assets/mushaf-revision-demo.jpeg';
import progressInsightsDemo from '@/assets/progress-insights-demo.jpeg';
const Auth = () => {
  const [currentVerb, setCurrentVerb] = useState(0);
  const navigate = useNavigate();
  const verbs = ['Recite', 'Revise', 'Track', 'Hifdh'];
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVerb(prev => (prev + 1) % verbs.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);
  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) {
      aboutSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNav onLoginClick={() => navigate('/login')} onSignUpClick={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center pt-16" style={{
      backgroundImage: `url(${heroBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto -mt-20">
          {/* Animated Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6" style={{
          textShadow: '0 2px 10px rgba(0,0,0,0.6)'
        }}>
            <span key={currentVerb} className="inline-block animate-fade-in">
              {verbs[currentVerb]}
            </span>
            {' it.'}
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-white/90 mb-8" style={{
          textShadow: '0 2px 10px rgba(0,0,0,0.6)'
        }}>
            Your digital companion for hifdh
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} className="bg-gradient-to-r from-[#C6A477] to-[#DFCEBF] text-white hover:opacity-90">
              Start Revising
            </Button>
            <Button size="lg" onClick={scrollToAbout} className="bg-gradient-to-r from-[#C6A477] to-[#DFCEBF] text-white hover:opacity-90 bg-[#c6a477]">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about-section" className="px-4 bg-white py-[60px]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Your Qur’an class, now online.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">Hifdh it helps you revise your hifdh online as you would in a traditional in-person Qur’an class - with recitation, repetition, and immediate feedback. Join live sessions with a fellow reciter, mark each other's mistakes, and review them later directly on your mushaf, all from one platform. Whether you're revising daily portions or full ajzā', Hifdh it helps you stay connected, consistent, and focused on your hifdh.</p>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 bg-white py-[60px]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Everything you need for a successful Hifdh, inshaAllah.
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <Card className="overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Live Recitation Sessions</CardTitle>
                <CardDescription>
                  Recite to your partner in real-time. Mark each other's mistakes as you go, just like in person.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 bg-muted/50 flex items-center justify-center p-0 overflow-hidden">
                <img src={liveSessionDemo} alt="Live Recitation Session Demo" className="w-full h-full object-cover" />
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Smart Mistake Tracking</CardTitle>
                <CardDescription>
                  Instantly see your errors, organized by type (Harakah, Tajweed, or missed-word) and color-coded for clarity.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 bg-muted/50 flex items-center justify-center p-0 overflow-hidden">
                <video src={mistakeTrackingDemo} className="w-full h-full object-cover" autoPlay loop muted playsInline />
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Mushaf Revision Mode</CardTitle>
                <CardDescription>
                  Revisit pages where you made mistakes, right inside your digital Mushaf. Highlighted words guide your review so that you can target weak spots.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 bg-muted/50 flex items-center justify-center p-0 overflow-hidden">
                <img src={mushafRevisionDemo} alt="Mushaf Revision Mode Demo" className="w-full h-full object-cover" />
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Progress Insights</CardTitle>
                <CardDescription>
                  See your consistency and improvement across the entire Quran. Visualize how far you've come and what needs attention.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 bg-muted/50 flex items-center justify-center p-0 overflow-hidden">
                <img src={progressInsightsDemo} alt="Progress Insights Demo" className="w-full h-full object-cover" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

    </div>;
};
export default Auth;
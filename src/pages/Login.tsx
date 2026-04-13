import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
const Login = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    signIn,
    signUp,
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>;
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isSignIn) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center p-4" style={{
    background: 'linear-gradient(90deg, #C6A477, #2a363b)'
  }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl font-bold" style={{
          color: '#C6A477'
        }}>
            Hifdh it
          </span>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isSignIn ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-center text-stone-400">
              {isSignIn ? 'Sign in to continue your journey' : 'Start your memorization journey today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={isSignIn ? 'signin' : 'signup'} onValueChange={v => setIsSignIn(v === 'signin')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C6A477] data-[state=active]:to-[#DFCEBF] data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C6A477] data-[state=active]:to-[#DFCEBF] data-[state=active]:text-white">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isSignIn && <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-[#c6a477] text-white">
                  {isSubmitting ? 'Loading...' : isSignIn ? 'Sign In' : 'Sign Up'}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-white">
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>;
};
export default Login;
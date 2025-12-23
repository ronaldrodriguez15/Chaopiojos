import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Login = ({ onLogin }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network delay for fun
    setTimeout(() => {
      const result = onLogin(email, password);
      setIsLoading(false);

      if (!result.success) {
        toast({
          title: "¡Oh no! 🙈",
          description: result.message,
          variant: "destructive",
          className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
        });
      }
    }, 800);
  };

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Floating Elements */}
      <motion.div 
        animate={{ y: [0, -20, 0] }} 
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] text-4xl opacity-20"
      >🦠</motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0] }} 
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-20 right-[10%] text-4xl opacity-20"
      >✨</motion.div>

      <motion.div 
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", bounce: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-orange-200 relative">
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-400 p-3 rounded-full border-4 border-white shadow-lg">
            <span className="text-3xl">🦁</span>
          </div>

          <div className="mt-6 text-center mb-6">
            <h1 className="text-3xl font-black mb-1 tracking-wide drop-shadow-sm">
              <span className="text-orange-500">Chao</span>{' '}
              <span className="text-blue-500">Piojos</span>
            </h1>
            <p className="text-gray-400 font-bold text-base">
              ¡Entra a la zona sin piojos!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-orange-100 p-2 rounded-xl group-focus-within:bg-orange-500 transition-colors">
                  <User className="w-4 h-4 text-orange-500 group-focus-within:text-white transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 bg-orange-50 border-4 border-transparent rounded-2xl focus:border-orange-300 focus:bg-white outline-none font-bold text-gray-700 placeholder-orange-200 transition-all text-base"
                  placeholder="Correo electrónico"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-orange-100 p-2 rounded-xl group-focus-within:bg-orange-500 transition-colors">
                  <Lock className="w-4 h-4 text-orange-500 group-focus-within:text-white transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 bg-orange-50 border-4 border-transparent rounded-2xl focus:border-orange-300 focus:bg-white outline-none font-bold text-gray-700 placeholder-orange-200 transition-all text-base"
                  placeholder="Contraseña secreta"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white font-black text-lg py-5 rounded-2xl shadow-lg border-b-4 border-red-600 active:border-b-0 active:translate-y-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="animate-spin mr-2">💫</span>
              ) : (
                <span className="mr-2">🚀</span>
              )}
              {isLoading ? 'Entrando...' : '¡A la Aventura!'}
            </Button>
          </form>

          {/* Demo Credentials Hint */}
          <div className="mt-4 p-3 bg-blue-50 rounded-2xl border-2 border-blue-100 text-xs text-blue-600 font-medium">
            <p className="font-bold mb-1 text-center text-blue-700 uppercase tracking-wider text-[10px]">🔐 Accesos Demo:</p>
            <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
              <div>
                <span className="block font-bold">Admin:</span> admin@chaopiojos.com
              </div>
              <div>
                <span className="block font-bold">Piojóloga:</span> maria@chaopiojos.com
              </div>
              <div className="col-span-2">
                <span className="font-bold">Password:</span> 123
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
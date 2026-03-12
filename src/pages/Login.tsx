import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setMessage(null);

    try {
      if (isRegistering) {
        if (!name.trim()) {
          setError('Por favor, informe seu nome.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome: name
            }
          }
        });
        if (error) throw error;
        setMessage('Cadastro realizado com sucesso! Verifique seu email se necessário, ou faça login.');
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 selection:bg-primary/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10 p-6 w-full max-w-md border border-slate-100"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-2">
            Joaquina<span className="text-primary">.PRO</span>
          </h1>
          <p className="text-sm font-medium text-slate-500">
            {isRegistering ? 'Crie sua conta para acessar o painel' : 'Entre na sua conta para acessar o painel'}
          </p>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 flex gap-3 text-green-700 items-start"
          >
            <p className="text-sm font-medium leading-relaxed">{message}</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex gap-3 text-red-600 items-start"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <label className="text-sm font-bold text-slate-700 ml-1">Nome Completo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <span className="font-bold text-lg leading-none">@</span>
                  </div>
                  <input
                    type="text"
                    required={isRegistering}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all sm:text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                    placeholder="João da Silva"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all sm:text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5 pb-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all sm:text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-black focus:outline-none focus:ring-4 focus:ring-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-4 shadow-xl shadow-slate-900/10"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isRegistering ? 'Criar Conta' : 'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
              setMessage(null);
            }}
            type="button"
            className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            {isRegistering 
              ? 'Já tem uma conta? Faça login' 
              : 'Não tem uma conta? Cadastre-se'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

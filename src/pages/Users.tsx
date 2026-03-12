import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit3, Trash2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Gerente' | 'Operador';
  status: 'Ativo' | 'Inativo';
}

interface UsersProps {
  users: User[];
  currentUser: User;
  setIsUserModalOpen: (val: boolean) => void;
  setEditingUser: (val: User | null) => void;
  setUserFormData: (val: any) => void;
  setUserToDelete: (val: string | null) => void;
  setIsConfirmModalOpen: (val: boolean) => void;
}

export const UsersPage: React.FC<UsersProps> = ({
  users,
  currentUser,
  setIsUserModalOpen,
  setEditingUser,
  setUserFormData,
  setUserToDelete,
  setIsConfirmModalOpen
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl"
    >
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingUser(null);
            setUserFormData({
              name: '',
              email: '',
              role: 'Operador',
              status: 'Ativo'
            });
            setIsUserModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Usuário</th>
                <th className="px-8 py-5">Função</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">
                        {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${user.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className="font-bold text-slate-600">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingUser(user);
                          setUserFormData({
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            status: user.status
                          });
                          setIsUserModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {currentUser.id !== user.id && (
                        <button 
                          onClick={() => {
                            setUserToDelete(user.id);
                            setIsConfirmModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                    <p className="font-medium">Nenhum usuário cadastrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

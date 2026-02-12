import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Eye, Edit, Trash2, DollarSign, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';

const UsersModule = React.memo(({ 
  users, 
  handleOpenUserDialog, 
  handleOpenUserDetail, 
  handleDeleteUser,
  handleOpenEarningsModal
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const itemsPerPage = 10;

  // Reset page cuando cambia cantidad
  useEffect(() => {
    const maxPage = Math.ceil(users.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && users.length === 0) setCurrentPage(1);
  }, [users.length, currentPage]);

  const handleDelete = useCallback((user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    
    const result = await handleDeleteUser(userToDelete.id);
    if (result.success) {
      toast({
        title: "Usuario Eliminado!",
        description: result.message,
        className: "bg-orange-100 text-orange-800 rounded-2xl border-2 border-orange-200"
      });
    } else {
      toast({
        title: "Error al eliminar",
        description: result.message || "No se pudo eliminar el usuario",
        variant: "destructive",
        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
      });
    }
    
    setShowDeleteModal(false);
    setUserToDelete(null);
  }, [handleDeleteUser, toast, userToDelete]);

  const paginatedUsers = users.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-blue-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
          <span className="text-3xl">👥</span> La Familia <span className="text-orange-500">Chao</span><span className="text-blue-500">Piojos</span>
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleOpenEarningsModal}
            className="bg-pink-400 hover:bg-pink-500 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-pink-600 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center"
          >
            <DollarSign className="w-6 h-6 mr-2" />
            Ganancias Referidos
          </Button>
          <Button 
            onClick={() => handleOpenUserDialog()}
            className="bg-blue-400 hover:bg-blue-500 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-blue-600 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center"
          >
            <UserPlus className="w-6 h-6 mr-2" />
            Nuevo Miembro
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="p-4 font-black text-gray-400">Nombre</th>
              <th className="p-4 font-black text-gray-400">Rol</th>
              <th className="p-4 font-black text-gray-400">Email</th>
              <th className="p-4 font-black text-gray-400 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map(user => (
              <tr key={user.id} className="group hover:bg-blue-50/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm
                      ${user.role === 'admin' ? 'bg-purple-100' : user.role === 'piojologist' ? 'bg-green-100' : 'bg-orange-100'}
                    `}>
                      {user.role === 'admin' ? '👑' : user.role === 'piojologist' ? '👩‍⚕️' : '👤'}
                    </div>
                    <span className="font-bold text-gray-700">{user.name}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider
                    ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                      user.role === 'piojologist' ? 'bg-green-100 text-green-600' : 
                      'bg-orange-100 text-orange-600'}
                  `}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 font-medium text-gray-500">{user.email}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleOpenUserDetail(user)}
                      className="h-10 w-10 rounded-xl bg-purple-100 text-purple-500 hover:bg-purple-200"
                      title="Ver Detalles"
                    >
                      <Eye className="w-5 h-5" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleOpenUserDialog(user)}
                      className="h-10 w-10 rounded-xl bg-blue-100 text-blue-500 hover:bg-blue-200"
                      title="Editar"
                    >
                      <Edit className="w-5 h-5" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleDelete(user)}
                      className="h-10 w-10 rounded-xl bg-red-100 text-red-500 hover:bg-red-200"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <Pagination
        currentPage={currentPage}
        totalItems={users.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="blue"
      />

      {/* Modal de Confirmación de Eliminación */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 sm:max-w-md bg-yellow-50 shadow-2xl">
          {/* Title */}
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trash2 className="w-6 h-6 text-yellow-600" />
              <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                CONFIRMAR ELIMINACIÓN
              </h2>
            </div>
          </div>
          
          <div className="px-8 pb-8 text-center space-y-6">
            <h3 className="text-lg font-medium text-gray-700 mb-4">
              ¿Estás seguro de eliminar a este usuario?
            </h3>
            {userToDelete && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-lg font-bold text-gray-800">{userToDelete.name}</p>
                <p className="text-sm text-gray-600">{userToDelete.email}</p>
                <p className="text-sm text-yellow-600 font-bold capitalize">{userToDelete.role}</p>
              </div>
            )}
            <p className="text-gray-600 text-sm">
              Esta acción no se puede deshacer. Todos los datos asociados se perderán permanentemente.
            </p>
            
            <div className="flex gap-4 pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
              >
                Cancelar
              </Button>
              <Button 
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
              >
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

UsersModule.displayName = 'UsersModule';

export default UsersModule;

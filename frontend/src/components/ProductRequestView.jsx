import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingCart, CheckCircle, XCircle, Clock, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const ProductRequestView = ({ products, currentUser, onCreateRequest, productRequests }) => {
  const { toast } = useToast();
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isKitCompleto, setIsKitCompleto] = useState(false);
  const [notes, setNotes] = useState('');

  // Filtrar solicitudes del usuario actual
  const myRequests = productRequests.filter(req => req.piojologistId === currentUser.id);

  const handleAddProduct = (product) => {
    const existing = selectedProducts.find(p => p.productId === product.id);
    if (existing) {
      setSelectedProducts(prev => prev.map(p => 
        p.productId === product.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1
      }]);
    }
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleDecreaseQuantity = (productId) => {
    setSelectedProducts(prev => prev.map(p => 
      p.productId === productId 
        ? { ...p, quantity: Math.max(1, p.quantity - 1) }
        : p
    ));
  };

  const handleIncreaseQuantity = (productId) => {
    setSelectedProducts(prev => prev.map(p => 
      p.productId === productId 
        ? { ...p, quantity: p.quantity + 1 }
        : p
    ));
  };

  const handleSubmitRequest = () => {
    if (!isKitCompleto && selectedProducts.length === 0) {
      toast({
        title: "⚠️ Selecciona productos",
        description: "Debes seleccionar al menos un producto o el Kit Completo",
        variant: "destructive",
        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
      });
      return;
    }

    const requestData = {
      items: isKitCompleto ? [] : selectedProducts,
      isKitCompleto,
      notes
    };

    const result = onCreateRequest(requestData);
    
    if (result.success) {
      toast({
        title: "✅ Solicitud Enviada",
        description: "Los administradores recibirán tu solicitud",
        className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
      });

      // Reset form
      setSelectedProducts([]);
      setIsKitCompleto(false);
      setNotes('');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      approved: 'bg-green-100 text-green-700 border-green-300',
      rejected: 'bg-red-100 text-red-700 border-red-300'
    };

    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada'
    };

    return (
      <span className={`px-3 py-1 rounded-xl text-xs font-bold border-2 ${styles[status]} flex items-center gap-1`}>
        {getStatusIcon(status)}
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Nueva Solicitud */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-purple-100">
        <h2 className="text-3xl font-black text-purple-600 mb-6 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8" />
          Solicitar Productos
        </h2>

        {/* Opción Kit Completo */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-2xl border-2 border-purple-200 hover:border-purple-400 transition-colors">
            <input
              type="checkbox"
              checked={isKitCompleto}
              onChange={(e) => {
                setIsKitCompleto(e.target.checked);
                if (e.target.checked) {
                  setSelectedProducts([]);
                }
              }}
              className="w-5 h-5 rounded"
            />
            <div className="flex-1">
              <span className="font-bold text-lg text-purple-700">🎁 Kit Completo</span>
              <p className="text-sm text-purple-600">Incluye todos los productos disponibles</p>
            </div>
          </label>
        </div>

        {/* Lista de Productos */}
        {!isKitCompleto && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {products.map(product => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-white to-purple-50 p-4 rounded-2xl border-2 border-purple-200 shadow-md"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-600">Stock: {product.stock}</p>
                  </div>
                </div>

                {selectedProducts.find(p => p.productId === product.id) ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleDecreaseQuantity(product.id)}
                      className="bg-purple-200 hover:bg-purple-300 text-purple-700 rounded-xl p-2"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="flex-1 text-center font-bold text-lg">
                      {selectedProducts.find(p => p.productId === product.id)?.quantity}
                    </span>
                    <Button
                      onClick={() => handleIncreaseQuantity(product.id)}
                      className="bg-purple-200 hover:bg-purple-300 text-purple-700 rounded-xl p-2"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="bg-red-400 hover:bg-red-500 text-white rounded-xl px-3 py-2"
                    >
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleAddProduct(product)}
                    className="w-full bg-purple-400 hover:bg-purple-500 text-white rounded-xl py-2 font-bold"
                  >
                    Agregar
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Productos Seleccionados Summary */}
        {selectedProducts.length > 0 && !isKitCompleto && (
          <div className="bg-purple-50 p-4 rounded-2xl mb-4">
            <h3 className="font-bold text-purple-700 mb-2">Productos Seleccionados:</h3>
            <ul className="space-y-1">
              {selectedProducts.map(p => (
                <li key={p.productId} className="text-sm text-purple-600">
                  • {p.productName} x{p.quantity}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notas */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Notas adicionales (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agrega cualquier observación..."
            className="w-full px-4 py-3 rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:outline-none resize-none"
            rows="3"
          />
        </div>

        {/* Botón Enviar */}
        <Button
          onClick={handleSubmitRequest}
          disabled={!isKitCompleto && selectedProducts.length === 0}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl py-4 font-bold text-lg shadow-lg disabled:opacity-50"
        >
          📦 Enviar Solicitud
        </Button>
      </div>

      {/* Historial de Solicitudes */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-blue-100">
        <h2 className="text-3xl font-black text-blue-600 mb-6 flex items-center gap-3">
          <Clock className="w-8 h-8" />
          Mis Solicitudes
        </h2>

        {myRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg">No has hecho solicitudes aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map(request => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-blue-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      {new Date(request.requestDate).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="mb-3">
                  <h3 className="font-bold text-gray-800 mb-2">
                    {request.isKitCompleto ? '🎁 Kit Completo' : 'Productos Solicitados:'}
                  </h3>
                  {!request.isKitCompleto && (
                    <ul className="space-y-1">
                      {request.items.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          • {item.productName} x{item.quantity}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {request.notes && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Tus notas:</span> {request.notes}
                    </p>
                  </div>
                )}

                {request.status !== 'pending' && (
                  <div className="mt-4 pt-4 border-t-2 border-blue-200">
                    <p className="text-sm font-bold text-gray-700 mb-1">
                      {request.status === 'approved' ? '✅ Aprobado' : '❌ Rechazado'} por {request.resolvedByName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(request.resolvedDate).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {request.adminNotes && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-bold">Comentario:</span> {request.adminNotes}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductRequestView;

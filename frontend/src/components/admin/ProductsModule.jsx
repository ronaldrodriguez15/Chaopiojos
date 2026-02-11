import React, { useState, useEffect } from 'react';
import { PackagePlus, Trash2, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';

const ProductsModule = React.memo(({ 
  products, 
  formatCurrency,
  handleProductSubmit,
  handleDeleteProduct,
  productFormData,
  setProductFormData,
  isProductDialogOpen,
  setIsProductDialogOpen,
  setSelectedProduct,
  setIsProductDetailOpen,
  formatPriceInput,
  handlePriceChange,
  getImageUrl,
  handleImageUpload,
  handleRemoveImage
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    const maxPage = Math.ceil(products.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && products.length === 0) setCurrentPage(1);
  }, [products.length, currentPage]);

  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-pink-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
          <span className="text-3xl">📦</span> Almacén de Productos
        </h3>
        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-pink-400 hover:bg-pink-500 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-pink-600 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center">
              <PackagePlus className="w-6 h-6 mr-2" />
              Crear Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-4 border-pink-200 p-0 overflow-hidden sm:max-w-md bg-gradient-to-b from-pink-50 to-white">
            <DialogHeader className="sr-only">
              <DialogTitle>Nuevo Artilugio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProductSubmit} className="relative p-6 md:p-8 space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 bg-pink-100 px-3 py-1 rounded-full">
                  <PackagePlus className="w-4 h-4 text-pink-600" />
                  <span className="text-xs font-black text-pink-600 uppercase">Nuevo Artilugio</span>
                </div>
              </div>
              <div>
                <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre del Producto</Label>
                <input 
                  required
                  value={productFormData.name}
                  onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                  placeholder="Ej. Spray Mágico"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Precio ($)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input 
                      required
                      type="text"
                      value={formatPriceInput(productFormData.price)}
                      onChange={handlePriceChange}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 pl-8 font-bold outline-none focus:border-pink-400"
                      placeholder="15.000"
                    />
                  </div>
                </div>
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Stock</Label>
                  <input 
                    required
                    type="number"
                    value={productFormData.stock}
                    onChange={e => setProductFormData({...productFormData, stock: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                    placeholder="50"
                  />
                </div>
              </div>
              <div>
                <Label className="font-bold text-gray-500 ml-2 mb-1 block">📸 Imagen del Producto</Label>
                {productFormData.image && (
                  <div className="mb-3 relative group">
                    <img 
                      src={getImageUrl(productFormData.image)} 
                      alt="Preview" 
                      className="w-full h-48 object-contain object-center rounded-2xl border-4 border-pink-100"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="product-image-upload"
                  />
                  <label 
                    htmlFor="product-image-upload"
                    className="w-full bg-pink-50 border-2 border-dashed border-pink-300 rounded-2xl p-6 font-bold outline-none hover:bg-pink-100 hover:border-pink-400 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-pink-600"
                  >
                    <PackagePlus className="w-8 h-8" />
                    <span className="text-sm">
                      {productFormData.image ? 'Cambiar imagen' : 'Seleccionar imagen'}
                    </span>
                    <span className="text-xs text-gray-500">JPG, PNG o WEBP</span>
                  </label>
                </div>
              </div>
              <Button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-2xl py-6 font-bold mt-4 shadow-md border-b-4 border-pink-700">
                Guardar en Inventario
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl border-4 border-pink-200">
          <div className="relative inline-block">
            <div className="text-8xl mb-4 animate-bounce">📦</div>
            <div className="absolute -top-2 -right-2 text-4xl">✨</div>
          </div>
          <h4 className="font-black text-2xl text-gray-800 mb-2">
            ¡Tu inventario está vacío!
          </h4>
          <p className="text-gray-600 font-bold mb-6 max-w-md mx-auto">
            Comienza a agregar productos mágicos para que las piojólogas puedan solicitar sus kits 🎁
          </p>
          <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-700 px-4 py-2 rounded-full font-bold text-sm">
            <span>💡</span>
            <span>Usa el botón "Crear Producto" para empezar</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProducts.map(product => (
            <div key={product.id} className="bg-white border-4 border-pink-100 rounded-[2rem] p-4 flex flex-col gap-4 shadow-sm hover:border-pink-300 hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer group">
            <div 
              onClick={() => {
                setSelectedProduct(product);
                setIsProductDetailOpen(true);
              }}
              className="w-full h-32 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl overflow-hidden relative"
            >
              <img src={getImageUrl(product.image)} alt={product.name} className="w-full h-full object-contain object-center" />
              <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-black shadow-lg border-2 border-pink-200">
                📦 {product.stock}
              </div>
            </div>
            <div onClick={() => {
              setSelectedProduct(product);
              setIsProductDetailOpen(true);
            }}>
              <h4 className="text-lg font-black text-gray-800 truncate">{product.name}</h4>
              <p className="text-pink-500 font-bold text-xl">{formatCurrency(product.price)}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setProductToDelete(product);
                setDeleteDialogOpen(true);
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 font-bold text-sm"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </Button>
          </div>
          ))}
        </div>
      )}
      
      <Pagination
        currentPage={currentPage}
        totalItems={products.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="pink"
      />

      {/* Dialog de Confirmación de Eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trash2 className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                ELIMINAR PRODUCTO
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-8 pb-8 text-center space-y-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                ¿Estás seguro de eliminar este producto?
              </h3>
              {productToDelete && (
                <div className="bg-white rounded-2xl p-4 border-2 border-red-400">
                  <div className="w-full h-32 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl overflow-hidden mb-3">
                    <img 
                      src={getImageUrl(productToDelete.image)} 
                      alt={productToDelete.name} 
                      className="w-full h-full object-contain object-center" 
                    />
                  </div>
                  <p className="text-lg font-bold text-gray-800">{productToDelete.name}</p>
                  <p className="text-sm text-pink-600 font-bold">{formatCurrency(productToDelete.price)}</p>
                  <p className="text-xs text-gray-500">Stock: {productToDelete.stock}</p>
                </div>
              )}
              
              <div className="flex gap-4 pt-4">
                <Button 
                  type="button" 
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    if (productToDelete) {
                      handleDeleteProduct(productToDelete.id);
                      toast({
                        title: "❌ Producto Eliminado",
                        description: `${productToDelete.name} fue eliminado del inventario`,
                        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
                      });
                      setDeleteDialogOpen(false);
                      setProductToDelete(null);
                    }
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
                >
                  Sí, Eliminar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ProductsModule.displayName = 'ProductsModule';

export default ProductsModule;

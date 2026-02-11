import React from 'react';

const Pagination = React.memo(({ currentPage, totalItems, itemsPerPage, onPageChange, colorScheme = 'blue' }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) return null;

  const colors = {
    blue: 'bg-blue-500 hover:bg-blue-600 border-blue-600',
    pink: 'bg-pink-400 hover:bg-pink-500 border-pink-600',
    purple: 'bg-purple-500 hover:bg-purple-600 border-purple-600',
    green: 'bg-green-500 hover:bg-green-600 border-green-600',
    amber: 'bg-amber-500 hover:bg-amber-600 border-amber-600'
  };

  const colorClass = colors[colorScheme] || colors.blue;

  const getPageNumbers = () => {
    const pages = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (showEllipsisStart) {
        pages.push('...');
      }
      
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }
      
      if (showEllipsisEnd) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-2 rounded-xl font-bold text-sm text-white transition-all ${colorClass} border-b-4 active:border-b-0 active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-400`}
      >
        ← Anterior
      </button>
      
      {getPageNumbers().map((page, index) => (
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-gray-400 font-bold">...</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border-b-4 active:border-b-0 active:translate-y-1 ${
              currentPage === page
                ? `${colorClass} text-white`
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-400'
            }`}
          >
            {page}
          </button>
        )
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-3 py-2 rounded-xl font-bold text-sm text-white transition-all ${colorClass} border-b-4 active:border-b-0 active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-400`}
      >
        Siguiente →
      </button>
    </div>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;

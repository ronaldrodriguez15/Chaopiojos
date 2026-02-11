import { useState, useEffect } from 'react';

export const usePagination = (items, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const maxPage = Math.ceil(items.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && items.length === 0) setCurrentPage(1);
  }, [items.length, currentPage, itemsPerPage]);

  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    totalPages: Math.ceil(items.length / itemsPerPage)
  };
};

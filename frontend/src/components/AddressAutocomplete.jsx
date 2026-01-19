import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader } from 'lucide-react';

const AddressAutocomplete = ({ value, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [inputPosition, setInputPosition] = useState(null);
  const timeoutRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const scrollParentRef = useRef(null);
  const [dropdownHeight, setDropdownHeight] = useState(300);
  const [openDirection, setOpenDirection] = useState('down');

  // Buscar sugerencias de direcciones
  const fetchSuggestions = async (query) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query + ', Colombia'
        )}&format=json&limit=10`,
        {
          headers: { 'Accept': 'application/json' }
        }
      );

      const data = await response.json();
      
      // Procesar las sugerencias
      const processedSuggestions = data.map(item => ({
        id: item.osm_id,
        name: item.display_name.split(',')[0], // Primer parte (más clara)
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      setSuggestions(processedSuggestions);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce para las búsquedas
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Nuevo timeout
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 500);
  };

  // Seleccionar sugerencia con click
  const handleSelectSuggestion = (suggestion) => {
    onChange(suggestion.fullName);
    onSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Prevenir que el click en la sugerencia envíe el formulario
  const handleSuggestionClick = (e, suggestion) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectSuggestion(suggestion);
  };

  // Navegación con teclado
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Calcular posición del input para el portal y sincronizar con scroll del modal
  useEffect(() => {
    const getScrollParent = (el) => {
      let node = el?.parentElement;
      while (node) {
        const style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY)) return node;
        node = node.parentElement;
      }
      return window;
    };

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const belowSpace = window.innerHeight - rect.bottom;
        setInputPosition({
          topBelow: rect.bottom + window.scrollY,
          topAbove: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
        const needed = (dropdownHeight || 300) + 12;
        setOpenDirection(belowSpace < needed ? 'up' : 'down');
      }
      if (dropdownRef.current) {
        setDropdownHeight(dropdownRef.current.offsetHeight || dropdownHeight);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    scrollParentRef.current = getScrollParent(containerRef.current);
    if (scrollParentRef.current && scrollParentRef.current !== window) {
      scrollParentRef.current.addEventListener('scroll', updatePosition);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      if (scrollParentRef.current && scrollParentRef.current !== window) {
        scrollParentRef.current.removeEventListener('scroll', updatePosition);
      }
    };
  }, [isOpen, dropdownHeight]);

  // Cerrar cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-cyan-100 p-2 rounded-xl group-focus-within:bg-cyan-500 transition-colors z-10">
          <MapPin className="w-4 h-4 text-cyan-500 group-focus-within:text-white transition-colors" />
        </div>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          className="w-full pl-14 pr-10 py-3 bg-cyan-50 border-4 border-transparent rounded-2xl focus:border-cyan-300 focus:bg-white outline-none font-bold text-gray-700 placeholder-cyan-200 transition-all text-base"
          placeholder="📍 Ej: Cra 7 #45, Bogotá"
          required
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader className="w-4 h-4 animate-spin text-cyan-500" />
          </div>
        )}
      </div>

      {/* Dropdown de sugerencias con Portal */}
      {inputPosition && createPortal(
        <AnimatePresence>
          {isOpen && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                top: `${openDirection === 'down' ? inputPosition.topBelow : (inputPosition.topAbove - dropdownHeight - 8)}px`,
                left: `${inputPosition.left}px`,
                width: `${inputPosition.width}px`,
                marginTop: '8px'
              }}
              className="bg-white rounded-2xl border-4 border-cyan-200 shadow-2xl z-[9999] overflow-hidden pointer-events-auto"
              ref={dropdownRef}
            >
              <div
                className="max-h-[60vh] overflow-y-auto overscroll-contain"
                onWheel={(e) => {
                  // Evita que el scroll del listado mueva el modal detrás
                  e.stopPropagation();
                }}
              >
                {suggestions.map((suggestion, index) => (
                  <motion.button
                    key={suggestion.id}
                    type="button"
                    onClick={(e) => handleSuggestionClick(e, suggestion)}
                    className={`w-full text-left px-4 py-3 transition-all border-b border-cyan-100 hover:bg-cyan-50 ${
                      index === selectedIndex ? 'bg-cyan-100 border-l-4 border-l-cyan-500' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">📍</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">
                          {suggestion.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {suggestion.fullName.split(',').slice(1).join(',')}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Mensaje cuando no hay resultados */}
      {inputPosition && createPortal(
        <AnimatePresence>
          {isOpen && suggestions.length === 0 && value.length >= 3 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: `${openDirection === 'down' ? inputPosition.topBelow : (inputPosition.topAbove - 180)}px`,
                left: `${inputPosition.left}px`,
                width: `${inputPosition.width}px`,
                marginTop: '8px'
              }}
              className="bg-white rounded-2xl border-4 border-yellow-200 shadow-2xl z-[9999] p-4 text-center"
            >
              <p className="text-sm text-yellow-700 font-bold">
                🤔 No encontré esa dirección... intenta escribir diferente
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default AddressAutocomplete;

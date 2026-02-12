import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader, X, ChevronDown, MousePointer } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Componente para centrar el mapa y ajustar el tamaño
function MapController({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      // Pequeño delay para asegurar que el contenedor esté renderizado
      setTimeout(() => {
        map.invalidateSize();
        map.setView(center, 16, { animate: true });
      }, 100);
    }
  }, [center, map]);
  
  return null;
}

// Componente para manejar clics en el mapa
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    }
  });
  return null;
}

const AddressAutocomplete = ({ value, onChange, onSelect, hasError = false }) => {
  const [city, setCity] = useState('Bogotá');
  const [address, setAddress] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [inputPosition, setInputPosition] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(null);
  const markerRef = useRef(null);
  const timeoutRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const cityDropdownRef = useRef(null);
  const scrollParentRef = useRef(null);
  const [dropdownHeight, setDropdownHeight] = useState(300);
  const [openDirection, setOpenDirection] = useState('down');

  // Lista de ciudades principales de Colombia
  const cities = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga',
    'Pereira', 'Manizales', 'Santa Marta', 'Cúcuta', 'Ibagué', 'Pasto',
    'Armenia', 'Villavicencio', 'Montería', 'Valledupar', 'Popayán', 'Neiva',
    'Tunja', 'Sincelejo', 'Riohacha', 'Quibdó', 'Florencia', 'Leticia'
  ];

  // Sincronizar el valor del input de dirección con el prop value
  useEffect(() => {
    if (value !== address) {
      setAddress(value || '');
    }
  }, [value]);

  // Buscar sugerencias de direcciones
  const fetchSuggestions = async (query, cityName) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      // Limpiar y preparar la query
      let searchQuery = query.trim();
      
      // Reemplazar # por un espacio para mejor búsqueda
      searchQuery = searchQuery.replace(/#/g, ' ');
      
      // Construir diferentes variantes de búsqueda
      const queries = [
        `${searchQuery}, ${cityName}, Colombia`,  // Query principal
        `${searchQuery}, ${cityName}`,            // Sin país
      ];
      
      console.log('Buscando direcciones:', queries);
      
      // Hacer búsquedas en paralelo con diferentes queries
      const responses = await Promise.all(
        queries.map(q => 
          fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=15&addressdetails=1&bounded=0`,
            {
              headers: { 
                'Accept': 'application/json',
                'User-Agent': 'ChaoPiojos-App/1.0'
              }
            }
          ).then(r => r.json()).catch(() => [])
        )
      );

      // Combinar resultados y eliminar duplicados
      const allResults = responses.flat();
      const uniqueResults = [];
      const seenIds = new Set();
      
      for (const item of allResults) {
        const id = item.osm_id || item.place_id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uniqueResults.push(item);
        }
      }
      
      console.log('Respuesta de Nominatim (total):', uniqueResults.length, 'resultados');

      // Procesar las sugerencias para mostrar formato completo
      const processedSuggestions = uniqueResults.map(item => {
        // Formatear la dirección completa
        const parts = [];
        
        // Construcción de la dirección principal
        if (item.address?.road) {
          let streetPart = item.address.road;
          
          // Agregar número de casa si existe
          if (item.address.house_number) {
            streetPart = `${item.address.road} #${item.address.house_number}`;
          }
          
          parts.push(streetPart);
        } else if (item.display_name) {
          // Si no hay road, usar el primer elemento del display_name
          const firstPart = item.display_name.split(',')[0].trim();
          parts.push(firstPart);
        }
        
        // Agregar localidad/barrio si existe
        if (item.address?.neighbourhood) {
          parts.push(item.address.neighbourhood);
        } else if (item.address?.suburb) {
          parts.push(item.address.suburb);
        } else if (item.address?.quarter) {
          parts.push(item.address.quarter);
        }
        
        // Agregar ciudad
        if (item.address?.city) {
          parts.push(item.address.city);
        } else if (item.address?.town) {
          parts.push(item.address.town);
        } else if (item.address?.municipality) {
          parts.push(item.address.municipality);
        }
        
        // Agregar país
        parts.push('Colombia');
        
        const formattedAddress = parts.filter(Boolean).join(', ');
        
        return {
          id: item.osm_id || item.place_id,
          name: parts[0] || item.display_name.split(',')[0],
          fullName: formattedAddress,
          displayName: formattedAddress,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          importance: item.importance || 0
        };
      });

      // Ordenar por importancia (más específico primero)
      processedSuggestions.sort((a, b) => {
        // Priorizar direcciones con números
        const aHasNumber = /#\d+/.test(a.displayName);
        const bHasNumber = /#\d+/.test(b.displayName);
        
        if (aHasNumber && !bHasNumber) return -1;
        if (!aHasNumber && bHasNumber) return 1;
        
        // Luego por importancia
        return b.importance - a.importance;
      });

      // Limitar a 10 resultados
      const limitedSuggestions = processedSuggestions.slice(0, 10);

      // Agregar opción para usar la dirección exacta escrita por el usuario
      const userExactAddress = {
        id: 'exact-input',
        name: query.trim(),
        fullName: `${query.trim()}, ${cityName}, Colombia`,
        displayName: `${query.trim()}, ${cityName}, Colombia`,
        lat: limitedSuggestions[0]?.lat || 4.7110,
        lng: limitedSuggestions[0]?.lng || -74.0141,
        type: 'user-input',
        importance: 999,
        isExactInput: true
      };

      // Insertar la opción exacta al principio
      const finalSuggestions = [userExactAddress, ...limitedSuggestions];

      console.log('Sugerencias procesadas:', finalSuggestions);
      setSuggestions(finalSuggestions);
      setIsOpen(finalSuggestions.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce para las búsquedas
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setAddress(newValue);
    onChange(newValue);
    
    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Nuevo timeout
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(newValue, city);
    }, 300); // Reducido a 300ms para respuesta más rápida
  };

  // Manejar cambio de ciudad
  const handleCitySelect = (newCity) => {
    setCity(newCity);
    setIsCityDropdownOpen(false);
    
    // Si hay una dirección escrita, rehacer la búsqueda con la nueva ciudad
    if (address.trim().length >= 3) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        fetchSuggestions(address, newCity);
      }, 300);
    }
  };

  // Seleccionar sugerencia con click
  const handleSelectSuggestion = async (suggestion) => {
    setAddress(suggestion.displayName);
    onChange(suggestion.displayName);
    
    // Si es la dirección exacta del usuario, intentar geocodificarla mejor
    if (suggestion.isExactInput) {
      setIsLoading(true);
      
      try {
        // Intentar geocodificar la dirección exacta
        const geocodeQuery = suggestion.displayName;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geocodeQuery)}&format=json&limit=1&addressdetails=1`,
          {
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'ChaoPiojos-App/1.0'
            }
          }
        );
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Si se encontró geocodificación exacta, usar esas coordenadas
          setSelectedLocation({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            address: suggestion.displayName
          });
        } else {
          // Si no, usar las coordenadas aproximadas de la primera sugerencia
          setSelectedLocation({
            lat: suggestion.lat,
            lng: suggestion.lng,
            address: suggestion.displayName
          });
        }
      } catch (error) {
        console.error('Error geocodificando dirección exacta:', error);
        // Usar coordenadas aproximadas
        setSelectedLocation({
          lat: suggestion.lat,
          lng: suggestion.lng,
          address: suggestion.displayName
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Para sugerencias normales, usar coordenadas directamente
      setSelectedLocation({
        lat: suggestion.lat,
        lng: suggestion.lng,
        address: suggestion.displayName
      });
    }
    
    setShowMap(true);
    setMarkerPosition([suggestion.lat, suggestion.lng]);
    
    if (onSelect) {
      onSelect(suggestion);
    }

    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Manejar clic en el mapa para seleccionar ubicación
  const handleMapClick = useCallback(async (latlng) => {
    setMarkerPosition([latlng.lat, latlng.lng]);
    setIsLoading(true);

    try {
      // Hacer reverse geocoding para obtener la dirección del punto clicado
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&addressdetails=1`,
        {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'ChaoPiojos-App/1.0'
          }
        }
      );

      const data = await response.json();
      
      if (data && data.address) {
        // Construir dirección desde el reverse geocoding
        const parts = [];
        
        if (data.address.road) {
          let streetPart = data.address.road;
          if (data.address.house_number) {
            streetPart = `${data.address.road} #${data.address.house_number}`;
          }
          parts.push(streetPart);
        }
        
        if (data.address.neighbourhood || data.address.suburb) {
          parts.push(data.address.neighbourhood || data.address.suburb);
        }
        
        if (data.address.city || data.address.town) {
          parts.push(data.address.city || data.address.town);
        }
        
        parts.push('Colombia');
        
        const reverseAddress = parts.filter(Boolean).join(', ');
        
        setSelectedLocation({
          lat: latlng.lat,
          lng: latlng.lng,
          address: reverseAddress
        });
        
        setAddress(reverseAddress);
        onChange(reverseAddress);
        
        if (onSelect) {
          onSelect({
            lat: latlng.lat,
            lng: latlng.lng,
            displayName: reverseAddress,
            fullName: reverseAddress
          });
        }
      }
    } catch (error) {
      console.error('Error en reverse geocoding:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onChange, onSelect]);

  // Manejar arrastre del marcador
  const handleMarkerDrag = useCallback((e) => {
    const marker = e.target;
    const position = marker.getLatLng();
    handleMapClick(position);
  }, [handleMapClick]);

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
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target)) {
        setIsCityDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDropdownPlacement = () => {
    if (!inputPosition) return { top: 0, maxHeight: '60vh' };
    const margin = 8;
    const viewportH = window.innerHeight;
    const belowSpace = viewportH - inputPosition.topBelow - margin;
    const aboveSpace = inputPosition.topAbove - margin;
    const openDown = openDirection === 'down';

    const maxHeight = `${Math.max(200, openDown ? belowSpace : aboveSpace - margin)}px`;
    const top = openDown
      ? inputPosition.topBelow
      : Math.max(margin, inputPosition.topAbove - (dropdownHeight || 0) - margin);

    return { top, maxHeight };
  };

  return (
    <div className="relative space-y-3" ref={containerRef}>
      {/* Campo de Ciudad - Custom Select */}
      <div className="relative" ref={cityDropdownRef}>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-100 p-2 rounded-xl group-focus-within:bg-blue-500 transition-colors z-10 pointer-events-none">
            <MapPin className="w-4 h-4 text-blue-500 group-focus-within:text-white transition-colors" />
          </div>
          <button
            type="button"
            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
            className="w-full pl-14 pr-12 py-3 bg-blue-50 border-4 border-transparent rounded-2xl hover:border-blue-300 focus:border-blue-300 focus:bg-white outline-none font-bold text-gray-700 transition-all text-base text-left"
          >
            {city || 'Selecciona tu ciudad'}
          </button>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown className={`w-5 h-5 text-blue-500 transition-transform duration-300 ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Dropdown de ciudades */}
        <AnimatePresence>
          {isCityDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 w-full bg-white rounded-2xl border-4 border-blue-200 shadow-2xl z-50 overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {cities.map((cityOption, index) => (
                  <motion.button
                    key={cityOption}
                    type="button"
                    onClick={() => handleCitySelect(cityOption)}
                    className={`w-full text-left px-4 py-3 font-bold transition-all border-b border-blue-100 hover:bg-blue-50 ${
                      city === cityOption ? 'bg-blue-100 text-blue-700 border-l-4 border-l-blue-500' : 'text-gray-700'
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    🏙️ {cityOption}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Campo de Dirección */}
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <span className="text-xl">📍</span>
        </div>
        <input
          type="text"
          value={address}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          className={`w-full pl-14 pr-10 py-3 rounded-2xl outline-none font-bold text-gray-700 transition-all text-base ${
            hasError 
              ? 'bg-red-50 border-4 border-red-400 focus:border-red-500 focus:bg-white placeholder-red-200' 
              : 'bg-cyan-50 border-4 border-transparent focus:border-cyan-300 focus:bg-white placeholder-cyan-200'
          }`}
          placeholder="Ingresa una nueva dirección"
          required
          ref={inputRef}
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
                top: `${getDropdownPlacement().top}px`,
                left: `${inputPosition.left}px`,
                width: `${inputPosition.width}px`,
                marginTop: '8px'
              }}
              className="bg-white rounded-2xl border-4 border-cyan-200 shadow-2xl z-[9999] overflow-hidden pointer-events-auto"
              ref={dropdownRef}
            >
              <div
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: getDropdownPlacement().maxHeight }}
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
                    } ${suggestion.isExactInput ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{suggestion.isExactInput ? '✍️' : '📍'}</span>
                      <div className="flex-1 min-w-0">
                        {suggestion.isExactInput ? (
                          <>
                            <p className="font-bold text-green-700 text-sm mb-0.5">
                              ✨ Usar dirección exacta que escribiste
                            </p>
                            <p className="text-xs text-gray-600">
                              {suggestion.displayName}
                            </p>
                          </>
                        ) : (
                          <p className="font-semibold text-gray-800 text-sm">
                            {suggestion.displayName}
                          </p>
                        )}
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
          {isOpen && suggestions.length === 0 && address.length >= 3 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: `${getDropdownPlacement().top}px`,
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

      {/* Mapa de verificación de dirección */}
      <AnimatePresence>
        {showMap && selectedLocation && markerPosition && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 450, marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden rounded-2xl border-4 border-cyan-200 shadow-xl"
          >
            <div className="relative w-full h-[450px]">
              {/* Header del mapa */}
              <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-sm p-3 border-b-2 border-cyan-200">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-2xl">📍</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-cyan-600 text-sm">Ubicación verificada</p>
                        <p className="text-xs text-gray-600 truncate">{selectedLocation.address}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMap(false);
                        setMarkerPosition(null);
                      }}
                      className="ml-2 p-2 rounded-xl bg-red-100 hover:bg-red-200 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-blue-50 px-3 py-2 rounded-xl border border-blue-200">
                    <MousePointer className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700 font-semibold">Haz clic en el mapa o arrastra el marcador para ajustar la ubicación exacta</span>
                  </div>
                </div>
              </div>

              {/* Mapa con key para forzar re-render */}
              <MapContainer
                key={`${markerPosition[0]}-${markerPosition[1]}`}
                center={markerPosition}
                zoom={17}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                scrollWheelZoom={true}
                zoomControl={true}
                whenCreated={(map) => {
                  setTimeout(() => {
                    map.invalidateSize();
                  }, 100);
                }}
              >
                <MapController center={markerPosition} />
                <MapClickHandler onLocationSelect={handleMapClick} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
                <Marker 
                  position={markerPosition}
                  draggable={true}
                  eventHandlers={{
                    dragend: handleMarkerDrag,
                  }}
                  ref={markerRef}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-lg text-cyan-600 mb-1">
                        📍 Tu dirección
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {selectedLocation.address}
                      </p>
                      <p className="text-xs text-blue-600 font-semibold">
                        💡 Puedes arrastrar este marcador
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddressAutocomplete;

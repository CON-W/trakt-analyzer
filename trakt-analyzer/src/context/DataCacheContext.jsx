import React, { createContext, useContext, useState, useCallback } from 'react';

const DataCacheContext = createContext();

export function DataCacheProvider({ children }) {
  const [movieData, setMovieData] = useState(null);
  const [showData, setShowData] = useState(null);
  const [movieLoading, setMovieLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const clearCache = useCallback(() => {
    setMovieData(null);
    setShowData(null);
  }, []);

  return (
    <DataCacheContext.Provider value={{
      movieData, setMovieData,
      showData, setShowData,
      movieLoading, setMovieLoading,
      showLoading, setShowLoading,
      clearCache,
    }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider');
  return ctx;
}

export default DataCacheContext;

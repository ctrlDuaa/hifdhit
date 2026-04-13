import { useEffect, useState } from 'react';

// Track loaded fonts globally to persist across component unmounts
const loadedFontsCache = new Set<number>();

/**
 * Hook to dynamically load page-specific Mushaf fonts with caching
 * Each page has its own font file (p1.ttf, p2.ttf, etc.)
 * The glyphs in the database are designed to work with their corresponding page font
 * Fonts are cached after first load for instant subsequent access
 */
export const usePageFont = (pageNumber: number) => {
  const [fontLoaded, setFontLoaded] = useState(() => {
    // Check if font is already cached on initial render
    return loadedFontsCache.has(pageNumber);
  });
  
  useEffect(() => {
    // Create a unique font family name for this page
    const fontFamily = `MushafPage${pageNumber}`;
    const fontPath = `/fonts/p${pageNumber}.ttf`;
    
    // If font is already cached, set as loaded immediately
    if (loadedFontsCache.has(pageNumber)) {
      setFontLoaded(true);
      console.log(`✅ Font cached for page ${pageNumber}: ${fontFamily}`);
      return;
    }
    
    // Check if font is already in browser's font cache using Font Loading API
    const checkAndLoadFont = async () => {
      try {
        // Check if font already exists in document.fonts
        const existingFont = Array.from(document.fonts).find(
          (f: any) => f.family === fontFamily
        );
        
        if (existingFont && existingFont.status === 'loaded') {
          // Font is already loaded in browser cache
          loadedFontsCache.add(pageNumber);
          setFontLoaded(true);
          console.log(`🔄 Font restored from browser cache for page ${pageNumber}`);
          return;
        }
        
        // Check if @font-face style exists
        const styleId = `page-font-${pageNumber}`;
        const existingStyle = document.getElementById(styleId);
        
        if (!existingStyle) {
          // Create and inject the @font-face rule with block display
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            @font-face {
              font-family: '${fontFamily}';
              src: url('${fontPath}') format('truetype');
              font-weight: normal;
              font-style: normal;
              font-display: block;
            }
          `;
          document.head.appendChild(style);
        }
        
        // Load the font using Font Loading API
        const font = new FontFace(fontFamily, `url(${fontPath})`);
        await font.load();
        document.fonts.add(font);
        
        // Cache the font as loaded
        loadedFontsCache.add(pageNumber);
        setFontLoaded(true);
        console.log(`📖 Font loaded and cached for page ${pageNumber}: ${fontFamily}`);
      } catch (error) {
        console.error(`Failed to load font for page ${pageNumber}:`, error);
        // Still set as loaded to prevent infinite loading
        setFontLoaded(true);
      }
    };
    
    checkAndLoadFont();
  }, [pageNumber]);
  
  // Return the font family name and loading state
  return { fontFamily: `MushafPage${pageNumber}`, fontLoaded };
};

export default usePageFont;

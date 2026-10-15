/**
 * Utilidad de compresión y optimización de imágenes para Mobile-First PWA (RNF-04)
 * Reduce fotos de cámara móvil (5-15MB) a menos de 300KB antes de subir a Supabase Storage.
 */
export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.75): Promise<File> {
  // Solo procesar imágenes
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Si es un SVG o GIF animado, no alterar
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular escala proporcional respetando el aspecto
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Suavizado de imagen bicúbico
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Convertir blob comprimido a File conservando el nombre original
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '.jpg'),
              {
                type: 'image/jpeg',
                lastModified: Date.now()
              }
            );

            // Si por alguna razón el comprimido pesa más que el original, usar el original
            if (compressedFile.size > file.size) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

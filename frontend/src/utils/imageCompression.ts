/**
 * Utilidad de compresión y optimización de imágenes para Mobile-First PWA (RF-03, RNF-02)
 * - Convierte fotos de cámara o galería a formato WebP.
 * - Resolución máxima acotada a 1200 px manteniendo proporción.
 * - Peso objetivo menor a 300 KB con ajuste adaptativo de calidad.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  initialQuality = 0.8
): Promise<File> {
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

      img.onload = async () => {
        let width = img.width;
        let height = img.height;

        // Limitar a resolución máxima de 1200 px manteniendo relación de aspecto (RF-03)
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

        // Suavizado de imagen bicúbico de alta fidelidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Algoritmo iterativo para alcanzar peso objetivo < 300 KB en WebP (RF-03)
        const TARGET_MAX_BYTES = 300 * 1024; // 300 KB
        let currentQuality = initialQuality;

        const attemptWebP = (qualityVal: number): Promise<Blob | null> => {
          return new Promise((res) => {
            canvas.toBlob(
              (blob) => res(blob),
              'image/webp',
              qualityVal
            );
          });
        };

        let blob = await attemptWebP(currentQuality);

        // Si excede 300 KB, reducir progresivamente la calidad hasta satisfacer la cuota
        while (blob && blob.size > TARGET_MAX_BYTES && currentQuality > 0.35) {
          currentQuality = Math.max(0.35, currentQuality - 0.12);
          const nextBlob = await attemptWebP(currentQuality);
          if (nextBlob) {
            blob = nextBlob;
          } else {
            break;
          }
        }

        if (!blob) {
          resolve(file);
          return;
        }

        // Generar archivo con formato .webp
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const compressedFile = new File(
          [blob],
          `${baseName}.webp`,
          {
            type: 'image/webp',
            lastModified: Date.now()
          }
        );

        resolve(compressedFile);
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

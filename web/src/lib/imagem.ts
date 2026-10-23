// Reduz a foto no próprio telemóvel antes de enviar: poupa dados móveis e espaço no servidor.
export async function reduzirImagem(ficheiro: File, ladoMaximo = 1600, qualidade = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(ficheiro).catch(() => null);
  if (!bitmap) return ficheiro;
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? ficheiro), 'image/jpeg', qualidade));
}

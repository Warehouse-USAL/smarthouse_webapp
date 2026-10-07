/*
|--------------------------------------------------------------------------
| FILE SERVICE
|--------------------------------------------------------------------------
|
| Imágenes en MinIO, vía el backend (FileController):
|
|   POST   /api/v1/files/upload            multipart, campo `file`
|                                          → { url, key }
|   GET    /api/v1/files/{path}/{filename} sirve la imagen — PÚBLICO, sin token
|   DELETE /api/v1/files/{path}/{filename} borra (SUPERADMIN / ADMIN_WAREHOUSE)
|
| La `url` que devuelve es relativa (/api/v1/files/images/<uuid>.png) y es la
| que se guarda tal cual en product.images[].url: el backend la sirve él mismo
| proxeando MinIO, así que no hay que componer ninguna URL firmada ni exponer el
| bucket.
|
| Subir requiere rol ADMIN_WAREHOUSE, ADMIN_SALES o SUPERADMIN.
|
*/

import { apiClient } from "../lib/apiClient";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// Tope y tipos: el backend acepta imágenes; esto evita el viaje de ida y vuelta
// para un archivo que va a rebotar.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export const fileService = {
  async upload(file) {
    if (!file) throw new Error("No hay archivo para subir.");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error("Formato no admitido. Usá PNG, JPG, WEBP o GIF.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("La imagen supera los 5 MB.");
    }

    if (USE_MOCK) {
      // Sin backend, la imagen vive como data URL en el navegador.
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });
      return { url, key: file.name };
    }

    const form = new FormData();
    form.append("file", file);
    // Sin Content-Type explícito: el navegador tiene que poner el boundary del
    // multipart. apiClient lo fija en JSON por defecto, así que se pisa acá.
    const { data } = await apiClient.post("/api/v1/files/upload", form, {
      headers: { "Content-Type": undefined },
    });
    return { url: data?.url ?? "", key: data?.key ?? "" };
  },
};

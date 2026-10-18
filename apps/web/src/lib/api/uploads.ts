/** Generic image upload (payment QR codes, store logo) → Cloudinary folder `pos`. */
import { api } from "./client";

export const uploadsApi = {
  image: (file: File) => api.upload<{ url: string }>("/pos/uploads/image", file),
};

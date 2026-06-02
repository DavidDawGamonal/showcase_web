/**
 * Configuración global de la aplicación.
 * Centraliza la URL base de la API para que todos los archivos JS
 * la lean desde aquí en lugar de tenerla hardcodeada en cada fetch.
 * Para cambiar de entorno (local, red, producción) solo hay que
 * modificar este archivo.
 */
const CONFIG = {
  // URL de la API en red local (descomentar para usar en la red de casa)
  // API_URL: "http://192.168.56.1/",

  // URL de la API en local
  // API_URL: "http://localhost:8081/",
  API_URL: "https://showcaseapi-production.up.railway.app/",
};

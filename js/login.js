const urlApi = CONFIG.API_URL;

/**
 * Redirige al usuario a la página principal al pulsar "Cancelar".
 */
function cancelar() {
  window.location.href = "principal.html";
}

/**
 * Valida el formato de un email usando una expresión regular.
 * El patrón coincide con el CHECK constraint definido en la base de datos,
 * garantizando que solo se envíen emails que la BD aceptará.
 *
 * @param {string} email - El email a validar
 * @returns {boolean} true si el formato es válido, false en caso contrario
 */
function validarEmail(email) {
  const regex = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  return regex.test(email);
}

/**
 * Gestiona el inicio de sesión del usuario.
 * Llama a GET /checkLogin con email y password como parámetros en la URL.
 * Si las credenciales son correctas guarda el objeto usuario en localStorage
 * bajo la clave "usuarioLogado" y redirige a principal.html.
 * Si son incorrectas muestra un alert al usuario.
 *
 * PENDIENTE: cambiar a POST para no exponer credenciales en la URL.
 */
async function login() {
  let usuario = document.getElementById("usuario").value;
  let password = document.getElementById("password").value;
  /*
  let usuarioLogado = { email: usuario, password: password };
    let loginUrl = `${urlApi}checkLogin${usuarioLogado}`;
  */
  try {
    let loginUrl = `${urlApi}checkLogin?email=${encodeURIComponent(usuario)}&password=${encodeURIComponent(password)}`;

    const response = await fetch(loginUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      // Parseamos manualmente para manejar respuesta vacía sin romper
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (data) {
        // Guardamos el usuario completo en localStorage para usarlo en todas las páginas
        localStorage.setItem("usuarioLogado", JSON.stringify(data));
        window.location.href = "principal.html";
      } else {
        alert("Usuario o contraseña incorrectos");
      }
    }
  } catch (error) {
    console.error("Error al conectar con la API:", error);
  }
}

/**
 * Gestiona el registro de un nuevo usuario.
 * Valida el email antes de enviar. Si el formato no es válido muestra
 * el error en pantalla y no envía la petición.
 * Llama a POST /createUser con los datos del usuario como JSON.
 * Si el registro es correcto redirige a principal.html.
 */
async function registrarse() {
  const emailValue = document.getElementById("usuario").value;

  // Validamos el email antes de continuar — si no es válido mostramos el error y salimos
  if (!validarEmail(emailValue)) {
    document.getElementById("error-email").textContent =
      "El email no tiene un formato válido";
    return;
  }

  const usuario = document.getElementById("usuario").value;
  const password = document.getElementById("password").value;
  const nombre = document.getElementById("nombre").value;
  const apellido = document.getElementById("apellido").value;
  const rol = document.getElementById("rol_select").value;

  // Construimos el objeto que se enviará al backend — coincide con DataUsuario en Spring
  const userData = {
    nombre: nombre,
    apellido: apellido,
    email: usuario,
    password: password,
    rol: rol,
  };

  try {
    const response = await fetch(`${urlApi}createUser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const data = await response.json();
      if (data === true) {
        window.location.href = "principal.html";
      } else {
        alert("Se ha producido un error al crear el usuario.");
      }
    }
  } catch (error) {
    console.error("Error al guardar el nuevo usuario:", error);
  }
}

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Lee el parámetro "accion" de la URL para determinar si mostrar
 * el formulario de login o el de registro, y configura los listeners
 * de validación en tiempo real correspondientes.
 *
 * Ejemplos de URL:
 * - login.html?accion=iniciarSesion → muestra solo los campos de login
 * - login.html?accion=registrarse   → muestra todos los campos del registro
 */
document.addEventListener("DOMContentLoaded", () => {
  const parametros = new URLSearchParams(window.location.search);
  const accion = parametros.get("accion");
  const titulo = document.getElementById("titulo");

  // Configuramos los campos visibles según la acción
  if (accion === "iniciarSesion") {
    // Ocultamos los campos exclusivos del registro (nombre, apellido, repetir contraseña)
    document.getElementById("campo_registro").hidden = true;
  } else {
    // En registro marcamos nombre y apellido como obligatorios
    document.getElementById("nombre").setAttribute("required", true);
    document.getElementById("apellido").setAttribute("required", true);
  }

  // Formateamos el título: "iniciarSesion" → "Iniciar Sesion"
  titulo.textContent =
    accion.charAt(0).toUpperCase() + accion.slice(1).replace(/([A-Z])/g, " $1");

  // Escuchamos el submit del formulario para llamar a la función correcta
  document
    .getElementById("formulario")
    .addEventListener("submit", async function (e) {
      e.preventDefault(); // Evitamos que el formulario recargue la página
      if (accion === "iniciarSesion") {
        login();
      } else {
        registrarse();
      }
    });

  // Validación de email en tiempo real — solo en modo registro
  if (accion !== "iniciarSesion") {
    document.getElementById("usuario").addEventListener("input", function () {
      const errorSpan = document.getElementById("error-email");
      // Mostramos el error solo si hay texto y el formato no es válido
      if (this.value.length > 0 && !validarEmail(this.value)) {
        errorSpan.textContent = "El email no tiene un formato válido";
      } else {
        errorSpan.textContent = "";
      }
    });
  }

  // Validación de contraseñas coincidentes en tiempo real
  document.getElementById("password2").addEventListener("input", function () {
    const errorSpan2 = document.getElementById("error-password");
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;

    if (password2.length > 0 && password !== password2) {
      errorSpan2.textContent = "Las contraseñas no coinciden.";
    } else {
      errorSpan2.textContent = "";
    }
  });
});

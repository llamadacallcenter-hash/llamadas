# Donde Walter - Call Center

Dashboard web para registrar y consultar llamadas del call center.

## Funciones

- Dashboard con indicadores de llamadas.
- Registro de llamadas.
- Consulta de registros y detalles.
- Gestión de asesores y tiendas.
- Justificación de llamadas no contestadas.
- Reportes y exportación de información.

## Tecnologías

- HTML
- CSS
- JavaScript
- Google Apps Script
- Google Sheets

## Estructura del proyecto

- `index.html`: estructura de la aplicación.
- `styles.css`: estilos y diseño visual.
- `script.js`: lógica del dashboard y conexión con Google Apps Script.
- `google-apps-script.gs`: backend que consulta y actualiza Google Sheets.

## Configuración

1. Crea o utiliza una hoja de cálculo de Google Sheets.
2. Abre **Extensiones > Apps Script**.
3. Copia el contenido de `google-apps-script.gs` en el proyecto de Apps Script.
4. Configura las hojas `Llamadas` y `Asesores`.
5. Implementa el proyecto como una aplicación web.
6. Verifica que la URL de la aplicación web coincida con `GOOGLE_SHEETS_ENDPOINT` en `script.js`.

## Uso local

Abre `index.html` en un navegador. Para una experiencia más estable, puedes servir la carpeta con cualquier servidor local de archivos estáticos.

## Publicación en GitHub Pages

1. Sube los archivos del proyecto a un repositorio de GitHub.
2. En el repositorio, abre **Settings > Pages**.
3. Selecciona la rama principal y la carpeta raíz `/ (root)`.
4. Guarda la configuración y abre la URL generada por GitHub Pages.

GitHub Pages publica la interfaz estática. Google Apps Script continúa funcionando como backend para la conexión con Google Sheets.

## Nota de seguridad

El repositorio contiene la URL pública de la aplicación web de Google Apps Script porque el navegador necesita usarla. No incluyas contraseñas, claves privadas ni credenciales de Google en este repositorio.

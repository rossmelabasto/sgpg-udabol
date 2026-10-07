# Sistema de Gestión de Proyectos de Grado — UDABOL

## 1. Nombre del sistema

**Sistema de Gestión de Proyectos de Grado (SGPG)** — plataforma web para el registro, almacenamiento y consulta de los proyectos de grado y tesis de la universidad.

## 2. Descripción general

El sistema permite a la universidad digitalizar su repositorio de proyectos de grado: el personal autorizado sube el PDF del proyecto y el sistema extrae automáticamente sus datos (título, autor, carrera, año, resumen) mediante inteligencia artificial. Los proyectos quedan almacenados con control de versiones del PDF, historial de auditoría (quién hizo cada cambio y cuándo), papelera recuperable, buscador por relevancia y visor de PDF integrado, con acceso diferenciado por roles (lectura / administrador / superadministrador).

## 3. Arquitectura tecnológica

| Componente | Tecnología |
|---|---|
| Aplicación web (frontend + backend) | Next.js 16 (React 19, TypeScript) — una sola aplicación |
| Base de datos | Cloud Firestore (NoSQL, Google Firebase) |
| Almacenamiento de PDFs | Firebase Storage |
| Autenticación y sesiones | Firebase Authentication (correo/contraseña, sesión 14 días; rol verificado en el servidor) |
| Inteligencia artificial (extracción de datos) | API Groq — modelo GPT-OSS 20B (respaldo: GPT-OSS 120B) |
| Visor de PDF | pdf.js (el mismo en todos los navegadores y en el celular, sin plugins) |

## 4. Requerimientos mínimos de infraestructura

El sistema está construido sobre servicios en la nube, por lo que **no requiere ningún servidor físico**:

| Recurso | Servicio | Plan mínimo | Costo |
|---|---|---|---|
| Alojamiento de la aplicación | Vercel (serverless) | Hobby / Pro | $0 – 20/mes |
| Base de datos | Firestore | Spark (gratis) / Blaze | $0 – 3/mes |
| Almacenamiento de PDFs | Firebase Storage (5 GB) | Gratis incluido | $0 |
| Autenticación | Firebase Auth | Gratis (hasta 10.000 usuarios/mes) | $0 |
| Inteligencia artificial | Groq API | Plan gratuito (pago por uso opcional) | $0 – 1/mes |
| Dominio | Subdominio institucional (`proyectos.udabol.edu.bo`) | — | ~$10/año |
| Certificado SSL/HTTPS | Incluido en Vercel | — | $0 |

**Costo estimado total: $0 – 25 USD/mes**, sin hardware, sin mantenimiento de servidores.

## 5. Requerimientos no funcionales

- **Disponibilidad:** 99,5% garantizado por el proveedor (Vercel), sin puntos únicos de falla.
- **Escalabilidad:** la plataforma escala automáticamente según la cantidad de usuarios; soporta cientos de usuarios concurrentes sin cambios.
- **Seguridad:** conexión cifrada HTTPS; acceso por roles (lectura / administrador / superadministrador) verificado en el servidor; sesiones con expiración y revocación inmediata al desactivar una cuenta; la base de datos y los archivos no son accesibles directamente desde el navegador; registro de auditoría de todas las acciones (crear, editar, enviar a la papelera, restaurar, subir PDF, borrar definitivamente) con el nombre de quien las hizo.
- **Respaldo:** respaldo completo de los datos descargable en cualquier momento desde el panel «Sistema» (superadministrador). Las copias automáticas diarias de Firestore requieren activar el plan Blaze de Firebase (costo estimado: menos de 1 USD/mes con el volumen actual).
- **Límites:** PDF de hasta 4 MB por archivo (límite de las funciones de Vercel); los PDF más pesados se comprimen antes de subirlos.
- **Compatibilidad:** navegadores actuales (Chrome, Edge, Firefox, Safari), escritorio y móvil.

## 6. Requisitos del cliente (usuarios finales)

- Computadora con navegador web moderno (Chrome, Edge, Firefox) o dispositivo móvil.
- Conexión a internet (no requiere instalación de software).
- El personal administrativo requiere una cuenta de usuario autorizada.

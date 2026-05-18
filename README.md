# WebYun

Una aplicación web moderna para la gestión integral de clientes, NAPs (puntos de acceso a red) y usuarios. Construida con tecnologías de vanguardia para proporcionar una experiencia de usuario fluida y una administración de datos eficiente.

## 🚀 Características

- **Autenticación segura** con Firebase Authentication
- **Gestión de clientes** con búsqueda avanzada y filtros
- **Administración de NAPs** (Network Access Points) con dashboard interactivo
- **Sistema de usuarios** con control de roles y permisos
- **Dashboard dinámico** con estadísticas en tiempo real
- **Interfaz responsiva** adaptada a dispositivos móviles y de escritorio
- **Modo oscuro/claro** para mejor accesibilidad
- **Sincronización en tiempo real** con Firestore
- **Base de datos en la nube** con Firebase y Firestore
- **Cloud Functions** para lógica backend escalable

## 🛠️ Tecnologías Utilizadas

- **Frontend:**
  - [Next.js 15.5.18](https://nextjs.org/) - Framework React
  - [React 19.0.0](https://react.dev/) - Librería UI
  - [TypeScript 5.0.0](https://www.typescriptlang.org/) - Tipado estático
  - [Tailwind CSS 4.0.0](https://tailwindcss.com/) - Estilos CSS utilitarios

- **Backend & Base de datos:**
  - [Firebase 11.0.0](https://firebase.google.com/) - Plataforma backend
  - [Firestore](https://firebase.google.com/docs/firestore) - Base de datos NoSQL
  - [Firebase Authentication](https://firebase.google.com/docs/auth) - Sistema de autenticación
  - [Cloud Functions](https://firebase.google.com/docs/functions) - Serverless functions

- **Desarrollo:**
  - [pnpm 11.1.1](https://pnpm.io/) - Package manager
  - [ESLint 9.0.0](https://eslint.org/) - Linter de código
  - [TypeScript](https://www.typescriptlang.org/) - Lenguaje tipado

## 📋 Requisitos Previos

- Node.js 18.0 o superior
- pnpm 11.0 o superior
- Cuenta de Firebase con proyecto configurado
- Credenciales de Firebase (para el archivo de configuración)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd WebYun
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar Firebase

Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales de Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Inicializar Firebase Emulator (opcional)

Para desarrollo local, puedes usar Firebase Emulator:

```bash
firebase emulators:start
```

## 📦 Scripts Disponibles

```bash
# Inicia el servidor de desarrollo
pnpm dev

# Construye la aplicación para producción
pnpm build

# Inicia el servidor de producción
pnpm start

# Ejecuta el linter
pnpm lint
```

## 📁 Estructura del Proyecto

```
WebYun/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout principal
│   │   ├── page.tsx            # Página principal (Dashboard)
│   │   ├── globals.css         # Estilos globales
│   │   └── login/
│   │       └── page.tsx        # Página de login
│   ├── components/
│   │   ├── AgregarNapTab.tsx   # Componente para agregar NAPs
│   │   ├── BuscarClienteTab.tsx # Búsqueda de clientes
│   │   ├── ClientesTab.tsx     # Gestión de clientes
│   │   ├── ClientForm.tsx      # Formulario de cliente
│   │   ├── NAPTable.tsx        # Tabla de NAPs
│   │   ├── ProtectedRoute.tsx  # Ruta protegida
│   │   ├── StatCard.tsx        # Tarjeta de estadísticas
│   │   ├── ThemeToggle.tsx     # Selector de tema
│   │   └── UsuariosTab.tsx     # Gestión de usuarios
│   └── lib/
│       ├── AuthContext.tsx     # Contexto de autenticación
│       ├── firebase.ts         # Configuración de Firebase
│       ├── firestore.ts        # Funciones de Firestore
│       └── types.ts            # Tipos TypeScript
├── functions/
│   ├── src/
│   │   └── index.ts            # Cloud Functions
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   ├── seed.ts                 # Script para cargar datos iniciales
│   └── upload-csv.ts           # Script para importar CSV
├── firebase.json               # Configuración de Firebase
├── firestore.rules             # Reglas de seguridad de Firestore
├── next.config.ts              # Configuración de Next.js
├── tsconfig.json               # Configuración de TypeScript
├── postcss.config.mjs          # Configuración de PostCSS
└── pnpm-workspace.yaml         # Workspace de pnpm
```

## 🎯 Características Principales

### Dashboard NAPs
- Visualización de todos los Network Access Points disponibles
- Estadísticas en tiempo real
- Filtrado y búsqueda avanzada
- Vista detallada por NAP

### Gestión de Clientes
- Registrar nuevos clientes
- Editar información de clientes existentes
- Búsqueda y filtrado de clientes
- Eliminación de registros
- Importación de datos desde CSV

### Administración de Usuarios
- Gestión de roles y permisos
- Creación de nuevos usuarios
- Control de acceso basado en roles (RBAC)

### Autenticación
- Login seguro con Firebase
- Rutas protegidas
- Session management
- Logout seguro

## 🔐 Seguridad

- **Firestore Security Rules**: Configuradas en `firestore.rules`
- **Autenticación**: Implementada con Firebase Authentication
- **Variables de entorno**: Las credenciales sensibles se mantienen en archivos `.env.local`
- **HTTPS**: Soportado en todos los entornos

## 📊 Base de Datos

La aplicación utiliza Firestore como base de datos NoSQL. Las principales colecciones son:

- **clientes**: Información de clientes
- **naps**: Network Access Points disponibles
- **usuarios**: Usuarios del sistema
- **registros**: Registro de transacciones/eventos

## 🚀 Deployment

### Desplegar en Firebase Hosting

```bash
# Construir la aplicación
pnpm build

# Desplegar a Firebase Hosting
firebase deploy
```

### Desplegar Cloud Functions

```bash
# Desde el directorio functions/
cd functions
pnpm deploy
```

## 📝 Importación de Datos

La aplicación incluye scripts para importar datos desde archivos CSV:

```bash
# Cargar datos iniciales
pnpm ts-node scripts/seed.ts

# Importar desde CSV
pnpm ts-node scripts/upload-csv.ts
```

## 🐛 Solución de Problemas

### Error de conexión a Firebase
- Verifica que las credenciales en `.env.local` sean correctas
- Asegúrate de que el proyecto en Firebase Console esté activo
- Verifica que Firestore esté habilitado en tu proyecto

### Problemas con pnpm
- Borra `node_modules` y `pnpm-lock.yaml`
- Ejecuta `pnpm install` de nuevo

### Errores de TypeScript
- Ejecuta `pnpm tsc --noEmit` para verificar errores de tipo
- Asegúrate de que todas las dependencias estén correctamente instaladas

## 📞 Contacto y Soporte

Para reportar problemas o sugerencias, por favor abre un issue en el repositorio.

## 📄 Licencia

Este proyecto está bajo la licencia privada.

---

**Última actualización:** Mayo 2026

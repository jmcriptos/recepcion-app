# Aplicación de Registro de Pesos para Recepción de Carnes - Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Digitalizar completamente el proceso de registro de pesos de cajas de carnes en recepción
- Reducir errores de transcripción en 95% vs. método manual actual
- Acelerar proceso de recepción en 40% (meta: <90 segundos por caja)
- Implementar trazabilidad 100% desde recepción hasta producto final
- Proporcionar datos en tiempo real para supervisores y toma de decisiones
- Cumplir normativas sanitarias de trazabilidad sin hallazgos en auditorías

### Background Context

La empresa de procesamiento cárnico especializada en ahumado de jamones y chuletas actualmente registra manualmente los pesos de las cajas de carnes recibidas, generando errores de transcripción, pérdida de trazabilidad crítica, y ineficiencias operativas. El proceso actual en papel no cumple con las necesidades de un ambiente industrial dinámico donde se requiere rapidez, precisión y cumplimiento normativo.

Esta aplicación móvil transformará la recepción de carnes de un cuello de botella manual a un proceso fluido y trazable, utilizando captura fotográfica y OCR para extraer automáticamente los datos de peso de las etiquetas, complementado con entrada manual rápida cuando sea necesario.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-08-20 | 1.0 | Initial PRD creation based on Project Brief | Business Analyst |

## Requirements

### Functional

**FR1:** La aplicación debe permitir al usuario capturar fotografías de etiquetas de cajas de carnes usando la cámara del dispositivo móvil

**FR2:** El sistema debe extraer automáticamente el peso de las etiquetas fotografiadas usando tecnología OCR con opción de corrección manual

**FR3:** La aplicación debe permitir registro manual de peso cuando OCR no sea efectivo o no esté disponible

**FR4:** El sistema debe capturar campos obligatorios: peso, tipo de corte (jamón/chuleta), proveedor, fecha de recepción, responsable del registro

**FR5:** La aplicación debe validar rangos de peso esperados y mostrar alertas para valores fuera de rango

**FR6:** El sistema debe funcionar en modo offline y sincronizar datos automáticamente cuando se restaure conectividad

**FR7:** La aplicación debe mostrar lista de registros del día actual con función de búsqueda por proveedor o tipo de corte

**FR8:** El sistema debe proporcionar dashboard en tiempo real para supervisores con totales por proveedor y alertas

**FR9:** La aplicación debe almacenar las fotografías de etiquetas como respaldo visual y documentación

**FR10:** El sistema debe generar timestamps automáticos para cada registro de recepción

### Non Functional

**NFR1:** El tiempo de respuesta para procesamiento OCR debe ser menor a 2 segundos

**NFR2:** La aplicación debe funcionar efectivamente con guantes industriales gruesos

**NFR3:** El sistema debe mantener 99.5% de disponibilidad durante horarios operativos (6:00-22:00)

**NFR4:** La aplicación debe sincronizar datos offline sin pérdida cuando se restaure conectividad

**NFR5:** El sistema debe integrarse con la infraestructura PostgreSQL/Heroku existente

**NFR6:** La aplicación debe cumplir con normativas sanitarias de trazabilidad de la industria cárnica

**NFR7:** El sistema debe soportar al menos 200 registros por día sin degradación de performance

## User Interface Design Goals

### Overall UX Vision
Una interfaz móvil ultra-simple y robusta diseñada específicamente para uso industrial con guantes gruesos en ambiente frío. La app prioriza eficiencia sobre estética, con botones grandes, flujos lineales sin navegación compleja, y feedback visual claro. El diseño debe ser intuitivo para usuarios con experiencia tecnológica variable, enfocándose en completar tareas rápidamente sin errores.

### Key Interaction Paradigms
- **Navegación por pasos:** Flujo lineal paso-a-paso para registro (capturar → verificar → confirmar)
- **Toque amplio:** Botones de mínimo 60px para uso con guantes gruesos
- **Feedback inmediato:** Confirmaciones visuales y auditivas para cada acción
- **Modo de un dedo:** Operación principalmente con pulgar/índice
- **Resiliencia a errores:** Confirmaciones antes de acciones críticas, capacidad de deshacer

### Core Screens and Views
- **Pantalla de Login/Identificación:** Selección rápida de operador
- **Dashboard Principal:** Vista de resumen del día + botón "Nuevo Registro"
- **Captura de Foto:** Cámara con guías visuales para enfocar etiqueta
- **Verificación de Datos:** Revisar datos extraídos por OCR + corrección manual
- **Lista de Registros:** Registros del día con búsqueda simple
- **Dashboard Supervisor:** Vista agregada en tiempo real (solo supervisores)

### Accessibility: WCAG AA
Cumplimiento con estándares WCAG AA para contraste de colores, tamaño de texto legible en ambiente industrial, y soporte para usuarios con limitaciones visuales menores.

### Branding
Interfaz industrial funcional con colores de alto contraste (azul marino/blanco/naranja para alertas). Sin elementos decorativos innecesarios. Prioridad en legibilidad y usabilidad sobre branding corporativo elaborado.

### Target Device and Platforms: Cross-Platform
Aplicación móvil cross-platform (iOS/Android) optimizada para tablets industriales resistentes de 8-10 pulgadas, con soporte secundario para smartphones de 6+ pulgadas.

## Technical Assumptions

### Repository Structure: Monorepo
Estructura de monorepo con separación clara entre aplicación móvil (frontend) y API Flask (backend), facilitando coordinación de desarrollo y versionado conjunto mientras se mantiene modularidad.

### Service Architecture
**Arquitectura de Monolito Modular:** API Flask única con blueprints modulares organizados por dominio (autenticación, registros, OCR, reportes). Esta decisión aprovecha la simplicidad del stack Flask existente y permite evolución futura hacia microservicios si es necesario sin reescritura completa.

### Testing Requirements
**Unit + Integration Testing:** Pruebas unitarias para lógica de negocio, pruebas de integración para APIs y base de datos, y pruebas manuales para funcionalidad móvil (OCR, cámara). Testing automatizado via pytest para backend, testing manual estructurado para app móvil.

### Additional Technical Assumptions and Requests
- **Stack Backend:** Python 3.9+ con Flask 2.x, SQLAlchemy como ORM, Flask-Migrate para migraciones
- **Base de Datos:** PostgreSQL (aprovechando infraestructura Heroku existente)
- **Deployment:** Heroku con Heroku Postgres, configuración CI/CD via GitHub Actions
- **Storage de Imágenes:** AWS S3 o Cloudinary para almacenar fotografías de etiquetas
- **OCR Processing:** Tesseract/pytesseract para procesamiento local, con fallback a Google Vision API para casos complejos
- **Framework Móvil:** React Native o Flutter para desarrollo cross-platform
- **Autenticación:** Flask-Login con sesiones simples, sin OAuth complejo para MVP
- **Logging:** Python logging con Flask-Logging configurado para Heroku logs
- **Monitoring:** Heroku built-in monitoring + Sentry para error tracking

## Epic List

**Epic 1: Foundation & Core Infrastructure**  
Establecer la infraestructura básica del proyecto con API Flask, base de datos PostgreSQL, configuración de CI/CD en Heroku, y una funcionalidad básica de health-check que permita validar que el sistema está operativo.

**Epic 2: Authentication & User Management**  
Implementar sistema de autenticación simple para operadores y supervisores, incluyendo roles básicos y sesiones de usuario que permitan identificar quién registra cada entrada.

**Epic 3: Core Weight Registration**  
Desarrollar la funcionalidad central de registro manual de pesos con validaciones, timestamps automáticos, y persistencia en base de datos, proporcionando el valor core del sistema.

**Epic 4: Photo Capture & OCR Processing**  
Agregar capacidades de fotografía móvil y extracción automática de peso via OCR, con corrección manual, elevando significativamente la eficiencia del proceso de registro.

**Epic 5: Data Management & Search**  
Implementar listado de registros, búsqueda por criterios, y dashboard supervisor en tiempo real, completando la experiencia de usuario para ambos roles.

**Epic 6: Offline Capability & Sync**  
Añadir modo offline con sincronización automática, asegurando robustez operativa en ambiente industrial con conectividad intermitente.

## Epic 1: Foundation & Core Infrastructure

**Goal:** Establecer la infraestructura técnica fundamental del proyecto creando una API Flask robusta con base de datos PostgreSQL, configuración de CI/CD en Heroku, sistema de logging, y funcionalidad básica de health-check. Este epic proporciona la base técnica sobre la cual se construirán todas las funcionalidades posteriores y valida que el pipeline de desarrollo y deployment funciona correctamente.

### Story 1.1: Project Setup & Initial Flask API
As a **developer**,  
I want **to create the basic Flask project structure with essential configurations**,  
so that **we have a solid foundation for development with proper project organization**.

#### Acceptance Criteria
1. Flask project iniciado con estructura de carpetas estándar (app/, tests/, migrations/, config/)
2. Configuración de entornos (development, testing, production) usando variables de entorno
3. Requirements.txt configurado con Flask 2.x, SQLAlchemy, Flask-Migrate, pytest
4. .gitignore configurado para Python/Flask projects
5. README.md básico con instrucciones de setup local

### Story 1.2: Database Models & Migrations
As a **developer**,  
I want **to create the database schema for weight registrations and users**,  
so that **we can store and retrieve weight registration data reliably**.

#### Acceptance Criteria
1. Modelo User con campos: id, name, role (operator/supervisor), created_at
2. Modelo WeightRegistration con campos: id, weight, cut_type, supplier, registered_by, created_at, photo_url
3. Migraciones SQLAlchemy configuradas y funcionando
4. Base de datos PostgreSQL configurada para desarrollo local
5. Seed data script para usuarios de prueba

### Story 1.3: Heroku Deployment & CI/CD
As a **developer**,  
I want **to deploy the Flask app to Heroku with automated CI/CD**,  
so that **we can deploy changes automatically and have a production environment**.

#### Acceptance Criteria
1. Heroku app configurada con Heroku Postgres addon
2. GitHub Actions workflow para testing y deployment automático
3. Variables de entorno configuradas en Heroku (DATABASE_URL, SECRET_KEY, etc.)
4. Procfile configurado para Heroku deployment
5. Health check endpoint funcionando en producción

### Story 1.4: Health Check & Basic API Structure
As a **system administrator**,  
I want **basic API endpoints that confirm the system is operational**,  
so that **I can monitor system health and validate the deployment**.

#### Acceptance Criteria
1. Endpoint GET /health que retorna status 200 y información del sistema
2. Endpoint GET /api/v1/ping que retorna timestamp y database connectivity status
3. Basic error handling y logging configurado
4. API versioning estructura implementada (/api/v1/)
5. Documentación básica de API endpoints

## Epic 2: Authentication & User Management

**Goal:** Implementar un sistema de autenticación simple pero robusto que permita identificar operadores y supervisores, gestionar sesiones de usuario, y establecer roles básicos que habiliten funcionalidades diferenciadas. Este epic asegura que cada registro de peso esté asociado a un usuario específico, cumpliendo requisitos de trazabilidad y auditoria.

### Story 2.1: User Authentication API
As a **developer**,  
I want **to create API endpoints for user login and session management**,  
so that **users can authenticate and maintain secure sessions**.

#### Acceptance Criteria
1. Endpoint POST /api/v1/auth/login que acepta name y valida contra usuarios existentes
2. Flask-Login configurado para gestión de sesiones
3. Endpoint POST /api/v1/auth/logout para cerrar sesión
4. Endpoint GET /api/v1/auth/current-user para obtener usuario actual
5. Middleware de autenticación para proteger rutas que requieren login

### Story 2.2: Mobile App Authentication Screen
As an **operator**,  
I want **a simple login screen that allows me to select my name quickly**,  
so that **I can identify myself before starting weight registrations**.

#### Acceptance Criteria
1. Pantalla de login móvil con lista de usuarios disponibles
2. Botones grandes optimizados para uso con guantes (mínimo 60px)
3. Integración con API de autenticación del backend
4. Persistencia de sesión en el dispositivo móvil
5. Logout automático después de inactividad (4 horas)

### Story 2.3: Role-Based Access Control
As a **supervisor**,  
I want **access to all registration functions plus supervisor-only features like dashboard and reports**,  
so that **I can both register weights when needed and monitor overall operations**.

#### Acceptance Criteria
1. Decorador @role_required para proteger endpoints por rol
2. Operators pueden acceder a endpoints de registro y sus propios datos
3. Supervisors pueden acceder a todos los endpoints (registro + dashboard + reportes + gestión usuarios)
4. App móvil muestra funciones adicionales para supervisors (dashboard, reportes, gestión usuarios)
5. Mensajes de error claros para acceso no autorizado

### Story 2.4: User Management Interface
As a **supervisor**,  
I want **to add new operators and manage user accounts**,  
so that **I can onboard new team members and maintain user list**.

#### Acceptance Criteria
1. Endpoint POST /api/v1/users para crear nuevos usuarios
2. Endpoint GET /api/v1/users para listar usuarios (supervisors only)
3. Endpoint PUT /api/v1/users/:id para actualizar información de usuario
4. Validaciones para nombres únicos y roles válidos
5. Interfaz móvil simple para supervisors gestionar usuarios

## Epic 3: Core Weight Registration

**Goal:** Desarrollar la funcionalidad central del sistema que permite registro manual de pesos de cajas de carnes con todas las validaciones, campos obligatorios, y persistencia en base de datos. Este epic entrega el valor core del sistema, permitiendo digitalizar el proceso manual actual y establecer trazabilidad básica.

### Story 3.1: Weight Registration API
As a **developer**,  
I want **API endpoints to create and retrieve weight registrations**,  
so that **the mobile app can save and display registration data**.

#### Acceptance Criteria
1. Endpoint POST /api/v1/registrations para crear nuevos registros
2. Validación de campos obligatorios: weight, cut_type, supplier, registered_by
3. Validación de rangos de peso (5-50 kg para cajas típicas)
4. Timestamp automático y asociación con usuario autenticado
5. Endpoint GET /api/v1/registrations para listar registros con filtros

### Story 3.2: Manual Weight Entry Screen
As an **operator or supervisor**,  
I want **a simple form to manually enter weight and product details**,  
so that **I can quickly register each box without errors**.

#### Acceptance Criteria
1. Formulario móvil con campos: peso, tipo de corte, proveedor
2. Teclado numérico optimizado para entrada de peso
3. Dropdown/picker para tipo de corte (jamón/chuleta)
4. Campo de texto para proveedor con autocompletado
5. Botón "Registrar" grande y confirmación visual del registro exitoso

### Story 3.3: Data Validation & Error Handling
As an **operator or supervisor**,  
I want **clear validation messages when I enter incorrect data**,  
so that **I can correct errors quickly and complete registrations**.

#### Acceptance Criteria
1. Validación en tiempo real de peso (debe ser número positivo, rango 5-50 kg)
2. Validación de campos requeridos antes de envío
3. Mensajes de error claros y específicos en español
4. Retry automático para errores de conectividad
5. Indicador visual de campos con errores

### Story 3.4: Registration Confirmation & Receipt
As an **operator or supervisor**,  
I want **visual confirmation that my registration was saved successfully**,  
so that **I know the data was recorded and can proceed to the next box**.

#### Acceptance Criteria
1. Pantalla de confirmación con resumen del registro guardado
2. Timestamp y número de registro único mostrado
3. Botón "Nuevo Registro" para continuar con siguiente caja
4. Sonido de confirmación (opcional, configurable)
5. Registro visible inmediatamente en lista de registros del día

## Epic 4: Photo Capture & OCR Processing

**Goal:** Agregar capacidades avanzadas de fotografía móvil y extracción automática de peso via OCR, con corrección manual cuando sea necesario. Este epic eleva significativamente la eficiencia del proceso de registro, reduciendo errores de transcripción manual y proporcionando documentación visual automática de cada registro.

### Story 4.1: Mobile Camera Integration
As an **operator or supervisor**,  
I want **to take photos of meat box labels using the mobile device camera**,  
so that **I can capture label information quickly and have visual documentation**.

#### Acceptance Criteria
1. Integración nativa de cámara en la app móvil (React Native/Flutter)
2. Interfaz de cámara con guías visuales para enfocar etiquetas
3. Captura en alta resolución optimizada para OCR (mínimo 8MP)
4. Preview de foto capturada con opción de re-tomar
5. Compresión automática para optimizar storage y transmisión

### Story 4.2: OCR Processing Integration
As a **developer**,  
I want **to integrate OCR processing to extract weight from photos**,  
so that **the system can automatically read weight values from label images**.

#### Acceptance Criteria
1. Integración de Tesseract/pytesseract en el backend Flask
2. Endpoint POST /api/v1/ocr/process-image para procesar imágenes
3. Pre-procesamiento de imagen (contraste, rotación, filtros) para mejor OCR
4. Extracción específica de números que representan peso (kg)
5. Fallback a Google Vision API para casos de baja confianza

### Story 4.3: Photo Capture Workflow
As an **operator or supervisor**,  
I want **a seamless workflow from photo capture to data extraction**,  
so that **I can quickly move from taking the photo to confirming the extracted data**.

#### Acceptance Criteria
1. Flujo: Capturar → Procesar → Revisar → Confirmar/Editar
2. Indicador de progreso durante procesamiento OCR (<2 segundos)
3. Foto almacenada en storage (S3/Cloudinary) con URL en base de datos
4. Datos extraídos pre-poblados en formulario de registro
5. Opción de saltar OCR e ir directo a entrada manual

### Story 4.4: OCR Results Review & Manual Correction
As an **operator or supervisor**,  
I want **to review and correct OCR-extracted data before saving**,  
so that **I can ensure accuracy while benefiting from automatic extraction**.

#### Acceptance Criteria
1. Pantalla de revisión mostrando foto + datos extraídos destacados
2. Campos editables pre-poblados con resultados OCR
3. Indicador de confianza del OCR (alta/media/baja)
4. Botón "Usar datos extraídos" vs "Editar manualmente"
5. Tracking de accuracy del OCR para mejoras futuras

## Epic 5: Data Management & Search

**Goal:** Implementar funcionalidades de gestión de datos que permitan a usuarios consultar, buscar y analizar registros históricos, junto con un dashboard supervisor en tiempo real. Este epic completa la experiencia de usuario proporcionando visibilidad operativa y herramientas de análisis que transforman los datos capturados en insights accionables.

### Story 5.1: Registration Listing & Search API
As a **developer**,  
I want **API endpoints for listing and searching weight registrations**,  
so that **the mobile app can display historical data with filtering capabilities**.

#### Acceptance Criteria
1. Endpoint GET /api/v1/registrations con paginación y filtros
2. Filtros por: fecha, proveedor, tipo de corte, usuario registrador
3. Ordenamiento por fecha (más recientes primero)
4. Endpoint GET /api/v1/registrations/today para registros del día actual
5. Response incluye metadatos: total_count, total_weight, registrations_by_supplier

### Story 5.2: Daily Registrations View
As an **operator or supervisor**,  
I want **to view all registrations from today with basic search**,  
so that **I can review what has been registered and verify completeness**.

#### Acceptance Criteria
1. Lista móvil de registros del día con información resumida
2. Cada item muestra: peso, tipo, proveedor, hora, registrado por
3. Búsqueda simple por proveedor (text input con filtrado en vivo)
4. Pull-to-refresh para actualizar datos
5. Tap en registro muestra detalles completos + foto si existe

### Story 5.3: Supervisor Dashboard - Real Time Overview
As a **supervisor**,  
I want **a real-time dashboard showing current day operations**,  
so that **I can monitor productivity and identify issues quickly**.

#### Acceptance Criteria
1. Dashboard pantalla exclusiva para supervisors
2. Métricas clave: total cajas hoy, peso total, registros por hora
3. Breakdown por proveedor (tabla/gráfico simple)
4. Lista de registros recientes (últimos 10)
5. Auto-refresh cada 30 segundos

### Story 5.4: Data Export & Basic Reports
As a **supervisor**,  
I want **to export registration data for external analysis**,  
so that **I can create reports for management and integrate with other systems**.

#### Acceptance Criteria
1. Endpoint GET /api/v1/reports/export con filtros de fecha
2. Exportación en formato CSV con todos los campos
3. Interfaz móvil simple para seleccionar rango de fechas
4. Email del archivo CSV o descarga directa
5. Incluir URLs de fotos en export para referencia

## Epic 6: Offline Capability & Sync

**Goal:** Añadir modo offline robusto con sincronización automática, asegurando que la aplicación funcione sin interrupciones en ambiente industrial con conectividad intermitente. Este epic garantiza la continuidad operativa y previene pérdida de datos durante interrupciones de red.

### Story 6.1: Offline Data Storage
As a **developer**,  
I want **local storage capabilities in the mobile app**,  
so that **registrations can be saved locally when offline**.

#### Acceptance Criteria
1. SQLite local database en la app móvil
2. Modelo local que replica estructura de backend
3. Storage local para fotos con compresión
4. Queue de operaciones pendientes de sincronización
5. Indicador visual de estado: online/offline/syncing

### Story 6.2: Offline Registration Workflow
As an **operator or supervisor**,  
I want **to continue registering weights when internet is unavailable**,  
so that **work doesn't stop due to connectivity issues**.

#### Acceptance Criteria
1. App funciona completamente en modo offline
2. Registros guardados localmente con timestamp
3. Fotos almacenadas localmente hasta sincronización
4. OCR procesado localmente (Tesseract móvil) o marcado para procesamiento posterior
5. Indicador claro de cuántos registros están pendientes de sync

### Story 6.3: Automatic Synchronization
As an **operator or supervisor**,  
I want **automatic sync when connectivity returns**,  
so that **my offline registrations are saved to the system without manual intervention**.

#### Acceptance Criteria
1. Detección automática de conectividad restaurada
2. Sync automático en background de registros pendientes
3. Upload de fotos pendientes con retry logic
4. Resolución de conflictos (si existieran)
5. Notificación de sync completado exitosamente

### Story 6.4: Sync Status & Manual Controls
As a **supervisor**,  
I want **visibility and control over sync status**,  
so that **I can ensure all data is properly synchronized and troubleshoot issues**.

#### Acceptance Criteria
1. Pantalla de estado de sincronización (registros pendientes, errores)
2. Botón manual "Forzar Sync" para supervisors
3. Log de errores de sincronización con detalles
4. Opción de re-enviar registros fallidos individualmente
5. Indicador de última sincronización exitosa